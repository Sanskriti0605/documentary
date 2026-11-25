import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
import openai

from app.providers.base import BaseLLMProvider, LLMStructuredOutput, LLMClaim, LLMResponse
from app.providers.openrouter_provider import OpenRouterProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.provider_factory import get_llm_provider
from app.providers.json_extractor import (
    sanitize_json_string,
    repair_json_string,
    extract_and_validate_structured_output
)
from app.generation.engine import generate_verifiable_answer, fallback_extractive_generation

# A. Provider initialization
def test_provider_initialization():
    provider = OpenRouterProvider(api_key="test-key", model="nvidia/nemotron-3.5-lightning:free")
    assert provider.get_provider_name() == "openrouter"
    assert provider.get_model_name() == "nvidia/nemotron-3.5-lightning:free"
    assert provider.base_url == "https://openrouter.ai/api/v1"

# B. Missing API key
@pytest.mark.asyncio
async def test_missing_api_key():
    provider = OpenRouterProvider(api_key="")
    resp = await provider.generate(prompt="Test question", system_prompt="Test system")
    assert resp.is_fallback is True
    assert "not configured" in resp.error.lower()
    assert resp.structured is None

# C. Valid API key configuration in health check
@pytest.mark.asyncio
async def test_valid_api_key_health():
    provider = OpenRouterProvider(api_key="sk-or-v1-abcdef1234567890")
    health = await provider.check_health(check_connectivity=False)
    assert health["provider"] == "openrouter"
    assert health["api_key_configured"] is True
    assert health["status"] == "configured"
    assert "sk-or-v1" not in health["api_key_status"] or "..." in health["api_key_status"]

# D. Successful model response
@pytest.mark.asyncio
async def test_successful_model_response():
    provider = OpenRouterProvider(api_key="sk-test-valid")
    mock_payload = {
        "answer": "The penal charge for default on personal loans is 2.0% per annum.",
        "status": "VERIFIED",
        "claims": [
            {
                "claim": "Penal charge for default is 2.0% per annum on the overdue amount.",
                "evidence_ids": ["EV-001"]
            }
        ],
        "conflicts": [],
        "limitations": ["Applies to personal loans only"]
    }
    mock_choice = MagicMock()
    mock_choice.message.content = f"```json\n{json_dumps(mock_payload)}\n```"
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage.prompt_tokens = 45
    mock_response.usage.completion_tokens = 30
    mock_response.usage.total_tokens = 75

    with patch.object(provider, "_get_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_client_factory.return_value = mock_client

        res = await provider.generate("What is the penal rate?", "System prompt")
        assert res.is_fallback is False
        assert res.error is None
        assert res.structured is not None
        assert res.structured.status == "VERIFIED"
        assert len(res.structured.claims) == 1
        assert res.structured.claims[0].evidence_ids == ["EV-001"]

# E. Invalid API key (HTTP 401)
@pytest.mark.asyncio
async def test_invalid_api_key_401():
    provider = OpenRouterProvider(api_key="sk-invalid-key")
    req = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    resp_obj = httpx.Response(401, request=req, json={"error": {"message": "Invalid API Key"}})
    auth_err = openai.AuthenticationError(message="Invalid API Key", response=resp_obj, body=None)

    with patch.object(provider, "_get_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=auth_err)
        mock_client_factory.return_value = mock_client

        res = await provider.generate("Test query", "System prompt")
        assert res.is_fallback is True
        assert res.status_code == 401
        assert "Invalid or expired" in res.error

# F. Rate-limit response (HTTP 429 with backoff)
@pytest.mark.asyncio
async def test_rate_limit_429_with_backoff():
    provider = OpenRouterProvider(api_key="sk-rate-limited", max_retries=1)
    req = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    resp_obj = httpx.Response(429, request=req, json={"error": {"message": "Rate limit exceeded"}})
    rate_err = openai.RateLimitError(message="Rate limit exceeded", response=resp_obj, body=None)

    with patch.object(provider, "_get_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=rate_err)
        mock_client_factory.return_value = mock_client

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            res = await provider.generate("Test query", "System prompt")
            assert res.is_fallback is True
            assert "Rate limit" in res.error
            assert mock_sleep.called

# G. Provider timeout
@pytest.mark.asyncio
async def test_provider_timeout():
    provider = OpenRouterProvider(api_key="sk-test", max_retries=0)
    req = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    timeout_err = openai.APITimeoutError(request=req)

    with patch.object(provider, "_get_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=timeout_err)
        mock_client_factory.return_value = mock_client

        res = await provider.generate("Test query", "System prompt")
        assert res.is_fallback is True
        assert "timed out" in res.error.lower()

# H. Empty model response
@pytest.mark.asyncio
async def test_empty_model_response():
    provider = OpenRouterProvider(api_key="sk-test")
    mock_choice = MagicMock()
    mock_choice.message.content = ""
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage = None

    with patch.object(provider, "_get_client") as mock_client_factory:
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        mock_client_factory.return_value = mock_client

        res = await provider.generate("Test query", "System prompt")
        assert res.is_fallback is False
        assert res.structured is None

# I. Invalid JSON response and repair
def test_invalid_json_repair_and_extraction():
    # Markdown enclosed with trailing comma
    raw = '```json\n{"answer": "Grounded response.", "claims": [{"claim": "Rate is 12%", "evidence_ids": ["EV-001"],}],}\n```'
    structured = extract_and_validate_structured_output(raw)
    assert structured is not None
    assert structured.answer == "Grounded response."
    assert len(structured.claims) == 1
    assert structured.claims[0].claim == "Rate is 12%"

    # Truncated missing closing brackets
    truncated = '{"answer": "Truncated reply", "claims": [{"claim": "Valid claim", "evidence_ids": ["EV-001"]'
    repaired = extract_and_validate_structured_output(truncated)
    assert repaired is not None
    assert repaired.answer == "Truncated reply"
    assert len(repaired.claims) == 1

# J. Pydantic output validation
def test_pydantic_output_schema_validation():
    sample_data = {
        "answer": "Test answer",
        "status": "VERIFIED",
        "claims": [{"claim": "Statement 1", "evidence_ids": ["EV-001"], "verification_status": "VERIFIED"}],
        "conflicts": [],
        "limitations": [],
        "requires_human_review": False
    }
    model = LLMStructuredOutput(**sample_data)
    assert model.answer == "Test answer"
    assert model.status == "VERIFIED"
    assert model.claims[0].claim == "Statement 1"

# K. Citation ID validation
@pytest.mark.asyncio
async def test_citation_id_validation_and_mapping():
    quotes = [
        {
            "id": "q-1",
            "document_id": "doc-1",
            "document_name": "Policy_2023.pdf",
            "clause_number": "4.1",
            "page_number": 2,
            "clause_text": "Penal charges shall be 2.0% per annum on the overdue amount.",
            "bounding_box": [50, 100, 400, 120]
        }
    ]

    mock_res = LLMResponse(
        raw_content="{}",
        structured=LLMStructuredOutput(
            answer="Penal charges are 2.0% per annum.",
            status="VERIFIED",
            claims=[
                LLMClaim(claim="Penal charges shall be 2.0% per annum.", evidence_ids=["EV-001"])
            ]
        ),
        provider="openrouter",
        model="nvidia/nemotron-3.5-lightning:free",
        is_fallback=False
    )

    with patch("app.generation.engine.get_llm_provider") as mock_prov_fn:
        mock_provider = AsyncMock()
        mock_provider.generate = AsyncMock(return_value=mock_res)
        mock_provider.get_provider_name = MagicMock(return_value="openrouter")
        mock_provider.get_model_name = MagicMock(return_value="nvidia/nemotron-3.5-lightning:free")
        mock_prov_fn.return_value = mock_provider

        output = await generate_verifiable_answer("What is the penal rate?", quotes)
        assert output["is_fallback"] is False
        assert len(output["claims"]) == 1
        claim = output["claims"][0]
        assert "citations" in claim
        assert len(claim["citations"]) == 1
        citation = claim["citations"][0]
        assert citation["document_name"] == "Policy_2023.pdf"
        assert citation["page_number"] == 2
        assert citation["clause_number"] == "4.1"

# L. RAG evidence passing
@pytest.mark.asyncio
async def test_rag_evidence_passing_to_llm():
    quotes = [
        {
            "id": "q-1",
            "document_name": "Agreement.pdf",
            "page_number": 1,
            "clause_number": "3.1",
            "clause_text": "The rate of interest is 12.5% per annum."
        }
    ]

    with patch("app.generation.engine.get_llm_provider") as mock_prov_fn:
        mock_provider = AsyncMock()
        mock_provider.generate = AsyncMock(return_value=LLMResponse(
            raw_content="{}",
            structured=LLMStructuredOutput(answer="12.5%", claims=[]),
            provider="openrouter",
            model="nvidia/nemotron-3.5-lightning:free"
        ))
        mock_provider.get_provider_name = MagicMock(return_value="openrouter")
        mock_provider.get_model_name = MagicMock(return_value="nvidia/nemotron-3.5-lightning:free")
        mock_prov_fn.return_value = mock_provider

        await generate_verifiable_answer("What is interest rate?", quotes)
        # Verify prompt contained the retrieved quote
        call_args = mock_provider.generate.call_args
        user_prompt = call_args.kwargs.get("prompt") if "prompt" in call_args.kwargs else call_args.args[0]
        assert "Agreement.pdf" in user_prompt
        assert "12.5% per annum" in user_prompt
        assert "EV-001" in user_prompt

# M. Evidence-aware abstention
@pytest.mark.asyncio
async def test_evidence_aware_abstention():
    quotes = []
    output = fallback_extractive_generation("What is tractor loan subsidy?", quotes)
    assert output["status"] == "INSUFFICIENT_EVIDENCE"
    assert output["insufficient_evidence"] is True
    assert "ABSTENTION ENFORCED" in output["answer"]

# N. Contradiction reporting
@pytest.mark.asyncio
async def test_contradiction_reporting_preservation():
    quotes = [
        {
            "id": "q-1",
            "document_name": "DocA.pdf",
            "clause_text": "Interest rate is 12.5%."
        }
    ]

    mock_res = LLMResponse(
        raw_content="{}",
        structured=LLMStructuredOutput(
            answer="Conflicting rates detected.",
            status="CONFLICTED",
            conflicts=["DocA states 12.5% while DocB states 11.0%."],
            claims=[LLMClaim(claim="Conflicting rates found.", evidence_ids=["EV-001"])]
        ),
        provider="openrouter",
        model="nvidia/nemotron-3.5-lightning:free"
    )

    with patch("app.generation.engine.get_llm_provider") as mock_prov_fn:
        mock_provider = AsyncMock()
        mock_provider.generate = AsyncMock(return_value=mock_res)
        mock_provider.get_provider_name = MagicMock(return_value="openrouter")
        mock_provider.get_model_name = MagicMock(return_value="nvidia/nemotron-3.5-lightning:free")
        mock_prov_fn.return_value = mock_provider

        res = await generate_verifiable_answer("What is interest rate?", quotes)
        assert res["status"] == "CONFLICTED"
        assert len(res["conflicts"]) == 1
        assert "DocA states 12.5%" in res["conflicts"][0]

# O. Regression test for existing Ollama provider
def test_ollama_provider_regression():
    provider = get_llm_provider("ollama")
    assert isinstance(provider, OllamaProvider)
    assert provider.get_provider_name() == "ollama"
    assert provider.get_model_name() == "qwen2.5:7b"

def json_dumps(data):
    import json
    return json.dumps(data)

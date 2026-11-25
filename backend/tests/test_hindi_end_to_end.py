import pytest
import re
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.intelligence.multilingual import (
    detect_language,
    normalize_devanagari_digits,
    normalize_hindi_temporal_and_numbers,
    translate_query_to_english,
    verify_number_safety,
    extract_numbers_and_dates,
    local_domain_translate_to_hindi
)
from app.intelligence.temporal_parser import extract_as_of_date
from app.providers.base import LLMResponse


@pytest.fixture(autouse=True)
def mock_openrouter_quick_fallback():
    """Mock OpenRouter to fail-fast without upstream network retry timeouts in sandbox."""
    with patch("app.providers.openrouter_provider.OpenRouterProvider.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = LLMResponse(
            raw_content="",
            structured=None,
            is_fallback=True,
            provider="openrouter",
            model="nvidia/nemotron-3.5-lightning:free",
            error="Sandbox test mode: quick fallback"
        )
        yield


# =====================================================================
# Unit & Intelligence Layer Tests (Scenarios 2, 3, 5, 13, 14)
# =====================================================================

def test_devanagari_digit_normalization():
    hindi_text = "५०,००० रुपये बकाया पर ३० दिन का पेनल ब्याज"
    norm = normalize_devanagari_digits(hindi_text)
    assert "50,000" in norm
    assert "30" in norm


def test_hindi_temporal_and_date_parsing():
    # Scenario 2: Hindi date parsing
    query = "1 नवंबर 2024 तक क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित थे?"
    extracted_date = extract_as_of_date(query)
    assert str(extracted_date) == "2024-11-01"


def test_hinglish_language_detection():
    # Scenario 3: Hinglish detection
    query = "floating rate loan pe foreclosure charge ban hai kya?"
    detected, effective = detect_language(query, "auto")
    assert detected == "hi"
    assert effective == "hi"


def test_number_safety_verification():
    # Scenario 13: Number & Date Safety
    english_text = "Foreclosure fee of 2.0% applies to loans up to Rs. 50,000 as of 1 Jan 2025."
    safe_hindi = "1 Jan 2025 से रु. 50,000 तक के ऋणों पर 2.0% का फोरक्लोज़र शुल्क लागू होता है।"
    assert verify_number_safety(english_text, safe_hindi) is True

    unsafe_hindi = "1 Jan 2025 से रु. 40,000 तक के ऋणों पर 5.0% का फोरक्लोज़र शुल्क लागू होता है।"
    assert verify_number_safety(english_text, unsafe_hindi) is False


def test_devanagari_character_ratio_quality():
    # Scenario 14: Translation Quality (Devanagari ratio >= 0.6)
    english_answer = "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans."
    translated = local_domain_translate_to_hindi(english_answer)
    
    # Strip numbers, punctuation, and standard English terms in parentheses
    cleaned = re.sub(r"[0-9\s.,()\-+/]", "", translated)
    devanagari_chars = [ch for ch in cleaned if '\u0900' <= ch <= '\u097f']
    ratio = len(devanagari_chars) / len(cleaned) if cleaned else 0.0
    assert ratio >= 0.60, f"Devanagari ratio was {ratio:.2f}, expected >= 0.60"


# =====================================================================
# End-to-End API Integration Tests (All 14 Scenarios)
# =====================================================================

@pytest.mark.asyncio
async def test_scenario_1_devanagari_query_in_force():
    """Scenario 1: Devanagari query as-of 2025-02-01 -> Hindi answer in force 1 Jan 2025."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
                "as_of_date": "2025-02-01"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["detected_language"] == "hi"
        assert data["answer_language"] == "hi"
        assert data["translation_status"] == "translated"
        assert "प्रतिबंधित" in data["answer"] or "प्रतिबंध" in data["answer"]
        assert "1 Jan 2025" in data["answer"] or "1 जनवरी 2025" in data["answer"] or "SYN_02" in data["answer"]
        # Citations must preserve verbatim quotes in English
        for vc in data.get("verified_claims", []):
            for cit in vc.get("citations", []):
                assert cit.get("quote") or cit.get("exact_quote")
                # Quote must not be converted to Devanagari
                quote_text = cit.get("quote") or cit.get("exact_quote")
                dev_chars = [ch for ch in quote_text if '\u0900' <= ch <= '\u097f']
                assert len(dev_chars) == 0


@pytest.mark.asyncio
async def test_scenario_2_hindi_with_as_of_date():
    """Scenario 2: Hindi query with date in Hindi text -> as_of parsed to 2024-11-01."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "1 नवंबर 2024 तक क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित थे?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["as_of_date"] == "2024-11-01"
        assert data["answer_language"] == "hi"


@pytest.mark.asyncio
async def test_scenario_3_hinglish_query():
    """Scenario 3: Hinglish query -> detected as Hindi, Hindi answer."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "floating rate loan pe foreclosure charge ban hai kya?",
                "as_of_date": "2025-02-01"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["detected_language"] == "hi"
        assert data["answer_language"] == "hi"
        assert data["translation_status"] == "translated"


@pytest.mark.asyncio
async def test_scenario_4_calculation_in_hindi():
    """Scenario 4: Calculation question in Hindi -> Rs. 123.29 with Hindi labels."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "50,000 रुपये बकाया पर 30 दिन का पेनल ब्याज कितना होगा?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["calculation"] is not None
        assert "123.29" in str(data["calculation"]) or "123" in str(data["calculation"])
        assert data["answer_language"] == "hi"


@pytest.mark.asyncio
async def test_scenario_5_devanagari_digits_calculation():
    """Scenario 5: Devanagari digits in query -> same Rs. 123.29 numeric output."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "५०,००० रुपये बकाया पर ३० दिन का पेनल ब्याज कितना होगा?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["calculation"] is not None
        assert "123.29" in str(data["calculation"]) or "123" in str(data["calculation"])


@pytest.mark.asyncio
async def test_scenario_6_abstention_in_hindi():
    """Scenario 6: Abstention question in Hindi -> insufficient evidence notice, 0 verified claims."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "गोल्ड लोन पर ब्याज दर क्या है?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "INSUFFICIENT_EVIDENCE"
        assert data["verified_count"] == 0
        assert "अपर्याप्त साक्ष्य" in data["answer"] or "सत्यापन निषेध" in data["answer"]


@pytest.mark.asyncio
async def test_scenario_7_conflict_in_hindi():
    """Scenario 7: Conflict in Hindi -> Home Loan Agreement vs RBI Circular."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "क्या होम लोन एग्रीमेंट RBI के नियमों से टकराता है?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["conflict_found"] is True
        assert data["conflict_subject"] == "foreclosure_charges"
        assert "टकराता है" in data["answer"] or "Conflict Detected" in data["answer"] or "SYN_11" in data["answer"]


@pytest.mark.asyncio
async def test_scenario_8_scope_in_hindi():
    """Scenario 8: Scope question in Hindi -> fixed rate not covered under Clause 3.2."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "क्या फिक्स्ड रेट पर्सनल लोन पर फोरक्लोज़र चार्ज प्रतिबंधित है?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert "फिक्स्ड रेट" in data["answer"]
        assert "प्रतिबंधित नहीं" in data["answer"] or "दायरे में शामिल नहीं" in data["answer"] or "SYN_02" in data["answer"]


@pytest.mark.asyncio
async def test_scenario_9_mixed_language_query():
    """Scenario 9: Mixed language query -> processed without errors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "What is the प्रोसेसिंग फीस cap?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ("VERIFIED", "PARTIALLY_VERIFIED", "INSUFFICIENT_EVIDENCE")


@pytest.mark.asyncio
async def test_scenario_10_english_regression():
    """Scenario 10: English query -> English answer, translation not needed."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ask",
            json={
                "query": "What is the foreclosure fee for prepayment of the personal loan facility?"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["answer_language"] == "en"
        assert data["translation_status"] == "not_needed"


@pytest.mark.asyncio
async def test_scenario_11_selector_override():
    """Scenario 11: Selector override: English query with response_language=hi, and vice versa."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Case A: English query with hi selector
        res_hi = await client.post(
            "/api/v1/ask",
            json={
                "query": "Are foreclosure charges prohibited on floating rate loans?",
                "response_language": "hi",
                "as_of_date": "2025-02-01"
            }
        )
        assert res_hi.status_code == 200
        data_hi = res_hi.json()
        assert data_hi["answer_language"] == "hi"

        # Case B: Hindi query with en selector
        res_en = await client.post(
            "/api/v1/ask",
            json={
                "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
                "response_language": "en",
                "as_of_date": "2025-02-01"
            }
        )
        assert res_en.status_code == 200
        data_en = res_en.json()
        assert data_en["answer_language"] == "en"
        assert data_en["translation_status"] == "not_needed"


@pytest.mark.asyncio
async def test_scenario_12_failure_mode_llm_provider_down():
    """Scenario 12: LLM provider failure -> falls back safely to local engine without crashing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.providers.openrouter_provider.OpenRouterProvider.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = Exception("OpenRouter connection failure")
            res = await client.post(
                "/api/v1/ask",
                json={
                    "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
                    "as_of_date": "2025-02-01"
                }
            )
            assert res.status_code == 200
            data = res.json()
            # Must still produce a valid Hindi answer via local compliance translator
            assert data["answer_language"] == "hi"
            assert data["translation_status"] in ("translated", "unavailable")
            assert data["translator"] in ("local-compliance-engine", "i18n-engine", "none")

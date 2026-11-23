import asyncio
import logging
from typing import Dict, Any, Optional
import httpx
import openai
from openai import AsyncOpenAI
from app.core.config import settings
from app.providers.base import BaseLLMProvider, LLMResponse
from app.providers.json_extractor import extract_and_validate_structured_output

logger = logging.getLogger("veritas.providers.openrouter")

class OpenRouterProvider(BaseLLMProvider):
    """
    OpenRouter LLM provider targeting NVIDIA Nemotron 3.5 Lightning (Free).
    Utilizes the official OpenAI Python SDK with OpenRouter base URL.
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None
    ):
        self.api_key = api_key if api_key is not None else settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL or "nvidia/nemotron-3.5-lightning:free"
        self.base_url = (base_url or settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1").rstrip("/")
        self.timeout = timeout or settings.OPENROUTER_TIMEOUT_SECONDS or 60.0
        self.max_retries = max_retries if max_retries is not None else settings.OPENROUTER_MAX_RETRIES

        self._headers = {}
        if getattr(settings, "OPENROUTER_HTTP_REFERER", None):
            self._headers["HTTP-Referer"] = settings.OPENROUTER_HTTP_REFERER
        if getattr(settings, "OPENROUTER_TITLE", None):
            self._headers["X-Title"] = settings.OPENROUTER_TITLE

        self._client: Optional[AsyncOpenAI] = None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key or "sk-dummy-key-for-init",
                timeout=self.timeout,
                default_headers=self._headers if self._headers else None
            )
        return self._client

    def get_provider_name(self) -> str:
        return "openrouter"

    def get_model_name(self) -> str:
        return self.model

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """
        Execute completion with OpenRouter, applying bounded exponential backoff
        for rate limits (429) and upstream server errors (500/502/503).
        """
        if not self.api_key or self.api_key.strip() in ("", "your_openrouter_api_key"):
            logger.warning("OpenRouter API key is not configured.")
            return LLMResponse(
                raw_content="",
                provider="openrouter",
                model=self.model,
                is_fallback=True,
                error="OpenRouter API key is not configured. Set OPENROUTER_API_KEY in environment."
            )

        client = self._get_client()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        attempt = 0
        backoff_delays = [1.0, 2.0, 4.0]
        last_error = None

        while attempt <= self.max_retries:
            attempt += 1
            try:
                response = await client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=False
                )

                choice = response.choices[0] if response.choices else None
                raw_content = choice.message.content if choice and choice.message and choice.message.content else ""
                if not raw_content and choice and choice.message:
                    reasoning_val = getattr(choice.message, "reasoning", "")
                    if isinstance(reasoning_val, str):
                        raw_content = reasoning_val
                
                usage_info = None
                if getattr(response, "usage", None):
                    usage_info = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }

                structured = extract_and_validate_structured_output(raw_content)

                return LLMResponse(
                    raw_content=raw_content or "",
                    structured=structured,
                    provider="openrouter",
                    model=self.model,
                    is_fallback=False,
                    usage=usage_info
                )

            except openai.AuthenticationError as e:
                logger.error(f"OpenRouter Authentication Error: {e.message if hasattr(e, 'message') else e}")
                return LLMResponse(
                    raw_content="",
                    provider="openrouter",
                    model=self.model,
                    is_fallback=True,
                    status_code=401,
                    error="Invalid or expired OpenRouter API key."
                )

            except openai.RateLimitError as e:
                last_error = f"Rate limit reached (429): {e.message if hasattr(e, 'message') else e}"
                logger.warning(f"OpenRouter rate limit on attempt {attempt}: {last_error}")
                if attempt <= self.max_retries:
                    delay = backoff_delays[min(attempt - 1, len(backoff_delays) - 1)]
                    await asyncio.sleep(delay)
                    continue

            except (openai.APITimeoutError, httpx.TimeoutException) as e:
                last_error = f"Request timed out: {e}"
                logger.warning(f"OpenRouter timeout on attempt {attempt}: {last_error}")
                if attempt <= self.max_retries:
                    delay = backoff_delays[min(attempt - 1, len(backoff_delays) - 1)]
                    await asyncio.sleep(delay)
                    continue

            except (openai.InternalServerError, openai.APIConnectionError) as e:
                last_error = f"Upstream API failure: {e}"
                logger.warning(f"OpenRouter server error on attempt {attempt}: {last_error}")
                if attempt <= self.max_retries:
                    delay = backoff_delays[min(attempt - 1, len(backoff_delays) - 1)]
                    await asyncio.sleep(delay)
                    continue

            except Exception as e:
                logger.error(f"Unhandled OpenRouter exception: {type(e).__name__}: {e}")
                return LLMResponse(
                    raw_content="",
                    provider="openrouter",
                    model=self.model,
                    is_fallback=True,
                    error=f"OpenRouter invocation failed: {type(e).__name__}"
                )

        return LLMResponse(
            raw_content="",
            provider="openrouter",
            model=self.model,
            is_fallback=True,
            error=f"OpenRouter failed after {self.max_retries} retries. Last error: {last_error}"
        )

    async def check_health(self, check_connectivity: bool = False) -> Dict[str, Any]:
        """
        Health status check. Does not burn generation tokens by default.
        When check_connectivity=True, tests the models endpoint.
        """
        has_key = bool(self.api_key and self.api_key.strip() not in ("", "your_openrouter_api_key"))
        masked_key = f"{self.api_key[:6]}...{self.api_key[-4:]}" if has_key and len(self.api_key) > 10 else ("configured" if has_key else "missing")

        result = {
            "provider": "openrouter",
            "model": self.model,
            "base_url": self.base_url,
            "api_key_configured": has_key,
            "api_key_status": masked_key,
            "status": "configured" if has_key else "missing_key",
            "details": "OpenRouter configured with Nemotron 3.5 Lightning (Free)." if has_key else "OPENROUTER_API_KEY environment variable is not set."
        }

        if check_connectivity:
            if not has_key:
                result["reachable"] = False
                result["status"] = "missing_key"
                result["details"] = "Cannot test reachability: API key is not configured."
                return result

            try:
                client = self._get_client()
                # Test connectivity using lightweight models list endpoint
                await client.models.list()
                result["reachable"] = True
                result["status"] = "ready"
                result["details"] = f"Successfully authenticated with OpenRouter. Model '{self.model}' ready."
            except openai.AuthenticationError:
                result["reachable"] = False
                result["status"] = "invalid_key"
                result["details"] = "OpenRouter authentication failed: API key was rejected."
            except Exception as e:
                result["reachable"] = False
                result["status"] = "unreachable"
                result["details"] = f"OpenRouter connectivity check failed: {type(e).__name__}"

        return result

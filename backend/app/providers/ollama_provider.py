import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings
from app.providers.base import BaseLLMProvider, LLMResponse
from app.providers.json_extractor import extract_and_validate_structured_output

logger = logging.getLogger("veritas.providers.ollama")

class OllamaProvider(BaseLLMProvider):
    """
    Retained local Ollama provider for offline development and local inference.
    """
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL or "http://localhost:11434").rstrip("/")
        self.model = model or settings.OLLAMA_MODEL or "qwen2.5:7b"
        self.timeout = timeout

    def get_provider_name(self) -> str:
        return "ollama"

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
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "system": system_prompt,
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": temperature}
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw = data.get("response", "")
                    structured = extract_and_validate_structured_output(raw)
                    return LLMResponse(
                        raw_content=raw,
                        structured=structured,
                        provider="ollama",
                        model=self.model,
                        is_fallback=False
                    )
                else:
                    return LLMResponse(
                        raw_content="",
                        provider="ollama",
                        model=self.model,
                        is_fallback=True,
                        status_code=resp.status_code,
                        error=f"Ollama returned HTTP status {resp.status_code}"
                    )
        except Exception as e:
            logger.warning(f"Ollama generation failed: {e}")
            return LLMResponse(
                raw_content="",
                provider="ollama",
                model=self.model,
                is_fallback=True,
                error=f"Ollama connection error: {e}"
            )

    async def check_health(self, check_connectivity: bool = False) -> Dict[str, Any]:
        result = {
            "provider": "ollama",
            "model": self.model,
            "base_url": self.base_url,
            "api_key_configured": True,
            "status": "configured",
            "details": f"Local Ollama provider targeting {self.model} at {self.base_url}"
        }
        if check_connectivity:
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    resp = await client.get(f"{self.base_url}/api/tags")
                    if resp.status_code == 200:
                        tags = resp.json().get("models", [])
                        names = [m.get("name") for m in tags]
                        result["reachable"] = True
                        result["status"] = "ready"
                        result["available_models"] = names
                    else:
                        result["reachable"] = False
                        result["status"] = "unhealthy"
            except Exception as e:
                result["reachable"] = False
                result["status"] = "offline"
                result["details"] = f"Ollama offline: {e}"
        return result

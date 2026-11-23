import logging
from typing import Optional
from app.core.config import settings
from app.providers.base import BaseLLMProvider
from app.providers.openrouter_provider import OpenRouterProvider
from app.providers.ollama_provider import OllamaProvider

logger = logging.getLogger("veritas.providers.factory")

_cached_provider: Optional[BaseLLMProvider] = None

def get_llm_provider(provider_type: Optional[str] = None) -> BaseLLMProvider:
    """
    Factory to resolve and instantiate the configured LLM provider.
    Defaults to OpenRouter (NVIDIA Nemotron 3.5 Lightning Free).
    """
    selected_type = (
        provider_type
        or getattr(settings, "LLM_PROVIDER", None)
        or getattr(settings, "AI_PROVIDER", None)
        or "openrouter"
    ).lower().strip()

    if selected_type in ("openrouter", "nemotron"):
        return OpenRouterProvider()
    elif selected_type in ("ollama", "local"):
        return OllamaProvider()
    else:
        logger.warning(f"Unrecognized LLM provider '{selected_type}'. Defaulting to OpenRouter.")
        return OpenRouterProvider()

from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field

class LLMClaim(BaseModel):
    claim: str
    evidence_ids: List[str] = Field(default_factory=list)
    verification_status: str = "UNVERIFIED"

class LLMStructuredOutput(BaseModel):
    answer: str = ""
    status: str = "VERIFIED"  # VERIFIED, PARTIALLY_VERIFIED, CONFLICTED, INSUFFICIENT_EVIDENCE
    claims: List[LLMClaim] = Field(default_factory=list)
    conflicts: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    requires_human_review: bool = False
    insufficient_evidence: bool = False
    missing_info: Optional[str] = None
    calculation: Optional[Dict[str, Any]] = None

class LLMResponse(BaseModel):
    raw_content: str = ""
    structured: Optional[LLMStructuredOutput] = None
    provider: str
    model: str
    is_fallback: bool = False
    usage: Optional[Dict[str, int]] = None
    error: Optional[str] = None
    status_code: Optional[int] = None

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        **kwargs
    ) -> LLMResponse:
        """Execute text generation with the underlying model."""
        pass

    @abstractmethod
    async def check_health(self, check_connectivity: bool = False) -> Dict[str, Any]:
        """Report configuration, model details, and optional reachability."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return provider identifier (e.g. openrouter, ollama)."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return configured model name."""
        pass

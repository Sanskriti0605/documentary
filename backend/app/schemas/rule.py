from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class RuleFactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    clause_id: str
    subject: str
    attribute: str
    operator: Optional[str] = "EQUALS"
    value: str
    unit: Optional[str] = None
    condition: Optional[str] = None
    extraction_status: str
    verified_by_human: bool
    created_at: datetime

class RuleListResponse(BaseModel):
    total: int
    rules: List[RuleFactResponse]

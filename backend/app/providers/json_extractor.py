import re
import json
import logging
from typing import Optional, Dict, Any
from app.providers.base import LLMStructuredOutput, LLMClaim

logger = logging.getLogger("veritas.json_extractor")

def sanitize_json_string(raw: str) -> str:
    """Strip markdown codeblocks, thinking tokens, and extra whitespace."""
    if not raw:
        return ""
    text = raw.strip()
    
    # Remove thinking tags e.g. <think>...</think> if emitted by reasoning models
    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
    
    # Extract from markdown json code fence (pick the candidate that contains JSON structure)
    matches = list(re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE))
    for m in reversed(matches):
        cand = m.group(1).strip()
        if "{" in cand and "}" in cand:
            text = cand
            break
        elif "{" in cand:
            text = cand
            break
        
    # Find outer bracket boundaries
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]
    elif start_idx != -1 and (end_idx == -1 or end_idx < start_idx):
        text = text[start_idx:]
        
    return text

def repair_json_string(json_str: str) -> str:
    """Apply stack-based heuristic to repair trailing commas and unclosed brackets/braces."""
    # 1. Remove trailing commas before closing braces/brackets
    repaired = re.sub(r",\s*([}\]])", r"\1", json_str)
    
    # 2. Track open structural brackets outside of string literals
    stack = []
    in_string = False
    escape = False
    
    for ch in repaired:
        if ch == '"' and not escape:
            in_string = not in_string
        elif ch == '\\' and in_string:
            escape = not escape
            continue
        elif not in_string:
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
        escape = False

    # If terminated inside an unclosed string literal, close the string first
    if in_string:
        repaired += '"'

    # Close open structures in reverse order
    closing_map = {'{': '}', '[': ']'}
    while stack:
        open_bracket = stack.pop()
        repaired += closing_map.get(open_bracket, '')
        
    return repaired

def extract_and_validate_structured_output(raw_content: str) -> Optional[LLMStructuredOutput]:
    """
    Robustly parse and validate structured JSON output from LLM response.
    Nemotron 3.5 Lightning (Free) does not guarantee strict JSON via response_format.
    """
    if not raw_content:
        return None
        
    cleaned = sanitize_json_string(raw_content)
    parsed_dict: Optional[Dict[str, Any]] = None
    
    # Attempt 1: Direct JSON parse
    try:
        parsed_dict = json.loads(cleaned)
    except json.JSONDecodeError:
        # Attempt 2: Repaired JSON parse
        try:
            repaired = repair_json_string(cleaned)
            parsed_dict = json.loads(repaired)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM JSON after repair: {e}")
            return None
            
    if not isinstance(parsed_dict, dict):
        return None
        
    # Normalize schema differences (e.g. text/quote_ids vs claim/evidence_ids)
    raw_claims = parsed_dict.get("claims", [])
    normalized_claims = []
    
    if isinstance(raw_claims, list):
        for c in raw_claims:
            if isinstance(c, dict):
                claim_text = c.get("claim") or c.get("text") or ""
                ev_ids = c.get("evidence_ids") or c.get("quote_ids") or []
                if isinstance(ev_ids, str):
                    ev_ids = [ev_ids]
                v_status = c.get("verification_status") or "UNVERIFIED"
                normalized_claims.append(
                    LLMClaim(claim=claim_text, evidence_ids=ev_ids, verification_status=v_status)
                )
            elif isinstance(c, str):
                normalized_claims.append(
                    LLMClaim(claim=c, evidence_ids=[], verification_status="UNVERIFIED")
                )
                
    ans = parsed_dict.get("answer") or ""
    if not ans and normalized_claims:
        ans = " ".join([cl.claim for cl in normalized_claims if cl.claim])
        
    st = parsed_dict.get("status") or "VERIFIED"
    if st not in ("VERIFIED", "PARTIALLY_VERIFIED", "CONFLICTED", "INSUFFICIENT_EVIDENCE"):
        st = "VERIFIED"
        
    insufficient = bool(parsed_dict.get("insufficient_evidence", False) or st == "INSUFFICIENT_EVIDENCE")
    if insufficient:
        st = "INSUFFICIENT_EVIDENCE"

    conflicts = parsed_dict.get("conflicts") or []
    if isinstance(conflicts, str):
        conflicts = [conflicts]

    limitations = parsed_dict.get("limitations") or []
    if isinstance(limitations, str):
        limitations = [limitations]

    missing_info = parsed_dict.get("missing_info")
    if isinstance(missing_info, list):
        missing_info = ", ".join(str(x) for x in missing_info) if missing_info else None
    elif not isinstance(missing_info, str):
        missing_info = None

    try:
        return LLMStructuredOutput(
            answer=ans,
            status=st,
            claims=normalized_claims,
            conflicts=conflicts,
            limitations=limitations,
            requires_human_review=bool(parsed_dict.get("requires_human_review", False)),
            insufficient_evidence=insufficient,
            missing_info=missing_info,
            calculation=parsed_dict.get("calculation")
        )
    except Exception as e:
        logger.warning(f"Error instantiating LLMStructuredOutput: {e}")
        return LLMStructuredOutput(
            answer=ans,
            status=st,
            claims=normalized_claims,
            conflicts=conflicts,
            limitations=limitations
        )

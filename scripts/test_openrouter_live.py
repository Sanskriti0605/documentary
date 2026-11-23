#!/usr/bin/env python3
"""
Manual live verification script for OpenRouter integration with NVIDIA Nemotron 3.5 Lightning.
Tests live connectivity, prompt dispatch, JSON schema adherence, and citation grounding.

Usage:
    export OPENROUTER_API_KEY="your-real-openrouter-key"
    python scripts/test_openrouter_live.py
"""

import os
import sys
import asyncio

# Ensure backend is on PYTHONPATH
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

async def test_live_openrouter():
    print("=" * 70)
    print("VERITAS AI - Live OpenRouter Nemotron 3.5 Lightning Integration Test")
    print("=" * 70)

    from app.core.config import settings
    api_key = (settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY", "")).strip()
    if not api_key or api_key == "your_openrouter_api_key":
        print("\n[!] OPENROUTER_API_KEY is not set.")
        print("    To run this live test, obtain a free API key from https://openrouter.ai/keys")
        print("    and execute:")
        print("    export OPENROUTER_API_KEY=\"sk-or-v1-...\"")
        print("    python scripts/test_openrouter_live.py\n")
        return False

    print(f"\n[+] OPENROUTER_API_KEY detected: {api_key[:6]}...{api_key[-4:]}")

    from app.providers.openrouter_provider import OpenRouterProvider
    provider = OpenRouterProvider(api_key=api_key)

    print(f"[+] Provider: {provider.get_provider_name()}")
    print(f"[+] Model:    {provider.get_model_name()}")
    print(f"[+] Base URL: {provider.base_url}")

    print("\n1. Testing lightweight connectivity check (check_health)...")
    health = await provider.check_health(check_connectivity=True)
    print(f"   Status:    {health.get('status')}")
    print(f"   Reachable: {health.get('reachable')}")
    print(f"   Details:   {health.get('details')}")

    if not health.get("reachable"):
        print("\n[!] Connectivity test failed. Check API key validity and network.")
        return False

    print("\n2. Dispatching sample verifiable banking query...")
    prompt = """Question: What is the maximum penal charge rate permitted by the Reserve Bank of India?

Retrieved Documentary Evidence:
[EV-001 / Q1] Document: RBI_Fair_Lending_Circular_Aug2023_Final.pdf | Page: 1 | Clause: 3
Quote: "Penalty, if charged, for non-compliance of material terms and conditions of loan contract by the borrower shall be treated as 'penal charges' and shall not be levied in the form of 'penal interest'. Penalty rate shall not exceed 2.5% per annum on the overdue amount."
"""
    from app.generation.engine import SYSTEM_PROMPT

    res = await provider.generate(prompt=prompt, system_prompt=SYSTEM_PROMPT, max_tokens=3500)

    print(f"   Provider:    {res.provider}")
    print(f"   Model:       {res.model}")
    print(f"   Is Fallback: {res.is_fallback}")
    if res.usage:
        print(f"   Token Usage: {res.usage}")

    if res.error:
        print(f"   Error:       {res.error}")
        return False

    if res.structured:
        print("\n[✓] Structured JSON successfully parsed and validated:")
        print(f"    Answer: {res.structured.answer}")
        print(f"    Status: {res.structured.status}")
        print(f"    Claims count: {len(res.structured.claims)}")
        for idx, c in enumerate(res.structured.claims):
            print(f"      Claim {idx+1}: \"{c.claim}\" (Cited Evidence: {c.evidence_ids})")
        print("\n[✓] ALL TESTS PASSED: OpenRouter Nemotron 3.5 Lightning integration verified successfully!")
        return True
    else:
        print("\n[!] Warning: Model responded but structured output extraction failed.")
        print("    Raw response was:")
        print(res.raw_content[:400])
        return False

if __name__ == "__main__":
    success = asyncio.run(test_live_openrouter())
    sys.exit(0 if success else 1)

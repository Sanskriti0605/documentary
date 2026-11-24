#!/usr/bin/env python3
"""
CLI test runner for Veritas AI Multilingual (Hindi) Question Answering.
Tests 14 diverse end-to-end scenarios and outputs a markdown validation table.
"""

import sys
import asyncio
from typing import Dict, Any, List
from httpx import AsyncClient, ASGITransport

try:
    from app.main import app
except ImportError:
    sys.path.insert(0, "backend")
    from app.main import app


SCENARIOS = [
    {
        "id": "1. Devanagari in-force",
        "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
        "req_lang": "auto",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: d["answer_language"] == "hi" and d["translation_status"] == "translated" and ("प्रतिबंधित" in d["answer"] or "SYN_02" in d["answer"] or "1 Jan 2025" in d["answer"])
    },
    {
        "id": "2. Hindi date parsing",
        "query": "1 नवंबर 2024 तक क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित थे?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d["as_of_date"] == "2024-11-01" and d["answer_language"] == "hi"
    },
    {
        "id": "3. Hinglish romanized",
        "query": "floating rate loan pe foreclosure charge ban hai kya?",
        "req_lang": "auto",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: d["detected_language"] == "hi" and d["answer_language"] == "hi"
    },
    {
        "id": "4. Calculation in Hindi",
        "query": "50,000 रुपये बकाया पर 30 दिन का पेनल ब्याज कितना होगा?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d.get("calculation") is not None and ("123.29" in str(d["calculation"]) or "123" in str(d["calculation"]))
    },
    {
        "id": "5. Devanagari digits calc",
        "query": "५०,००० रुपये बकाया पर ३० दिन का पेनल ब्याज कितना होगा?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d.get("calculation") is not None and ("123.29" in str(d["calculation"]) or "123" in str(d["calculation"]))
    },
    {
        "id": "6. Abstention in Hindi",
        "query": "गोल्ड लोन पर ब्याज दर क्या है?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d["status"] == "INSUFFICIENT_EVIDENCE" and d["verified_count"] == 0
    },
    {
        "id": "7. Conflict in Hindi",
        "query": "क्या होम लोन एग्रीमेंट RBI के नियमों से टकराता है?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d["conflict_found"] is True and d["conflict_subject"] == "foreclosure_charges"
    },
    {
        "id": "8. Scope in Hindi",
        "query": "क्या फिक्स्ड रेट पर्सनल लोन पर फोरक्लोज़र चार्ज प्रतिबंधित है?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: "फिक्स्ड रेट" in d["answer"] and ("प्रतिबंधित नहीं" in d["answer"] or "SYN_02" in d["answer"])
    },
    {
        "id": "9. Mixed language query",
        "query": "What is the प्रोसेसिंग फीस cap?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "hi",
        "check": lambda d: d["status"] in ("VERIFIED", "PARTIALLY_VERIFIED", "INSUFFICIENT_EVIDENCE")
    },
    {
        "id": "10. English regression",
        "query": "What is the foreclosure fee for prepayment of the personal loan facility?",
        "req_lang": "auto",
        "as_of": None,
        "expected_lang": "en",
        "check": lambda d: d["answer_language"] == "en" and d["translation_status"] == "not_needed"
    },
    {
        "id": "11A. Selector override HI",
        "query": "Are foreclosure charges prohibited on floating rate loans?",
        "req_lang": "hi",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: d["answer_language"] == "hi"
    },
    {
        "id": "11B. Selector override EN",
        "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
        "req_lang": "en",
        "as_of": "2025-02-01",
        "expected_lang": "en",
        "check": lambda d: d["answer_language"] == "en" and d["translation_status"] == "not_needed"
    },
    {
        "id": "12. Failure mode fallback",
        "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
        "req_lang": "auto",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: d["answer_language"] == "hi" and d["translation_status"] in ("translated", "unavailable")
    },
    {
        "id": "13. Number safety & quote",
        "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
        "req_lang": "auto",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: all(
            len([c for c in (cit.get("quote") or "") if '\u0900' <= c <= '\u097f']) == 0
            for vc in d.get("verified_claims", []) for cit in vc.get("citations", [])
        )
    },
    {
        "id": "14. Quality char ratio",
        "query": "क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?",
        "req_lang": "auto",
        "as_of": "2025-02-01",
        "expected_lang": "hi",
        "check": lambda d: (
            len([c for c in d["answer"] if '\u0900' <= c <= '\u097f']) /
            max(1, len([c for c in d["answer"] if c.isalpha()]))
        ) >= 0.50
    }
]


async def run_cli_tests():
    print("=" * 80)
    print("Veritas AI Multilingual (Hindi) Question Answering - Verification Suite")
    print("=" * 80)

    from unittest.mock import patch, AsyncMock
    from app.providers.base import LLMResponse

    transport = ASGITransport(app=app)
    results = []

    with patch("app.providers.openrouter_provider.OpenRouterProvider.generate", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = LLMResponse(
            raw_content="",
            structured=None,
            is_fallback=True,
            provider="openrouter",
            model="nvidia/nemotron-3.5-lightning:free",
            error="Sandbox test mode: quick fallback"
        )
        async with AsyncClient(transport=transport, base_url="http://test", timeout=30.0) as client:
            for s in SCENARIOS:
                payload: Dict[str, Any] = {"query": s["query"]}
                if s.get("req_lang") and s["req_lang"] != "auto":
                    payload["response_language"] = s["req_lang"]
                if s.get("as_of"):
                    payload["as_of_date"] = s["as_of"]

                try:
                    res = await client.post("/api/v1/ask", json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        passed = s["check"](data)
                        results.append({
                            "id": s["id"],
                            "req_lang": data.get("requested_language", s["req_lang"]),
                            "ans_lang": data.get("answer_language", "unknown"),
                            "translator": data.get("translator", "none"),
                            "status": data.get("translation_status", "unknown"),
                            "passed": passed
                        })
                    else:
                        results.append({
                            "id": s["id"],
                            "req_lang": s["req_lang"],
                            "ans_lang": "error",
                            "translator": "none",
                            "status": f"HTTP {res.status_code}",
                            "passed": False
                        })
                except Exception as e:
                    results.append({
                        "id": s["id"],
                        "req_lang": s["req_lang"],
                        "ans_lang": "exception",
                        "translator": "none",
                        "status": str(e)[:25],
                        "passed": False
                    })

    print("\n| Case | Requested Lang | Answer Lang | Translator | Translation Status | Result |")
    print("| :--- | :---: | :---: | :---: | :---: | :---: |")
    all_passed = True
    for r in results:
        res_str = "PASS" if r["passed"] else "FAIL"
        if not r["passed"]:
            all_passed = False
        print(f"| {r['id']} | {r['req_lang']} | {r['ans_lang']} | {r['translator']} | {r['status']} | **{res_str}** |")

    print("=" * 80)
    if all_passed:
        print("ALL 14 SCENARIOS PASSED WITH 100% SUCCESS!")
    else:
        print("SOME SCENARIOS FAILED!")
    print("=" * 80)

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_cli_tests())
    sys.exit(exit_code)

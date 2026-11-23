import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_eval_benchmark_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/eval/run")
        assert res.status_code == 200
        data = res.json()
        assert data["total_test_cases"] == 5
        assert data["passed"] == 5
        assert data["accuracy_percentage"] == 100.0

@pytest.mark.asyncio
async def test_ask_endpoint_with_retrieval():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        req = {
            "query": "What is the agreed rate of interest for personal loan?",
            "as_of_date": "2026-01-01"
        }
        res = await client.post("/api/v1/ask", json=req)
        assert res.status_code == 200
        data = res.json()
        assert "faithfulness_score" in data
        assert "generated_count" in data
        assert "blocked_count" in data

@pytest.mark.asyncio
async def test_pdf_rendering_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/pdf/BNB_Personal_Loan_Agreement.pdf/page/1")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"

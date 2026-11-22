import io
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database.init_db import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await init_db()

@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "VERITAS AI"
        assert data["health_check"] == "/api/v1/health"

@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
        assert data["database"] == "connected"
        assert data["storage_writable"] is True

@pytest.mark.asyncio
async def test_analytics_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/analytics")
        assert response.status_code == 200
        data = response.json()
        assert "total_documents" in data
        assert "processed_documents" in data
        assert "extracted_clauses" in data
        assert "active_amendments" in data
        assert "detected_conflicts" in data

@pytest.mark.asyncio
async def test_documents_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a dummy PDF content
        dummy_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
        files = {"file": ("test_policy.pdf", io.BytesIO(dummy_pdf), "application/pdf")}
        data = {"document_type": "BANK_LOAN_POLICY", "domain": "RETAIL_LENDING", "issuer": "Bharat National Bank"}

        # Upload
        res = await client.post("/api/v1/documents/upload", files=files, data=data)
        assert res.status_code == 201
        doc_data = res.json()
        doc_id = doc_data["id"]
        assert doc_data["name"] == "test_policy.pdf"
        assert doc_data["document_type"] == "BANK_LOAN_POLICY"
        assert doc_data["status"] == "UPLOADED"

        # List
        list_res = await client.get("/api/v1/documents")
        assert list_res.status_code == 200
        docs = list_res.json()["documents"]
        assert any(d["id"] == doc_id for d in docs)

        # Get by ID
        get_res = await client.get(f"/api/v1/documents/{doc_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == doc_id

        # Delete
        del_res = await client.delete(f"/api/v1/documents/{doc_id}")
        assert del_res.status_code == 204

@pytest.mark.asyncio
async def test_conflicts_list_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/conflicts")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "conflicts" in data

@pytest.mark.asyncio
async def test_amendments_graph_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/amendments/graph")
        assert response.status_code == 200
        data = response.json()
        assert "nodes" in data
        assert "edges" in data

@pytest.mark.asyncio
async def test_rules_current_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/rules/current")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "rules" in data

@pytest.mark.asyncio
async def test_query_abstention_on_empty_evidence():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        req = {"query": "What is the penal charge for personal loan default in 2026?"}
        res = await client.post("/api/v1/query", json=req)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "INSUFFICIENT_EVIDENCE"
        assert "insufficient" in data["answer"].lower()

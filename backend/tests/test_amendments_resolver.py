import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_penal_charges_chain_draft_phase():
    """
    Test as_of = 2023-06-01:
    The Draft circular (Apr 12, 2023) is DRAFT_NON_BINDING.
    The baseline bank policy (BNB_Retail_Loan_Policy_2023.pdf) is IN_FORCE.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2023-06-01")
        assert res.status_code == 200
        data = res.json()
        assert data["rule"] == "penal_charges"
        assert data["as_of"] == "2023-06-01"

        # Check draft node is DRAFT_NON_BINDING
        draft_node = next(c for c in data["chain"] if "draft" in c["document_name"].lower())
        assert draft_node["status"] == "DRAFT_NON_BINDING"

        # Check version in force is the binding baseline bank policy
        in_force = data["version_in_force"]
        assert in_force is not None
        assert in_force["document_name"] == "BNB_Retail_Loan_Policy_2023.pdf"
        assert in_force["status"] == "IN_FORCE"

@pytest.mark.asyncio
async def test_penal_charges_chain_future_effective_phase():
    """
    Test as_of = 2023-11-01:
    The Final circular was published on Aug 18, 2023, but has effective date 2024-01-01.
    Therefore, it is FUTURE_EFFECTIVE and baseline policy remains IN_FORCE.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2023-11-01")
        assert res.status_code == 200
        data = res.json()

        final_circ = next(c for c in data["chain"] if "Aug2023" in c["document_name"] or "Fair_Lending" in c["document_name"])
        assert final_circ["status"] == "FUTURE_EFFECTIVE"

        # Baseline policy is still in force
        assert data["version_in_force"]["document_name"] == "BNB_Retail_Loan_Policy_2023.pdf"

@pytest.mark.asyncio
async def test_penal_charges_chain_extension_phase():
    """
    Test as_of = 2024-01-15:
    The Dec 29, 2023 circular extended implementation timeline to 2024-04-01.
    Therefore, on Jan 15, 2024, the circular instructions are still FUTURE_EFFECTIVE.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2024-01-15")
        assert res.status_code == 200
        data = res.json()

        ext_circ = next(c for c in data["chain"] if "Dec2023" in c["document_name"] or "Extension" in c["document_name"])
        assert ext_circ["status"] == "FUTURE_EFFECTIVE"
        assert data["version_in_force"]["document_name"] == "BNB_Retail_Loan_Policy_2023.pdf"

@pytest.mark.asyncio
async def test_penal_charges_chain_fully_in_force_phase():
    """
    Test as_of = 2024-05-01:
    After the extended implementation date (2024-04-01), the RBI circular regime is fully IN_FORCE.
    The baseline bank policy is now SUPERSEDED.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2024-05-01")
        assert res.status_code == 200
        data = res.json()

        in_force = data["version_in_force"]
        assert in_force is not None
        assert "RBI_Extension_Circular" in in_force["document_name"] or "RBI" in in_force["document_name"]
        assert in_force["status"] == "IN_FORCE"
        assert in_force["applicability_conditions"] is not None
        assert "All Regulated Entities" in in_force["applicability_conditions"]["lender_type"]

        # Prior policy is now superseded
        baseline = next(c for c in data["chain"] if c["document_name"] == "BNB_Retail_Loan_Policy_2023.pdf")
        assert baseline["status"] == "SUPERSEDED"

@pytest.mark.asyncio
async def test_penal_charges_chain_partial_amendment():
    """
    Test as_of = 2025-01-15:
    BNB_Loan_Policy_Amendment_2025.pdf is IN_FORCE.
    It is marked as is_partial_amendment = True and references inherited terms.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2025-01-15")
        assert res.status_code == 200
        data = res.json()

        in_force = data["version_in_force"]
        assert in_force["document_name"] == "BNB_Loan_Policy_Amendment_2025.pdf"
        assert in_force["is_partial_amendment"] is True
        assert in_force["inherited_from_document"] == "BNB_Retail_Loan_Policy_2023.pdf"
        assert "In partial modification of Clause 4.1" in in_force["amending_quote"]

@pytest.mark.asyncio
async def test_withdrawn_document_handling():
    """
    Test that a withdrawn document has status WITHDRAWN and cannot be IN_FORCE.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/amendments?rule=penal_charges&as_of=2024-05-01")
        assert res.status_code == 200
        data = res.json()
        for node in data["chain"]:
            if node["status"] == "WITHDRAWN":
                assert data["version_in_force"]["document_name"] != node["document_name"]


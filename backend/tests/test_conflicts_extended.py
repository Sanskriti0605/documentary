import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_conflicts_scan_and_deduplication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Trigger initial scan
        scan_res_1 = await client.post("/api/v1/conflicts/scan")
        assert scan_res_1.status_code == 200
        data_1 = scan_res_1.json()
        assert "scanned_clauses" in data_1
        assert "new_conflicts" in data_1
        assert "total_conflicts" in data_1
        assert data_1["total_conflicts"] > 0
        total_after_first = data_1["total_conflicts"]

        # 2. Trigger second scan to test de-duplication
        scan_res_2 = await client.post("/api/v1/conflicts/scan")
        assert scan_res_2.status_code == 200
        data_2 = scan_res_2.json()
        # No new conflicts should be created on second identical scan
        assert data_2["new_conflicts"] == 0
        assert data_2["total_conflicts"] == total_after_first

@pytest.mark.asyncio
async def test_conflicts_filtering_and_summary():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Fetch conflicts with summary
        res = await client.get("/api/v1/conflicts")
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "conflicts" in data
        assert "summary" in data
        assert data["summary"]["total"] >= len(data["conflicts"])

        # Filter by subject
        subject_res = await client.get("/api/v1/conflicts?subject=rate")
        assert subject_res.status_code == 200
        filtered_data = subject_res.json()
        for c in filtered_data["conflicts"]:
            if c.get("subject"):
                assert "rate" in c["subject"].lower()

@pytest.mark.asyncio
async def test_conflicts_patch_status_transitions_and_history():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get first conflict
        list_res = await client.get("/api/v1/conflicts?limit=1")
        assert list_res.status_code == 200
        conflicts = list_res.json()["conflicts"]
        assert len(conflicts) > 0
        conflict = conflicts[0]
        c_id = conflict["id"]

        # 1. Test invalid status
        bad_res = await client.patch(f"/api/v1/conflicts/{c_id}", json={
            "resolution_status": "INVALID_STATUS_TEST",
            "resolution_notes": "Testing invalid status rejection"
        })
        assert bad_res.status_code == 400
        assert "Invalid resolution status" in bad_res.json()["detail"]

        # 2. Test valid resolution by amendment with linked document
        patch_res = await client.patch(f"/api/v1/conflicts/{c_id}", json={
            "resolution_status": "RESOLVED_AMENDMENT",
            "resolution_notes": "Reconciled against 2025 policy amendment circular.",
            "linked_document_name": "BNB_Loan_Policy_Amendment_2025.pdf"
        })
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["resolution_status"] == "RESOLVED_AMENDMENT"
        assert updated["linked_document_name"] == "BNB_Loan_Policy_Amendment_2025.pdf"
        assert "Reconciled against 2025 policy amendment" in updated["resolution_notes"]
        assert len(updated["history"]) >= 1
        latest_history = updated["history"][-1]
        assert latest_history["new_status"] == "RESOLVED_AMENDMENT"
        assert latest_history["linked_document_name"] == "BNB_Loan_Policy_Amendment_2025.pdf"

        # 3. Test status transition to DISMISSED
        patch_res_2 = await client.patch(f"/api/v1/conflicts/{c_id}", json={
            "resolution_status": "DISMISSED",
            "resolution_notes": "Reviewed and dismissed as compatible commercial context."
        })
        assert patch_res_2.status_code == 200
        updated_2 = patch_res_2.json()
        assert updated_2["resolution_status"] == "DISMISSED"
        assert len(updated_2["history"]) >= 2
        assert updated_2["history"][-1]["new_status"] == "DISMISSED"

        # 4. Test reopening to PENDING_REVIEW
        reopen_res = await client.patch(f"/api/v1/conflicts/{c_id}", json={
            "resolution_status": "PENDING_REVIEW",
            "resolution_notes": "Reopening conflict for additional regulatory review."
        })
        assert reopen_res.status_code == 200
        assert reopen_res.json()["resolution_status"] == "PENDING_REVIEW"

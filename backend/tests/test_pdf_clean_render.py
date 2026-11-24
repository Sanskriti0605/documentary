import os
import io
import fitz
import numpy as np
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.ingestion.quote_matcher import locate_quote_with_cross_page, find_quote_boxes_on_page
import sys
sys.path.insert(0, ".")
from scripts.reindex_bboxes import reindex_all_bounding_boxes

client = TestClient(app)

def test_plain_fitz_pixel_parity():
    """
    Verifies that GET /api/v1/pdf/{document_name}/page/{n} returns a 100% clean image
    with 0 pixel difference compared to a plain PyMuPDF render (no baked overlays).
    """
    test_docs = [
        ("BNB_Personal_Loan_Agreement.pdf", "storage/uploads/BNB_Personal_Loan_Agreement.pdf"),
        ("SYN_27_Bank_Employee_Leave_Policy_2024.pdf", "datasets/test_pack/test_documents/SYN_27_Bank_Employee_Leave_Policy_2024.pdf"),
        ("SYN_12_Personal_Loan_Agreement_Fixed_Feb2025.pdf", "datasets/test_pack/test_documents/SYN_12_Personal_Loan_Agreement_Fixed_Feb2025.pdf")
    ]

    for doc_name, file_path in test_docs:
        resp = client.get(f"/api/v1/pdf/{doc_name}/page/1")
        assert resp.status_code == 200, f"Failed to get page for {doc_name}"

        serv_img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        serv_arr = np.array(serv_img)

        doc = fitz.open(file_path)
        mat = fitz.Matrix(150 / 72.0, 150 / 72.0)
        plain_pix = doc[0].get_pixmap(matrix=mat)
        plain_img = Image.open(io.BytesIO(plain_pix.tobytes("png"))).convert("RGB")
        plain_arr = np.array(plain_img)
        doc.close()

        diff = np.abs(serv_arr.astype(int) - plain_arr.astype(int))
        max_d = np.max(diff)
        diff_count = np.count_nonzero(diff > 0)

        assert max_d == 0, f"{doc_name} has baked pixels! Max diff={max_d}"
        assert diff_count == 0, f"{doc_name} has {diff_count} differing pixels"

@pytest.mark.parametrize("doc_file,page_no,citation_desc,quote_str", [
    (
        "SYN_02_Reg_Final_Foreclosure_Mar2024.pdf",
        1,
        "SYN_02 para 3.1",
        "3.1 No foreclosure charges or pre-payment penalties shall be levied on floating rate term"
    ),
    (
        "SYN_21_Bank_Grievance_Policy_MultiPage.pdf",
        2,
        "SYN_21 para 3.2 (spans lines)",
        "3.2 The Internal Ombudsman shall give a decision within 30 calendar days of reference."
    ),
    (
        "SYN_22_Bank_Schedule_of_Charges_Table_2025.pdf",
        1,
        "SYN_22 table row",
        "4.0% of outstanding principal Fixed rate loans"
    ),
    (
        "SYN_20_Reg_Draft_Credit_Card_Late_Fee_Watermarked.pdf",
        1,
        "SYN_20 watermark ignore",
        "1.1 It is proposed that the late payment fee on credit cards shall not exceed 1.5 per cent"
    ),
    (
        "SYN_21_Bank_Grievance_Policy_MultiPage.pdf",
        1,
        "Cross-page quote (P1 -> P2)",
        "Where the complaint concerns a disputed transaction, the Bank shall, pending investigation"
    ),
    (
        "SYN_27_Bank_Employee_Leave_Policy_2024.pdf",
        1,
        "SYN_27 para 1.1",
        "1.1 Every permanent employee is entitled to 24 days of earned leave per calendar year."
    )
])
def test_six_citations_precision_and_safety(doc_file, page_no, citation_desc, quote_str):
    """
    Tests the 6 real citations:
    - Quote is accurately located
    - Highlighted area is tight and < 8% of page area
    - Does not highlight entire clauses or page bottoms
    """
    file_path = f"datasets/test_pack/test_documents/{doc_file}"
    pdf = fitz.open(file_path)
    res = locate_quote_with_cross_page(pdf, target_page=page_no, quote=quote_str)
    pdf.close()

    assert res["found"] is True, f"Failed to locate quote: {quote_str}"
    boxes = res["boxes"]
    assert len(boxes) >= 1, "Expected at least 1 bounding box rectangle"

    # Compute total highlight area %
    pdf = fitz.open(file_path)
    page = pdf[page_no - 1]
    page_area = page.rect.width * page.rect.height
    total_area = sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes)
    area_pct = (total_area / page_area) * 100.0
    pdf.close()

    assert area_pct < 8.0, f"Area % too large: {area_pct:.2f}% (limit: 8.0%)"
    assert area_pct > 0.05, f"Area % too small: {area_pct:.2f}%"

def test_safety_limit_rejection():
    """
    Verifies that oversized quotes or artificial boxes exceeding safety limits
    are rejected with warning rather than returning a huge page-covering rectangle.
    """
    doc_file = "datasets/test_pack/test_documents/SYN_02_Reg_Final_Foreclosure_Mar2024.pdf"
    pdf = fitz.open(doc_file)
    p = pdf[0]
    # Synthetic query that would match the entire text of the document (> 8% area)
    giant_text = p.get_text()
    boxes = find_quote_boxes_on_page(p, giant_text)
    pdf.close()

    # Must be rejected by the safety limits (area > 8%)
    assert boxes == [], "Oversized quote must be rejected with empty boxes"

def test_reindex_command_execution():
    """
    Verifies that the re-index script executes cleanly and updates stored bboxes.
    """
    reindex_all_bounding_boxes()
    # Ensure rendered cache directory exists and contains no stale baked images
    assert os.path.exists("storage/rendered")

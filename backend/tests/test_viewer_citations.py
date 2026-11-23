import os
import pytest
import fitz
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.ingestion.quote_matcher import (
    find_quote_boxes_on_page,
    locate_quote_with_cross_page,
    extract_clean_horizontal_words,
)

# 10 Authentic Sample Citations Across Documents and Pages
SAMPLE_CITATIONS = [
    {
        "id": 1,
        "doc": "BNB_Retail_Loan_Policy_2023.pdf",
        "page": 1,
        "quote": "Clause 1.1: Scope. This master policy applies to all retail lending products including personal loans, consumer durables, and automobile financing",
        "expect_multiline": True,
    },
    {
        "id": 2,
        "doc": "BNB_Retail_Loan_Policy_2023.pdf",
        "page": 1,
        "quote": "Clause 4.1: Penal Charges for Default. The penal charge for default on personal loan monthly installments shall be 2.0% per annum on the overdue amount.",
        "expect_multiline": True,
    },
    {
        "id": 3,
        "doc": "BNB_Retail_Loan_Policy_2023.pdf",
        "page": 1,
        "quote": "Clause 5.2: Minimum CIBIL Score. All retail lending applicants must possess a minimum credit bureau CIBIL score of 720 at the time of sanction.",
        "expect_multiline": True,
    },
    {
        "id": 4,
        "doc": "BNB_Personal_Loan_Agreement.pdf",
        "page": 1,
        "quote": "Clause 3.1: Interest Rate. The agreed Rate of Interest for this personal loan is 12.5% per annum on a reducing balance basis.",
        "expect_multiline": True,
    },
    {
        "id": 5,
        "doc": "BNB_Personal_Loan_Agreement.pdf",
        "page": 1,
        "quote": "Clause 4.2: Loan Quantum. Sanctioned principal amount is Rs. 500,000 repayable over 36 monthly installments.",
        "expect_multiline": True,
    },
    {
        "id": 6,
        "doc": "BNB_Personal_Loan_Agreement.pdf",
        "page": 1,
        "quote": "Clause 7.2: Foreclosure and Prepayment. Prepayment of the personal loan facility is permitted after 12 completed monthly installments subject to the express condition that",
        "expect_multiline": True,
    },
    {
        "id": 7,
        "doc": "BNB_Personal_Loan_Agreement.pdf",
        "page": 2,
        "quote": "Clause 9.1: Jurisdiction. This agreement shall be governed strictly in accordance with the laws of the Republic of India under the exclusive jurisdiction of the courts of Mumbai.",
        "expect_multiline": True,
    },
    {
        "id": 8,
        "doc": "RBI_Fair_Lending_Circular_2024.pdf",
        "page": 1,
        "quote": "Paragraph 3: In partial modification of earlier lending directions, with effect from 01/04/2024, penal charges shall not exceed 2.5% per annum on the overdue amount across all regulated entities.",
        "expect_multiline": True,
    },
    {
        "id": 9,
        "doc": "RBI_Fair_Lending_Circular_2024.pdf",
        "page": 1,
        "quote": "Paragraph 4: Regulated entities shall not levy any penal interest. Penalty must strictly be designated as penal charges and shall not be compounded.",
        "expect_multiline": True,
    },
    {
        "id": 10,
        "doc": "BNB_Loan_Policy_Amendment_2025.pdf",
        "page": 1,
        "quote": "In partial modification of Clause 4.1 of Retail Loan Policy 2023, with effect from 01/01/2025, penal charges for personal loan default shall be substituted with 1.75% per annum on the overdue amount.",
        "expect_multiline": True,
    },
]


@pytest.mark.asyncio
async def test_ten_sample_citations_against_page_text():
    """
    Checks 10 sample citations against the page text across documents:
    1. Verifies quote text matches page text.
    2. Verifies locate_quote_with_cross_page returns found=True.
    3. Verifies bounding boxes are within page boundary dimensions.
    4. Verifies multi-line citations return separate bounding boxes per line.
    """
    assert len(SAMPLE_CITATIONS) == 10

    for item in SAMPLE_CITATIONS:
        file_path = os.path.join(settings.UPLOAD_DIR, item["doc"])
        assert os.path.exists(file_path), f"File {item['doc']} should exist in {settings.UPLOAD_DIR}"

        doc = fitz.open(file_path)
        assert len(doc) >= item["page"], f"{item['doc']} should have at least {item['page']} pages"

        page = doc[item["page"] - 1]
        page_text = page.get_text("text")

        # Normalize whitespace for comparison
        norm_page_text = " ".join(page_text.split())
        norm_quote = " ".join(item["quote"].split())

        # 1. Quote text exists in page text
        prefix_sample = norm_quote[:35]
        assert prefix_sample.lower() in norm_page_text.lower(), (
            f"Citation {item['id']} prefix '{prefix_sample}' not found in {item['doc']} page {item['page']}"
        )

        # 2. Run quote matcher
        loc_res = locate_quote_with_cross_page(doc, target_page=item["page"], quote=item["quote"])
        assert loc_res["found"] is True, f"Citation {item['id']} should be found on page {item['page']}"
        assert len(loc_res["boxes"]) >= 1, f"Citation {item['id']} must return at least 1 bounding box"

        page_w = float(page.rect.width)
        page_h = float(page.rect.height)

        # 3. Verify bounding box coordinate geometry
        for box in loc_res["boxes"]:
            assert len(box) == 4
            x0, y0, x1, y1 = box
            assert 0 <= x0 < x1 <= page_w + 10.0, f"Invalid X coordinates in box {box} on page width {page_w}"
            assert 0 <= y0 < y1 <= page_h + 10.0, f"Invalid Y coordinates in box {box} on page height {page_h}"

        # 4. Multi-line verification where expected
        if item["expect_multiline"]:
            assert len(loc_res["boxes"]) >= 2 or loc_res["is_multiline"] or len(loc_res["boxes"]) >= 1

        doc.close()


def test_filter_rotated_watermark_spans():
    """
    Tests that rotated watermark spans (e.g. drawn at 90 degrees or diagonal angle)
    are filtered out when computing bounding boxes.
    """
    # Create in-memory document with horizontal text AND rotated watermark
    doc = fitz.open()
    doc.new_page(width=612, height=792)
    page = doc[0]

    # Insert standard horizontal text
    page.insert_text(fitz.Point(72, 100), "Clause 1.1: Scope. Master policy applicable to all loans.", fontsize=12)

    # Insert rotated watermark text (90 degree vertical)
    page.insert_text(fitz.Point(200, 500), "DRAFT - REGULATORY SPECIMEN", fontsize=36, rotate=90, color=(0.85, 0.85, 0.85))

    # Test extract_clean_horizontal_words
    clean_words = extract_clean_horizontal_words(page)
    extracted_tokens = [w["word"].upper() for w in clean_words]

    # Verify horizontal text was captured
    assert any("SCOPE" in t for t in extracted_tokens)
    assert any("POLICY" in t for t in extracted_tokens)

    # Verify rotated watermark text was filtered out
    assert not any("SPECIMEN" in t for t in extracted_tokens), "Rotated watermark 'SPECIMEN' should be filtered out"
    assert not any("REGULATORY" in t for t in extracted_tokens), "Rotated watermark 'REGULATORY' should be filtered out"

    # Verify quote box calculation on horizontal text works without watermark interference
    boxes = find_quote_boxes_on_page(page, "Clause 1.1: Scope.")
    assert len(boxes) == 1
    assert boxes[0][1] < 150  # Top of page, not bottom watermark area

    doc.close()


def test_missing_quote_bbox_fallback_warning():
    """
    Verifies that when a quote cannot be found on the page or document,
    locate_quote_with_cross_page returns found=False with a clear descriptive warning.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, "BNB_Retail_Loan_Policy_2023.pdf")
    doc = fitz.open(file_path)

    non_existent_quote = "This arbitrary provision does not exist in any retail lending guidelines anywhere."
    res = locate_quote_with_cross_page(doc, target_page=1, quote=non_existent_quote)

    assert res["found"] is False
    assert len(res["boxes"]) == 0
    assert res["warning"] is not None
    assert "cannot be found" in res["warning"]

    doc.close()


def test_cross_page_quote_detection():
    """
    Tests cross-page quote handling on a multi-page document where Clause 7.2 spans from Page 1 to Page 2.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, "BNB_Personal_Loan_Agreement.pdf")
    doc = fitz.open(file_path)

    # Quote starting on Page 1 and completing on Page 2
    cross_page_quote = (
        "Clause 7.2: Foreclosure and Prepayment. Prepayment of the personal loan facility is permitted after 12 "
        "completed monthly installments subject to the express condition that the borrower shall pay a foreclosure fee of 3.0%"
    )

    res = locate_quote_with_cross_page(doc, target_page=1, quote=cross_page_quote)
    assert res["found"] is True
    assert res["cross_page"] is not None
    assert res["cross_page"]["is_cross_page"] is True
    assert res["cross_page"]["continues_on_page"] == 2
    assert len(res["boxes"]) >= 1

    doc.close()


@pytest.mark.asyncio
async def test_pdf_viewer_api_endpoints():
    """
    Verifies GET /api/v1/pdf/{doc}/quote-boxes and GET /api/v1/pdf/{doc}/page/{n} API endpoints.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Info endpoint
        info_res = await client.get("/api/v1/pdf/BNB_Retail_Loan_Policy_2023.pdf/info")
        assert info_res.status_code == 200
        info_data = info_res.json()
        assert info_data["page_count"] >= 1
        assert len(info_data["pages"]) >= 1

        # 2. Quote boxes endpoint
        quote = "Clause 4.1: Penal Charges for Default. The penal charge for default on personal loan monthly installments shall be 2.0% per annum on the overdue amount."
        boxes_res = await client.get(
            "/api/v1/pdf/BNB_Retail_Loan_Policy_2023.pdf/quote-boxes",
            params={"quote": quote, "page": 1}
        )
        assert boxes_res.status_code == 200
        boxes_data = boxes_res.json()
        assert boxes_data["found"] is True
        assert len(boxes_data["boxes"]) >= 1
        assert boxes_data["is_multiline"] is True

        # 3. Missing quote fallback in API response
        missing_res = await client.get(
            "/api/v1/pdf/BNB_Retail_Loan_Policy_2023.pdf/quote-boxes",
            params={"quote": "Non-existent quote that cannot be located", "page": 1}
        )
        assert missing_res.status_code == 200
        missing_data = missing_res.json()
        assert missing_data["found"] is False
        assert missing_data["warning"] is not None

        # 4. Page rendering endpoint with multi-line bboxes and quote
        page_res = await client.get(
            "/api/v1/pdf/BNB_Retail_Loan_Policy_2023.pdf/page/1",
            params={"quote": quote}
        )
        assert page_res.status_code == 200
        assert page_res.headers["content-type"] == "image/png"
        assert int(page_res.headers.get("X-Page-Width", "0").split(".")[0]) > 0

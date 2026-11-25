import os
import fitz
import pytest
from app.ingestion.quote_matcher import (
    normalize_token,
    extract_clean_horizontal_words,
    find_quote_boxes_on_page,
    locate_quote_with_cross_page
)

SYN_02_PATH = "datasets/test_pack/test_documents/SYN_02_Reg_Final_Foreclosure_Mar2024.pdf"
SYN_20_PATH = "datasets/test_pack/test_documents/SYN_20_Reg_Draft_Credit_Card_Late_Fee_Watermarked.pdf"
SYN_21_PATH = "datasets/test_pack/test_documents/SYN_21_Bank_Grievance_Policy_MultiPage.pdf"
SYN_22_PATH = "datasets/test_pack/test_documents/SYN_22_Bank_Schedule_of_Charges_Table_2025.pdf"

@pytest.fixture
def syn_02_doc():
    return fitz.open(SYN_02_PATH)

@pytest.fixture
def syn_20_doc():
    return fitz.open(SYN_20_PATH)

@pytest.fixture
def syn_21_doc():
    return fitz.open(SYN_21_PATH)

@pytest.fixture
def syn_22_doc():
    return fitz.open(SYN_22_PATH)


def test_assertion_1_combined_rectangles_text_equals_quote(syn_02_doc):
    """Assertion 1: The rectangles' combined text equals the quote (normalized)."""
    quote = "3.1 No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans covered under paragraph 2.2."
    res = locate_quote_with_cross_page(syn_02_doc, 1, quote)
    assert res["found"] is True
    assert len(res["boxes"]) == 2

    # Extract text from rectangles
    combined_words = []
    page = syn_02_doc[0]
    for b in res["boxes"]:
        rect = fitz.Rect(b)
        text_under = page.get_text("text", clip=rect).strip()
        combined_words.extend([normalize_token(w) for w in text_under.split() if w.strip()])

    expected_words = [normalize_token(w) for w in quote.split() if w.strip()]
    assert combined_words == expected_words


def test_assertion_2_repeated_word_pages_return_only_one_span(syn_21_doc):
    """Assertion 2: Repeated-word pages return only one span (not all occurrences on the page)."""
    quote = "Where the complaint concerns a disputed transaction, the Bank shall, pending investigation, provide a provisional credit to the customer and shall record the reason for any delay in writing."
    # This sentence is repeated 8 times on Page 1 of SYN_21.
    res = locate_quote_with_cross_page(syn_21_doc, 1, quote)
    assert res["found"] is True
    # One occurrence spans exactly 3 lines -> 3 boxes (NOT 24 boxes!)
    assert len(res["boxes"]) == 3


def test_assertion_3_no_rectangle_lies_over_watermark_or_footer(syn_20_doc):
    """Assertion 3: No rectangle lies over watermark or footer text."""
    quote = "1.1 It is proposed that the late payment fee on credit cards shall not exceed 1.5 per cent per month"
    res = locate_quote_with_cross_page(syn_20_doc, 1, quote)
    assert res["found"] is True
    assert len(res["boxes"]) == 2

    page = syn_20_doc[0]
    # The DRAFT watermark is centered at (x ~ 95..464, y ~ 217..585)
    for b in res["boxes"]:
        # Quote is at y: 178 - 204, strictly above the watermark (y > 217)
        assert b[3] < 215.0
        # Check text under box does not contain the standalone word "DRAFT"
        rect = fitz.Rect(b)
        text_under = page.get_text("text", clip=rect)
        assert "DRAFT\n" not in text_under
        # Ensure it does not cover the bottom footer
        assert b[3] < page.rect.height - 30


def test_assertion_4_table_row_quote_highlights_only_that_rows_cells(syn_22_doc):
    """Assertion 4: A table-row quote highlights only that row's cells."""
    quote = "Cheque return charge Rs. 500 per instrument"
    res = locate_quote_with_cross_page(syn_22_doc, 1, quote)
    assert res["found"] is True
    # Must be on a single horizontal row line
    assert len(res["boxes"]) == 1
    box = res["boxes"][0]

    # Verify vertical height is constrained to a single table row (~10 points height)
    height = box[3] - box[1]
    assert 5.0 <= height <= 16.0

    # Verify text under box contains table row tokens
    page = syn_22_doc[0]
    text_under = page.get_text("text", clip=fitz.Rect(box)).strip().replace("\n", " ")
    assert "Cheque return charge" in text_under
    assert "500" in text_under


def test_assertion_5_quote_spanning_two_lines_yields_exactly_two_rectangles(syn_02_doc):
    """Assertion 5: A quote spanning two lines yields exactly two rectangles."""
    quote = "3.1 No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans covered under paragraph 2.2."
    res = locate_quote_with_cross_page(syn_02_doc, 1, quote)
    assert res["found"] is True
    assert len(res["boxes"]) == 2
    assert res["is_multiline"] is True

    # Line 1 and Line 2 must be vertically distinct
    box1, box2 = res["boxes"]
    assert box2[1] > box1[3] - 2.0  # Line 2 is below Line 1


def test_assertion_6_unmatched_quote_returns_no_rectangles_and_flag(syn_02_doc):
    """Assertion 6: An unmatched quote returns no rectangles and a flag (never guesses fallback)."""
    quote = "This non-existent clause was never enacted by the Reserve Bank of India in any circular."
    res = locate_quote_with_cross_page(syn_02_doc, 1, quote)
    assert res["found"] is False
    assert len(res["boxes"]) == 0
    assert "Exact location could not be determined" in res.get("warning", "")


def test_assertion_7_cross_page_quote_yields_rectangles_on_both_pages_only(syn_21_doc):
    """Assertion 7: A cross-page quote yields rectangles on both pages only (with continuation pill info)."""
    # In SYN_21, Section 3.1 starts at the bottom of Page 1 ("referred to the Internal Ombudsman...")
    # and splits across the page break onto Page 2 ("...complaint concerns a disputed transaction").
    quote = "referred to the Internal Ombudsman. The Bank shall acknowledge every complaint within 3 working days and shall resolve it within 30 calendar days from the date of receipt. Where the complaint concerns a disputed transaction"
    res = locate_quote_with_cross_page(syn_21_doc, 1, quote)
    assert res["found"] is True
    # Target page (Page 1) has boxes for the Page 1 portion
    assert len(res["boxes"]) >= 1
    # Cross page flag is set with continuation on Page 2
    assert res["cross_page"] is not None
    assert res["cross_page"]["is_cross_page"] is True
    assert res["cross_page"]["continues_on_page"] == 2
    assert len(res["cross_page"]["next_boxes"]) >= 1

import os
import fitz  # PyMuPDF can create PDFs with exact coordinates and pages

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "uploads")
SYNTHETIC_DIR = os.path.dirname(__file__)

def create_pdf(filename: str, pages_data: list):
    """
    Creates a synthetic PDF document with explicit text blocks and pages.
    pages_data is a list of tuples: (page_title, [paragraphs/clauses])
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, filename)

    doc = fitz.open()
    for page_title, blocks in pages_data:
        page = doc.new_page(width=595, height=842) # A4
        y = 50

        # Header
        page.insert_text(fitz.Point(50, y), page_title, fontsize=14, fontname="helv", color=(0.05, 0.15, 0.3))
        y += 25
        page.draw_line(fitz.Point(50, y), fitz.Point(545, y), color=(0.7, 0.75, 0.8), width=1)
        y += 25

        for b in blocks:
            if isinstance(b, tuple) and b[0] == "TABLE":
                # Render table
                headers, rows = b[1], b[2]
                col_widths = [150, 150, 150]
                # Header row
                x = 50
                for idx, h in enumerate(headers):
                    page.draw_rect(fitz.Rect(x, y, x + col_widths[idx], y + 20), color=(0.8, 0.85, 0.9), fill=(0.9, 0.93, 0.97))
                    page.insert_text(fitz.Point(x + 5, y + 14), h, fontsize=9, fontname="helv", color=(0.1, 0.1, 0.2))
                    x += col_widths[idx]
                y += 20
                for row in rows:
                    x = 50
                    for idx, cell in enumerate(row):
                        page.draw_rect(fitz.Rect(x, y, x + col_widths[idx], y + 20), color=(0.85, 0.85, 0.85))
                        page.insert_text(fitz.Point(x + 5, y + 14), str(cell), fontsize=8.5, fontname="helv", color=(0.2, 0.2, 0.2))
                        x += col_widths[idx]
                    y += 20
                y += 15
            else:
                rect = fitz.Rect(50, y, 545, y + 80)
                rc = page.insert_textbox(rect, b, fontsize=10, fontname="helv", color=(0.15, 0.15, 0.15))
                y += 65

        # Footer
        page.draw_line(fitz.Point(50, 780), fitz.Point(545, 780), color=(0.8, 0.8, 0.8), width=0.5)
        page.insert_text(fitz.Point(50, 795), f"BHARAT NATIONAL BANK (BNB) - CONFIDENTIAL REGULATORY DEMO", fontsize=8, color=(0.5, 0.5, 0.5))

    doc.save(out_path)
    doc.close()
    print(f"Generated synthetic document: {filename} at {out_path}")
    return out_path

def generate_all_synthetic_docs():
    # 1. Retail Loan Policy 2023 (Step 1 of amendment chain)
    create_pdf("BNB_Retail_Loan_Policy_2023.pdf", [
        ("BHARAT NATIONAL BANK - RETAIL LOAN POLICY 2023", [
            "Publication Date: 01/01/2023. Effective Date w.e.f. 01/01/2023.",
            "Clause 1.1: Scope. This master policy applies to all retail lending products including personal loans, consumer durables, and automobile financing disbursed by Bharat National Bank across all Indian branches.",
            "Clause 4.1: Penal Charges for Default. The penal charge for default on personal loan monthly installments shall be 2.0% per annum on the overdue amount. Penal charges shall not be capitalized into principal.",
            "Clause 5.2: Minimum CIBIL Score. All retail lending applicants must possess a minimum credit bureau CIBIL score of 720 at the time of sanction."
        ])
    ])

    # 2. RBI Fair Lending Circular 2024 (Step 2 of amendment chain)
    create_pdf("RBI_Fair_Lending_Circular_2024.pdf", [
        ("RESERVE BANK OF INDIA - CIRCULAR RBI/2024/78", [
            "Circular Reference: RBI/2024-25/78. Date of Issue: 15/03/2024.",
            "Subject: Fair Lending Practices - Penal Charges in Loan Accounts.",
            "Paragraph 3: In partial modification of earlier lending directions, with effect from 01/04/2024, penal charges shall not exceed 2.5% per annum on the overdue amount across all regulated entities.",
            "Paragraph 4: Regulated entities shall not levy any penal interest. Penalty must strictly be designated as penal charges and shall not be compounded."
        ])
    ])

    # 3. Retail Loan Policy Amendment 2025 (Step 3 of amendment chain)
    create_pdf("BNB_Loan_Policy_Amendment_2025.pdf", [
        ("BHARAT NATIONAL BANK - POLICY AMENDMENT 2025", [
            "Reference: BNB/CIRCULAR/2025/04. Effective Date w.e.f. 01/01/2025.",
            "In partial modification of Clause 4.1 of Retail Loan Policy 2023, with effect from 01/01/2025, penal charges for personal loan default shall be substituted with 1.75% per annum on the overdue amount.",
            "Clause 8.1: Supersession. All prior branch circulars prescribing higher penal rates stand deleted."
        ])
    ])

    # 4. Personal Loan Agreement (Contains Answer Split Across Page 1 & 2 + Rate of 12.5%)
    create_pdf("BNB_Personal_Loan_Agreement.pdf", [
        ("BHARAT NATIONAL BANK - PERSONAL LOAN AGREEMENT (Page 1)", [
            "Loan Agreement Date: 10/05/2025. Borrower: Rajesh Sharma.",
            "Clause 3.1: Interest Rate. The agreed Rate of Interest for this personal loan is 12.5% per annum on a reducing balance basis.",
            "Clause 4.2: Loan Quantum. Sanctioned principal amount is Rs. 500,000 repayable over 36 monthly installments.",
            "Clause 7.2: Foreclosure and Prepayment. Prepayment of the personal loan facility is permitted after 12 completed monthly installments subject to the express condition that"
        ]),
        ("BHARAT NATIONAL BANK - PERSONAL LOAN AGREEMENT (Page 2)", [
            "the borrower shall pay a foreclosure fee of 3.0% on the outstanding principal balance at the time of pre-closure.",
            "Clause 9.1: Jurisdiction. This agreement shall be governed strictly in accordance with the laws of the Republic of India under the exclusive jurisdiction of the courts of Mumbai.",
            "Clause 11.4: Communication. Notices shall be served in writing via registered post or verified electronic mail."
        ])
    ])

    # 5. Loan Sanction Letter (Contains intentional Number Conflict: Rate 11.0% vs Agreement 12.5%)
    create_pdf("BNB_Loan_Sanction_Letter.pdf", [
        ("BHARAT NATIONAL BANK - LOAN SANCTION LETTER", [
            "Sanction Date: 05/05/2025. Application Ref: BNB-PL-99214.",
            "Dear Rajesh Sharma, we are pleased to inform you that your personal loan has been approved.",
            "Sanctioned Loan Amount: INR 500,000.",
            "Sanctioned Rate of Interest: 11.0% per annum fixed for the entire 36 months tenure.",
            "Processing Fee: INR 5,000 plus 18% GST payable prior to disbursement."
        ])
    ])

    # 6. Schedule of Charges (Contains Structured Table for Calculations)
    create_pdf("BNB_Schedule_of_Charges.pdf", [
        ("BHARAT NATIONAL BANK - SCHEDULE OF RETAIL CHARGES 2025", [
            "Effective Date: 01/01/2025. Governing schedule for all retail lending facilities.",
            ("TABLE",
             ["Charge Type", "Standard Tariff", "Threshold Limits"],
             [
                 ["Processing Fee", "1.50% of loan amount", "Min Rs. 1,000, Max Rs. 10,000"],
                 ["Foreclosure Fee", "3.00% of outstanding", "Nil for floating rate personal loans"],
                 ["Cheque Bounce Fee", "Rs. 500 per instance", "Applicable immediately upon dishonour"],
                 ["Penal Charge Rate", "1.75% per annum overdue", "Calculated on overdue amount only"]
             ]
            ),
            "Note 1: All charges and service fees attract Goods and Services Tax (GST) at the statutory rate of 18%.",
            "Note 2: Penal charges are not subjected to compounding or interest capitalization."
        ])
    ])

if __name__ == "__main__":
    generate_all_synthetic_docs()

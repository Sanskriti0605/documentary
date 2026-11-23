#!/usr/bin/env python3
"""Generates 28 SYNTHETIC test PDFs for Veritas. Every file is labelled as a synthetic
test document in its footer. Facts are fictional and chosen so expected answers are unambiguous."""
import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame,
                                Paragraph, Spacer, Table, TableStyle, PageBreak, FrameBreak)

OUT = sys.argv[1] if len(sys.argv) > 1 else "test_documents"
os.makedirs(OUT, exist_ok=True)
FD = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("DV", FD + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", FD + "DejaVuSans-Bold.ttf"))
BODY = ParagraphStyle("b", fontName="DV", fontSize=10.5, leading=15, spaceAfter=6)
H = ParagraphStyle("h", fontName="DVB", fontSize=11.5, leading=15, spaceBefore=8, spaceAfter=4)
T = ParagraphStyle("t", fontName="DVB", fontSize=14, leading=18, spaceAfter=8, alignment=1)
M = ParagraphStyle("m", fontName="DV", fontSize=9.5, leading=13, spaceAfter=2)
FOOT = "SYNTHETIC TEST DOCUMENT - NOT AN OFFICIAL RBI OR BANK PUBLICATION"
RBI = "Reserve Bank of India (Synthetic Test Copy)"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def footer(canvas, doc, watermark=None, extra=None):
    canvas.saveState()
    canvas.setFont("DV", 7.5)
    canvas.setFillColor(colors.grey)
    canvas.drawString(20 * mm, 10 * mm, FOOT)
    canvas.drawRightString(190 * mm, 10 * mm, "Page %d" % doc.page)
    if watermark:
        for txt, ang, size, x, y, col in watermark:
            canvas.saveState()
            canvas.setFont("DVB", size)
            canvas.setFillColor(col)
            canvas.translate(x, y)
            canvas.rotate(ang)
            canvas.drawCentredString(0, 0, txt)
            canvas.restoreState()
    canvas.restoreState()


def header_block(issuer, ref, date, to, subject):
    s = []
    s.append(Paragraph(esc(issuer), T))
    if ref:
        s.append(Paragraph("Ref: %s" % esc(ref), M))
    if date:
        s.append(Paragraph("Date: %s" % esc(date), M))
    if to:
        s.append(Paragraph("To: %s" % esc(to), M))
    s.append(Spacer(1, 6))
    if subject:
        s.append(Paragraph("<b>Subject: %s</b>" % esc(subject), BODY))
    return s


def build(fname, issuer, ref, date, to, subject, body, watermark=None, meta_title=None):
    story = header_block(issuer, ref, date, to, subject)
    for kind, text in body:
        if kind == "h":
            story.append(Paragraph(esc(text), H))
        elif kind == "p":
            story.append(Paragraph(esc(text), BODY))
        elif kind == "pb":
            story.append(PageBreak())
        elif kind == "table":
            data = text
            tb = Table(data, repeatRows=1, colWidths=[None] * len(data[0]))
            tb.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                                    ("FONTNAME", (0, 0), (-1, -1), "DV"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                                    ("FONTNAME", (0, 0), (-1, 0), "DVB"),
                                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6e6e6")),
                                    ("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story.append(tb)
            story.append(Spacer(1, 8))
    doc = SimpleDocTemplate(os.path.join(OUT, fname), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=20 * mm, title=meta_title or subject or fname,
                            author=issuer or "")
    cb = lambda c, d: footer(c, d, watermark)
    doc.build(story, onFirstPage=cb, onLaterPages=cb)


def reg(fname, ref, date, subject, body, to="All Scheduled Commercial Banks", **kw):
    build(fname, RBI, ref, date, to, subject, body, **kw)


def bank(fname, ref, date, subject, body, issuer="ABC Bank Ltd.", to=None, **kw):
    build(fname, issuer, ref, date, to, subject, body, **kw)


# ----------------------------------------------------------------------------------------
# FAMILY 1: Foreclosure charges amendment chain (regulator)
# ----------------------------------------------------------------------------------------
reg("SYN_01_Reg_Draft_Foreclosure_Jan2024.pdf", "TEST/2023-24/101 (DRAFT)", "15 January 2024",
    "Draft Directions - Foreclosure Charges on Floating Rate Loans",
    [("p", "THIS IS A DRAFT FOR PUBLIC COMMENTS. IT IS NOT BINDING AND HAS NO LEGAL EFFECT UNTIL A FINAL CIRCULAR IS ISSUED."),
     ("h", "1. Background"),
     ("p", "The Reserve Bank proposes to review foreclosure charges and pre-payment penalties levied on floating rate term loans."),
     ("h", "2. Proposed Instruction"),
     ("p", "2.1 It is proposed that no foreclosure charges or pre-payment penalties shall be levied on floating rate term loans sanctioned to individual borrowers for non-business purposes."),
     ("p", "2.2 It is proposed that the instructions come into effect from 1 July 2024."),
     ("h", "3. Comments"),
     ("p", "Comments on this draft may be sent by 15 February 2024.")])

reg("SYN_02_Reg_Final_Foreclosure_Mar2024.pdf", "TEST/2023-24/145", "12 March 2024",
    "Foreclosure Charges on Floating Rate Loans - Final Directions",
    [("h", "1. Background"),
     ("p", "Following examination of comments on the draft dated 15 January 2024, the Reserve Bank issues these final directions."),
     ("h", "2. Applicability"),
     ("p", "2.1 These directions apply to all Scheduled Commercial Banks."),
     ("p", "2.2 These directions apply to floating rate term loans sanctioned to individual borrowers for non-business purposes."),
     ("h", "3. Instructions"),
     ("p", "3.1 No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans covered under paragraph 2.2."),
     ("p", "3.2 Fixed rate loans are not covered by these directions."),
     ("p", "3.3 The directions apply to loans sanctioned or renewed on or after the effective date."),
     ("h", "4. Effective Date"),
     ("p", "4.1 These directions shall come into effect from 1 October 2024.")])

reg("SYN_03_Reg_Extension_Foreclosure_Aug2024.pdf", "TEST/2024-25/061", "20 August 2024",
    "Foreclosure Charges on Floating Rate Loans - Extension of Timeline",
    [("h", "1. Reference"),
     ("p", "Reference is invited to circular TEST/2023-24/145 dated 12 March 2024 on foreclosure charges on floating rate loans."),
     ("h", "2. Extension"),
     ("p", "2.1 In view of requests from banks to reconfigure systems, the effective date in paragraph 4.1 of the circular is extended from 1 October 2024 to 1 January 2025."),
     ("p", "2.2 All other provisions of the circular remain unchanged.")])

reg("SYN_04_Reg_PartialAmendment_Foreclosure_Mar2025.pdf", "TEST/2024-25/180", "10 March 2025",
    "Foreclosure Charges - Amendment to Applicability (Micro and Small Enterprises)",
    [("h", "1. Reference"),
     ("p", "Reference is invited to circular TEST/2023-24/145 dated 12 March 2024, as extended by circular TEST/2024-25/061 dated 20 August 2024."),
     ("h", "2. Amendment"),
     ("p", "2.1 Paragraph 2.2 of the circular is amended. In addition to individual borrowers, the directions shall also apply to floating rate term loans to micro and small enterprises with a sanctioned limit of up to Rs. 50,00,000 (Rupees fifty lakh)."),
     ("p", "2.2 The amendment shall come into effect from 1 June 2025."),
     ("h", "3. Other Provisions"),
     ("p", "3.1 All other paragraphs of the circular remain unchanged.")])

# Withdrawn pair
reg("SYN_05_Reg_Documentation_Charges_Cap_Sep2023.pdf", "TEST/2023-24/07", "5 September 2023",
    "Cap on Documentation Charges for Retail Loans",
    [("h", "1. Instruction"),
     ("p", "1.1 Documentation charges levied by banks on retail loans shall not exceed Rs. 5,000 per loan account."),
     ("p", "1.2 These instructions come into effect from 1 November 2023.")])

reg("SYN_06_Reg_Withdrawal_Documentation_Cap_Jun2025.pdf", "TEST/2025-26/022", "30 June 2025",
    "Withdrawal of Circular on Cap on Documentation Charges",
    [("h", "1. Withdrawal"),
     ("p", "1.1 Circular TEST/2023-24/07 dated 5 September 2023 on the cap on documentation charges for retail loans is hereby withdrawn with immediate effect."),
     ("p", "1.2 Banks shall determine documentation charges as per their Board approved policy.")])

# ----------------------------------------------------------------------------------------
# FAMILY 2: Processing fee (regulator vs bank vs NBFC)
# ----------------------------------------------------------------------------------------
reg("SYN_07_Reg_Processing_Fee_Cap_Jan2024.pdf", "TEST/2023-24/110", "18 January 2024",
    "Processing Fee on Retail Loans",
    [("h", "1. Applicability"),
     ("p", "1.1 These instructions apply to all Scheduled Commercial Banks. They do not apply to Non-Banking Financial Companies."),
     ("h", "2. Instruction"),
     ("p", "2.1 The processing fee on retail loans shall not exceed 1.0 per cent of the sanctioned loan amount."),
     ("p", "2.2 The processing fee shall be disclosed upfront to the borrower."),
     ("h", "3. Effective Date"),
     ("p", "3.1 These instructions shall come into effect from 1 April 2024.")])

bank("SYN_08_Bank_Retail_Lending_Policy_v1_Feb2024.pdf", "ABC/POL/RL/2024/01", "1 February 2024",
     "Retail Lending Policy - Version 1",
     [("h", "1. Scope"),
      ("p", "1.1 This policy applies to all retail loans of ABC Bank Ltd., a Scheduled Commercial Bank."),
      ("h", "6. Fees and Charges"),
      ("p", "6.1 The processing fee on retail loans shall be 2.0 per cent of the loan amount, subject to a minimum of Rs. 1,000."),
      ("p", "6.2 Documentation charges shall be Rs. 3,000 per loan account."),
      ("h", "7. Disclosure"),
      ("p", "7.1 The Key Fact Statement shall be provided to the borrower on request.")])

bank("SYN_09_Bank_Retail_Lending_Policy_v2_Jul2024.pdf", "ABC/POL/RL/2024/02", "1 July 2024",
     "Retail Lending Policy - Version 2 (Amendment of Clause 6.1)",
     [("h", "1. Amendment"),
      ("p", "1.1 This version amends only clause 6.1 of Retail Lending Policy Version 1 dated 1 February 2024 and supersedes that clause with effect from 1 July 2024."),
      ("p", "1.2 Revised clause 6.1: The processing fee on retail loans shall be 1.0 per cent of the sanctioned loan amount, subject to a minimum of Rs. 1,000."),
      ("p", "1.3 All other clauses of Version 1 remain in force.")])

bank("SYN_10_NBFC_Loan_Policy_Processing_Fee_2024.pdf", "XYZ/POL/2024/05", "1 March 2024",
     "Loan Pricing Policy of XYZ Finance Ltd. (NBFC)",
     [("h", "1. Scope"),
      ("p", "1.1 XYZ Finance Ltd. is a Non-Banking Financial Company. This policy applies to its retail loans."),
      ("h", "2. Fees"),
      ("p", "2.1 The processing fee shall be 2.5 per cent of the loan amount."),
      ("p", "2.2 Penal charges on overdue instalments shall be 2.0 per cent per annum over the contracted rate.")],
     issuer="XYZ Finance Ltd.")

# ----------------------------------------------------------------------------------------
# FAMILY 3: Loan agreements
# ----------------------------------------------------------------------------------------
bank("SYN_11_Home_Loan_Agreement_Floating_Jan2025.pdf", "ABC/HL/2025/00417", "15 January 2025",
     "Home Loan Agreement (Floating Rate, Individual Borrower)",
     [("p", "This Agreement is made on 15 January 2025 between ABC Bank Ltd. (the Bank) and Mr. A. Sharma (the Borrower), an individual, for a home loan for residential purposes."),
      ("h", "1. Loan Terms"),
      ("p", "1.1 Sanctioned amount: Rs. 45,00,000 (Rupees forty-five lakh)."),
      ("p", "1.2 Interest rate: floating, linked to the external benchmark, currently 8.75 per cent per annum."),
      ("p", "1.3 Tenure: 20 years."),
      ("h", "7. Default"),
      ("p", "7.1 On any overdue amount the Borrower shall pay penal interest at 3.0 per cent per annum on the overdue amount, calculated for the number of days overdue."),
      ("h", "8. Foreclosure"),
      ("p", "8.1 The Borrower may prepay the loan in full or in part."),
      ("p", "8.2 A foreclosure charge of 2.0 per cent of the prepaid principal amount shall be payable on full or part prepayment."),
      ("p", "8.3 The Bank shall issue a foreclosure statement within 7 working days of the request.")])

bank("SYN_12_Personal_Loan_Agreement_Fixed_Feb2025.pdf", "ABC/PL/2025/00982", "3 February 2025",
     "Personal Loan Agreement (Fixed Rate, Individual Borrower)",
     [("p", "This Agreement is made on 3 February 2025 between ABC Bank Ltd. and Ms. R. Iyer (the Borrower), an individual, for a personal loan."),
      ("h", "1. Loan Terms"),
      ("p", "1.1 Sanctioned amount: Rs. 3,00,000 (Rupees three lakh)."),
      ("p", "1.2 Interest rate: fixed at 12.5 per cent per annum for the entire tenure."),
      ("p", "1.3 Tenure: 4 years."),
      ("h", "6. Foreclosure"),
      ("p", "6.1 A foreclosure charge of 4.0 per cent of the outstanding principal shall be payable on prepayment."),
      ("h", "7. Default"),
      ("p", "7.1 Penal charges of 2.0 per cent per annum shall apply on overdue instalments.")])

bank("SYN_13_MSE_Business_Loan_Agreement_Nov2024.pdf", "ABC/MSE/2024/00233", "1 November 2024",
     "Business Loan Agreement (Floating Rate, Micro and Small Enterprise)",
     [("p", "This Agreement is made on 1 November 2024 between ABC Bank Ltd. and Sunrise Traders, a micro enterprise (the Borrower)."),
      ("h", "1. Loan Terms"),
      ("p", "1.1 Sanctioned limit: Rs. 40,00,000 (Rupees forty lakh)."),
      ("p", "1.2 Interest rate: floating, linked to the external benchmark."),
      ("p", "1.3 Next renewal date: 1 November 2025."),
      ("h", "6. Foreclosure"),
      ("p", "6.1 A foreclosure charge of 2.0 per cent of the prepaid amount shall apply on prepayment."),
      ("h", "7. Default"),
      ("p", "7.2 Penal charges of 3.0 per cent per annum over the contracted rate shall be levied on overdue amounts.")])

# ----------------------------------------------------------------------------------------
# FAMILY 4: KFS and digital lending
# ----------------------------------------------------------------------------------------
reg("SYN_14_Reg_KFS_Circular_Mar2024.pdf", "TEST/2023-24/150", "25 March 2024",
    "Key Fact Statement for Retail Loans",
    [("h", "1. Instruction"),
     ("p", "1.1 Banks shall provide a Key Fact Statement (KFS) to every retail borrower before execution of the loan contract, without waiting for a request."),
     ("p", "1.2 The KFS shall disclose the Annual Percentage Rate (APR), all fees and charges, and the recovery mechanism."),
     ("h", "2. Effective Date"),
     ("p", "2.1 These instructions come into effect from 1 July 2024.")])

bank("SYN_15_Bank_Digital_Lending_Policy_Aug2024.pdf", "ABC/POL/DL/2024/03", "1 August 2024",
     "Digital Lending Policy",
     [("h", "1. Cooling-off Period"),
      ("p", "1.1 A borrower of a digital loan may exit the loan without penalty within a cooling-off period of 1 day from the date of disbursement."),
      ("h", "2. Disclosure"),
      ("p", "2.1 The loan summary is shared digitally with the borrower after disbursement.")])

reg("SYN_16_Reg_Digital_Lending_Cooling_Off_Jun2024.pdf", "TEST/2024-25/030", "14 June 2024",
    "Digital Lending - Cooling-off Period",
    [("h", "1. Instruction"),
     ("p", "1.1 Banks shall provide a minimum cooling-off period of 3 days for digital loans, during which the borrower may exit by repaying the principal and proportionate interest without any penalty."),
     ("h", "2. Effective Date"),
     ("p", "2.1 These instructions come into effect from 1 September 2024.")])

# ----------------------------------------------------------------------------------------
# FAMILY 5: Impact analysis test (upload LAST)
# ----------------------------------------------------------------------------------------
bank("SYN_17_Bank_MSE_Lending_Policy_Jun2025.pdf", "ABC/POL/MSE/2025/01", "1 June 2025",
     "MSE Lending Policy",
     [("h", "1. Scope"),
      ("p", "1.1 This policy applies to loans to micro and small enterprises up to Rs. 50,00,000."),
      ("h", "5. Charges"),
      ("p", "5.1 Penal charges on overdue amounts shall be 2.5 per cent per annum over the contracted rate."),
      ("p", "5.2 The processing fee shall be 1.0 per cent of the sanctioned limit."),
      ("p", "5.3 A foreclosure charge of 2.0 per cent shall apply on prepayment of floating rate MSE loans.")])

reg("SYN_18_Reg_MSE_Penal_Charges_Cap_Oct2025.pdf", "TEST/2025-26/090", "1 October 2025",
    "Penal Charges on Loans to Micro and Small Enterprises",
    [("h", "1. Applicability"),
     ("p", "1.1 These instructions apply to all Scheduled Commercial Banks and to loans to micro and small enterprises."),
     ("h", "2. Instruction"),
     ("p", "2.1 Penal charges on loans to micro and small enterprises shall not exceed 1.0 per cent per annum over the contracted rate of interest."),
     ("h", "3. Effective Date"),
     ("p", "3.1 These instructions come into effect from 1 January 2026.")])

# ----------------------------------------------------------------------------------------
# FAMILY 6: Parsing stress tests
# ----------------------------------------------------------------------------------------
# 19: scanned (image-only)
from PIL import Image, ImageDraw, ImageFont
def scanned():
    W, Hh = 1654, 2339
    img = Image.new("L", (W, Hh), 255)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FD + "DejaVuSans.ttf", 34)
    fb = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 42)
    y = 160
    lines = [("b", "Reserve Bank of India (Synthetic Test Copy)"), ("n", ""),
             ("n", "Ref: TEST/2023-24/120      Date: 3 February 2024"), ("n", ""),
             ("b", "Subject: Free ATM Transactions"), ("n", ""),
             ("n", "1. Banks shall permit every savings account holder a minimum of"),
             ("n", "five free transactions per month at the ATMs of the bank."),
             ("n", ""),
             ("n", "2. Beyond the free limit, the maximum charge per transaction"),
             ("n", "shall be Rs. 21."),
             ("n", ""),
             ("n", "3. These instructions come into effect from 1 May 2024.")]
    for k, t in lines:
        d.text((140, y), t, font=fb if k == "b" else f, fill=0)
        y += 62
    d.text((140, Hh - 140), FOOT, font=ImageFont.truetype(FD + "DejaVuSans.ttf", 22), fill=120)
    p = os.path.join(OUT, "SYN_19_Scanned_ATM_Free_Transactions_Feb2024.pdf")
    img.convert("RGB").save(p, "PDF", resolution=200.0)
scanned()

# 20: watermark rotated DRAFT + CONFIDENTIAL
reg("SYN_20_Reg_Draft_Credit_Card_Late_Fee_Watermarked.pdf", "TEST/2024-25/DRAFT-09", "9 May 2024",
    "Draft - Late Payment Fee on Credit Cards",
    [("h", "1. Proposed Instruction"),
     ("p", "1.1 It is proposed that the late payment fee on credit cards shall not exceed 1.5 per cent per month of the overdue amount, subject to a minimum of Rs. 100."),
     ("p", "1.2 It is proposed that this applies from 1 October 2024."),
     ("h", "2. Status"),
     ("p", "2.1 This draft is circulated for comments and is not in force.")] +
    [("p", "Additional explanatory text for page length. " * 12)] * 6,
    watermark=[("DRAFT", 45, 110, 300, 420, colors.Color(0.85, 0.85, 0.85)),
               ("CONFIDENTIAL", 90, 40, 560, 420, colors.Color(0.8, 0.8, 0.8))])

# 21: header/footer + clauses that span pages (long clause + sub-clauses)
long_clause = ("The Bank shall acknowledge every complaint within 3 working days and shall resolve it within 30 calendar days from the date of receipt. "
               "Where the complaint concerns a disputed transaction, the Bank shall, pending investigation, provide a provisional credit to the customer "
               "and shall record the reason for any delay in writing. ") * 4
bank("SYN_21_Bank_Grievance_Policy_MultiPage.pdf", "ABC/POL/GR/2024/02", "1 September 2024",
     "Customer Grievance Redressal Policy",
     [("h", "1. Objective"), ("p", "1.1 " + long_clause)] +
     [("h", "2. Escalation"), ("p", "2.1 If the complaint is not resolved within 30 calendar days, the customer may escalate it to the Principal Nodal Officer, who shall respond within 15 calendar days. " + long_clause)] +
     [("h", "3. Internal Ombudsman"), ("p", "3.1 If the customer is dissatisfied with the response, the matter shall be referred to the Internal Ombudsman. " + long_clause),
      ("p", "3.2 The Internal Ombudsman shall give a decision within 30 calendar days of reference."),
      ("p", "3.3 (a) The decision shall be communicated in writing. (b) The decision shall state reasons.")])

# 22: table-heavy schedule of charges
bank("SYN_22_Bank_Schedule_of_Charges_Table_2025.pdf", "ABC/SOC/2025/01", "1 January 2025",
     "Schedule of Charges - Retail Loans and Accounts",
     [("h", "Table 1: Loan Charges"),
      ("table", [["Charge", "Rate / Amount", "Applicable to", "Remarks"],
                 ["Processing fee", "1.0% of sanctioned amount (min Rs. 1,000)", "Retail loans", "Upfront"],
                 ["Foreclosure charge", "2.0% of prepaid principal", "Floating rate loans", "Subject to regulatory directions"],
                 ["Foreclosure charge", "4.0% of outstanding principal", "Fixed rate loans", "-"],
                 ["Penal charges", "2.0% p.a. over contracted rate", "All loans", "No capitalisation"],
                 ["Cheque return charge", "Rs. 500 per instrument", "Loan repayments", "-"]]),
      ("h", "Table 2: Account Charges"),
      ("table", [["Service", "Charge"],
                 ["Account statement (physical)", "Rs. 100 per statement"],
                 ["Duplicate passbook", "Rs. 150"],
                 ["Demand draft issuance", "Rs. 50 per draft up to Rs. 10,000"]])])

# 23: near-duplicate of SYN_08 (duplicate detection)
bank("SYN_23_Bank_Retail_Lending_Policy_v1_COPY.pdf", "ABC/POL/RL/2024/01", "1 February 2024",
     "Retail Lending Policy - Version 1",
     [("h", "1. Scope"),
      ("p", "1.1 This policy applies to all retail loans of ABC Bank Ltd., a Scheduled Commercial Bank."),
      ("h", "6. Fees and Charges"),
      ("p", "6.1 The processing fee on retail loans shall be 2.00 per cent of the loan amount, subject to a minimum of Rs. 1,000."),
      ("p", "6.2 Documentation charges shall be Rs. 3,000 per loan account."),
      ("h", "7. Disclosure"),
      ("p", "7.1 The Key Fact Statement shall be provided to the borrower on request.")])

# 24: number / date format variations
reg("SYN_24_Reg_Number_Format_Variants_Apr2024.pdf", "TEST/2024-25/001", "1st April, 2024",
    "Minimum Loan Amount and Rate Disclosure",
    [("h", "1. Minimum Amount"),
     ("p", "1.1 The minimum loan amount under this scheme is Rs. 1,50,000 (Rupees one lakh fifty thousand)."),
     ("h", "2. Rate"),
     ("p", "2.1 The concessional rate shall be 1.5 per cent per annum, that is, one and a half percent."),
     ("p", "2.2 The administrative fee shall not exceed one percent (1%) of the loan amount."),
     ("h", "3. Effective Date"),
     ("p", "3.1 This circular is effective from 01/04/2024, that is, April 1, 2024, that is, the 1st day of April 2024.")])

# 25: no metadata (no issuer, no date, no ref)
build("SYN_25_No_Metadata_Internal_Note.pdf", "", "", "", "", "",
      [("h", "Collateral Valuation"),
       ("p", "Collateral for secured loans above Rs. 10,00,000 shall be revalued every 3 years by an empanelled valuer."),
       ("p", "The valuation report shall be retained for 8 years.")], meta_title="Note")

# 26: long master direction (retrieval / ranking)
sections = [
    ("Know Your Customer", "Customer identity shall be re-verified every 2 years for high-risk customers and every 8 years for low-risk customers."),
    ("Loan Sanction Timelines", "A retail loan application complete in all respects shall be decided within 15 working days."),
    ("Interest on Savings Deposits", "Interest on savings deposits shall be calculated on the daily closing balance and credited quarterly."),
    ("Grievance Redressal", "Every bank shall display the name of its Principal Nodal Officer at all branches."),
    ("Recovery Agents", "Recovery agents shall not contact borrowers before 8:00 AM or after 7:00 PM."),
    ("Credit Information", "Banks shall update credit information with credit information companies at least every 15 days."),
    ("Release of Documents", "Original title documents shall be released within 30 days of full repayment, failing which compensation of Rs. 5,000 per day of delay shall be paid."),
    ("Unclaimed Deposits", "Accounts inoperative for 10 years shall be transferred to the Depositor Education and Awareness Fund."),
    ("Fraud Reporting", "Frauds above Rs. 1,00,000 shall be reported to the regulator within 21 days of detection."),
    ("Interest Rate Reset", "Banks shall inform borrowers of any reset of the floating interest rate through a transparent communication."),
]
filler = ("In implementing these directions, banks shall ensure that internal systems, procedures and staff training are aligned, "
          "and that the Board of Directors reviews compliance at least once every year. ")
body = []
for i, (t, txt) in enumerate(sections, 1):
    body.append(("h", "%d. %s" % (i, t)))
    body.append(("p", "%d.1 %s" % (i, txt)))
    body.append(("p", "%d.2 %s" % (i, filler * 3)))
    body.append(("p", "%d.3 %s" % (i, filler * 2)))
reg("SYN_26_Reg_Master_Direction_Lending_Practices_2024.pdf", "TEST/MD/2024/01", "1 April 2024",
    "Master Direction on Lending and Customer Service Practices (Consolidated)", body)

# 27: unrelated document (abstention)
bank("SYN_27_Bank_Employee_Leave_Policy_2024.pdf", "ABC/HR/2024/07", "1 April 2024",
     "Employee Leave Policy",
     [("h", "1. Earned Leave"),
      ("p", "1.1 Every permanent employee is entitled to 24 days of earned leave per calendar year."),
      ("h", "2. Casual Leave"),
      ("p", "2.1 Every permanent employee is entitled to 8 days of casual leave per calendar year."),
      ("h", "3. Maternity Leave"),
      ("p", "3.1 Maternity leave shall be granted for 26 weeks as per applicable law.")])

# 28: Credit card cap that DRAFT 20 relates to? (final KYC-like clean baseline)
bank("SYN_28_Bank_Clean_Baseline_Deposit_Policy_2024.pdf", "ABC/POL/DEP/2024/01", "1 April 2024",
     "Deposit Policy (Clean Baseline Document)",
     [("h", "1. Minimum Balance"),
      ("p", "1.1 The minimum average monthly balance for a regular savings account is Rs. 5,000."),
      ("h", "2. Interest"),
      ("p", "2.1 Savings account interest is 2.70 per cent per annum on balances up to Rs. 1,00,00,000."),
      ("table", [["Account type", "Minimum balance", "Interest rate"],
                 ["Regular savings", "Rs. 5,000", "2.70% p.a."],
                 ["Basic savings (no-frills)", "Nil", "2.70% p.a."]])])

print("Generated", len([f for f in os.listdir(OUT) if f.endswith('.pdf')]), "PDFs in", OUT)

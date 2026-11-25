# Veritas test pack: 28 synthetic PDFs + 33 golden questions

All 28 PDFs are SYNTHETIC. Facts and reference numbers (TEST/...) are fictional so expected answers are unambiguous.
Each page footer says "SYNTHETIC TEST DOCUMENT". Do not present them as real RBI or bank documents.
Real documents to add alongside them are listed in REAL_DOCUMENTS_TO_DOWNLOAD.md.

## Upload order
1. Upload SYN_01 to SYN_17 and SYN_19 to SYN_28 first (everything except SYN_18).
2. Run questions T*, C*, K*, R*, A*, F* from golden_queries_synthetic.json.
3. Upload SYN_18 LAST and run the impact-analysis check below.

## Documents
| File | Tests |
|---|---|
| SYN_01 Draft foreclosure (15 Jan 2024) | Non-binding draft handling |
| SYN_02 Final foreclosure (12 Mar 2024, eff. 1 Oct 2024) | Future effective date; baseline rules incl. 3.2 fixed-rate exclusion, 3.3 sanctioned/renewed |
| SYN_03 Extension (20 Aug 2024) | Effective date moved to 1 Jan 2025 |
| SYN_04 Partial amendment (10 Mar 2025, eff. 1 Jun 2025) | Only para 2.2 changed; MSE up to Rs. 50 lakh; others inherited |
| SYN_05 Documentation charges cap (Sep 2023) | Rule later withdrawn |
| SYN_06 Withdrawal (30 Jun 2025) | Withdrawn-document handling |
| SYN_07 Processing fee cap 1.0% (eff. 1 Apr 2024) | Regulator rule; banks only, not NBFCs |
| SYN_08 Bank policy v1 (2.0% fee; KFS on request) | Conflicts with SYN_07 and SYN_14 |
| SYN_09 Bank policy v2 (fee revised to 1.0%) | Partial amendment resolves the conflict |
| SYN_10 NBFC policy (2.5% fee) | Different scope: not a conflict |
| SYN_11 Home loan, floating, individual | Foreclosure 2% conflicts; penal 3% p.a. for calculations |
| SYN_12 Personal loan, fixed | Foreclosure 4% but fixed-rate: not a conflict |
| SYN_13 MSE business loan, renewal 1 Nov 2025 | Temporal + scope; penal 3% (impact test) |
| SYN_14 KFS circular (eff. 1 Jul 2024) | Conflict only after the effective date |
| SYN_15 Digital lending policy (1-day cooling-off) | Conflicts with SYN_16 |
| SYN_16 Cooling-off circular (3 days, eff. 1 Sep 2024) | Regulator side of that conflict |
| SYN_17 MSE lending policy (penal 2.5%, foreclosure 2%) | Impact test and conflict with SYN_04 |
| SYN_18 MSE penal charge cap 1.0% (eff. 1 Jan 2026) | UPLOAD LAST: impact analysis trigger |
| SYN_19 Scanned image-only PDF | OCR; trust scanner "no text layer" |
| SYN_20 Draft with rotated DRAFT + CONFIDENTIAL watermark | Watermark filtering; draft status |
| SYN_21 Multi-page grievance policy | Clauses spanning pages, sub-clauses (a)(b) |
| SYN_22 Schedule of charges (grid tables) | Table extraction |
| SYN_23 Near-duplicate of SYN_08 ("2.00" vs "2.0") | Duplicate detection |
| SYN_24 Number and date format variants | Entity consistency (Rs. 1,50,000, 1.5 per cent, 1/4/2024) |
| SYN_25 No issuer, date or reference | Missing-metadata flag |
| SYN_26 Master direction, 4 pages, 10 sections | Retrieval and ranking in a long document |
| SYN_27 Employee leave policy (unrelated) | Abstention and isolation |
| SYN_28 Clean baseline deposit policy with table | Healthy-document baseline |

## Impact analysis check (after uploading SYN_18)
Expected report (effective 1 Jan 2026, penal charges on MSE loans capped at 1.0% p.a. over contracted rate):
- MUST flag: SYN_17 clause 5.1 (2.5%), SYN_13 clause 7.2 (3.0%).
- SHOULD flag as "possibly affected, scope includes MSE": SYN_22 Table 1 penal charges row (2.0%, "All loans").
- MUST NOT flag: SYN_11 and SYN_12 (individual borrowers), SYN_10 (NBFC; circular covers banks only), SYN_08/09.
Score it: recall = flagged expected / 3; any item flagged outside this list is a false positive.

## Trust and quality scanner expectations
- SYN_19: no text layer, OCR used, show OCR confidence.
- SYN_23: near-duplicate of SYN_08.
- SYN_25: missing date, issuer and reference.
- SYN_20: watermark detected and excluded from quotes; status draft.
- SYN_21 and SYN_26: multi-page, parsed fully, no empty pages.
- All SYN_* files: source tier should read "user-supplied", never "official".

## Existing seeded documents
Your three seeded RBI circular PDFs cover the penal-charges chain. Keep them, or replace them with the real circulars listed in REAL_DOCUMENTS_TO_DOWNLOAD.md.

# Veritas AI — Golden Synthetic Evaluation Baseline Results

- **Date of Run:** 2026-11-24 04:58:36
- **Total Golden Questions:** 33
- **Passed:** 6
- **Failed:** 27
- **Pass Rate:** 18.2%
- **Documents Ingested:** 27 Synthetic PDFs (SYN_01..SYN_17, SYN_19..SYN_28, excluding SYN_18)
- **Dense Embedding Model:** BAAI/bge-m3 (1024-d in Qdrant)
- **LLM Provider:** OpenRouter (nvidia/nemotron-3.5-lightning:free)
- **Verifier:** cross-encoder/nli-deberta-v3-small

## Baseline Results Table

| Question ID | Category | As-Of Date | Pass/Fail | Failure Cause | Details |
|---|---|---|---|---|---|
| T01 | temporal | 2024-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_01']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0CCF9B9.pdf', 'NT293647FA09A5342 |
| T02 | temporal | 2024-06-01 | ✅ PASS | - | All criteria met. |
| T03 | temporal | 2024-11-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_03 para 2.1']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0CCF9B9.pdf', 'NT293647 |
| T04 | temporal | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_03 para 2.1']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0CCF9B9.pdf', 'NT293647 |
| T05 | temporal | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_04 para 2.2']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0CCF9B9.pdf', 'LEVY2102 |
| T06 | temporal | 2025-07-01 | ❌ FAIL | generation | Answer missing key expected figures: ['1', '00', '000', '2.1']. Got: ABSTENTION ENFORCED: Insufficient verifiable evidence found in the document libra |
| T07 | temporal | 2025-01-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_05 para 1.1']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'SYN_06_Reg_Withdrawal_Docume |
| T08 | temporal | 2025-07-15 | ✅ PASS | - | All criteria met. |
| C01 | contradiction | 2024-05-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_07 para 2.1']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'Schedule-of-Charges-2025.pdf |
| C02 | contradiction | 2024-08-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_09 para 1.2']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'Schedule-of-Charges-2025.pdf |
| C03 | contradiction | 2024-08-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_07 para 1.1']. Top retrieved docs: ['SYN_10_NBFC_Loan_Policy_Processing_Fee_2024.pdf', 'SYN_10_NB |
| C04 | contradiction | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_11 clause 8.2', 'SYN_02 para 3.1']. Top retrieved docs: ['FCS050612FL.pdf', 'FCS050612FL.pdf', 'N |
| C05 | contradiction | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_12 clause 6.1', 'SYN_02 para 3.2']. Top retrieved docs: ['BNB_Personal_Loan_Agreement.pdf', 'NT29 |
| C06 | contradiction | 2025-07-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_13 clause 6.1', 'SYN_04 para 2.1', 'SYN_02 para 3.3']. Top retrieved docs: ['LEVY21022025AB70CEA0 |
| C07 | contradiction | 2025-07-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_17 clause 5.3', 'SYN_04 para 2.1']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0C |
| C08 | contradiction | 2024-08-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_08 clause 7.1']. Top retrieved docs: ['NT642A32A71F06D649B78A9622FB82B8C438.pdf', 'LEVY21022025AB |
| C09 | contradiction | 2024-05-01 | ✅ PASS | - | All criteria met. |
| C10 | contradiction | 2024-10-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_15 clause 1.1']. Top retrieved docs: ['SYN_16_Reg_Digital_Lending_Cooling_Off_Jun2024.pdf', 'SYN_ |
| K01 | calculation | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_11 clause 7.1']. Top retrieved docs: ['BNB_Retail_Loan_Policy_2023.pdf', 'BNB_Personal_Loan_Agree |
| K02 | calculation | 2024-08-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_09 para 1.2']. Top retrieved docs: ['BNB_Schedule_of_Charges.pdf', 'Schedule-of-Charges-2025.pdf' |
| R01 | parsing_ocr | 2024-06-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_19 paras 1-2']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'Schedule-of-Charges-2025.pd |
| R02 | parsing_watermark | 2024-06-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_20 para 1.1']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'Schedule-of-Charges-2025.pdf |
| R03 | parsing_multipage | 2024-10-01 | ❌ FAIL | generation | Answer missing key expected figures: ['30', '3.2', '15', '2.1']. Got: 45 Days Minimum amount due Feature |
| R04 | parsing_table | 2025-02-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_22 Table 1']. Top retrieved docs: ['BNB_Schedule_of_Charges.pdf', 'Schedule-of-Charges-2025.pdf', |
| R05 | parsing_numbers | 2024-06-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_24 paras 1.1, 3.1']. Top retrieved docs: ['LEVY21022025AB70CEA0786742FCAE18FE41F0CCF9B9.pdf', 'PE |
| R06 | parsing_metadata | 2024-06-01 | ✅ PASS | - | All criteria met. |
| R07 | retrieval_long_doc | 2024-06-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_26 para 7.1']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'Schedule-of-Charges-2025.pdf |
| R08 | retrieval_long_doc | 2024-06-01 | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_26 para 5.1']. Top retrieved docs: ['PENALCHARGES26A3A63141764128942EDBA48A78A491.pdf', 'SYN_16_R |
| A01 | abstention | 2025-02-01 | ✅ PASS | - | Correctly abstained due to insufficient evidence. |
| A02 | abstention | 2025-02-01 | ❌ FAIL | verification | Expected abstention but got status=VERIFIED. Answer: 2% of the amount settled SCHEDULE OF CHARGES: BANK GUARANTEE: ALL TYPES TITLE ISSUANCE OF BANK GU |
| A03 | isolation | 2025-02-01 | ✅ PASS | - | All criteria met. |
| F01 | counterfactual | 2024-12-01 (hypothetical) | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_03 para 2.1']. Top retrieved docs: ['PENALCHARGES26A3A63141764128942EDBA48A78A491.pdf', 'FCS05061 |
| F02 | counterfactual | 2025-02-01 (hypothetical) | ❌ FAIL | retrieval | Retrieval failed to return required source(s): ['SYN_11 clause 7.1']. Top retrieved docs: ['Schedule-of-Charges-2025.pdf', 'BNB_Personal_Loan_Agreemen |

## Failure Cause Breakdown

- **RETRIEVAL:** 24 questions
- **GENERATION:** 2 questions
- **VERIFICATION:** 1 questions

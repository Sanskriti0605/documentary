import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceChat } from '../EvidenceChat';
import { askService } from '../../services/api';
import { AskResponse } from '../../types';

describe('EvidenceChat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAskResponse: AskResponse = {
    session_id: 'test-session-123',
    query: 'What is the loan interest rate and penal charge policy?',
    answer: 'The personal loan interest rate is 12.5% per annum. Automatic interest reductions are not supported under current terms.',
    status: 'PARTIALLY_VERIFIED',
    faithfulness_score: 66.7,
    generated_count: 3,
    verified_count: 2,
    blocked_count: 1,
    generation_provider: 'ollama-qwen2.5',
    is_fallback: false,
    model_name: 'qwen2.5:7b',
    conflict_found: true,
    conflict_subject: 'Foreclosure Penal Charges',
    has_version_chain: true,
    verified_claims: [
      {
        text: 'The interest rate for the personal loan facility is fixed at 12.5% per annum.',
        verdict: 'VERIFIED',
        status: 'VERIFIED',
        verifier: 'DeBERTa-v3 NLI',
        generator: 'ollama-qwen2.5',
        is_fallback: false,
        citations: [
          {
            id: 'cit-1',
            document_name: 'Personal_Loan_Agreement.pdf',
            page_number: 3,
            clause_number: '4.1',
            quote: 'Interest on the loan shall accrue at 12.5% per annum on daily reducing balance.',
            exact_quote: 'Interest on the loan shall accrue at 12.5% per annum on daily reducing balance.',
            bounding_box: [100, 150, 450, 175]
          }
        ]
      },
      {
        text: 'Prepayment penal charges are capped at zero for individual floating rate loans under RBI guidelines.',
        verdict: 'VERIFIED',
        status: 'VERIFIED',
        verifier: 'DeBERTa-v3 NLI',
        generator: 'extractive-grounding',
        is_fallback: true,
        citations: [
          {
            id: 'cit-2',
            document_name: 'RBI_Circular_Penal_Charges.pdf',
            page_number: 2,
            clause_number: '2.1',
            quote: 'No foreclosure charges or pre-payment penalties shall be levied on floating rate loans.',
            exact_quote: 'No foreclosure charges or pre-payment penalties shall be levied on floating rate loans.'
          }
        ]
      }
    ],
    blocked_claims: [
      {
        original_claim: 'Borrower is eligible for an automatic interest reduction after 6 months of prompt payments.',
        verdict: 'BLOCKED',
        reason: 'Missing documentary clause in cited pages',
        searched_for: 'Automatic interest reduction after 6 months of prompt EMI payments',
        missing: 'Clause granting automatic rate reduction in Personal Loan Agreement or Sanction Letter',
        verifier: 'deterministic-regex / DeBERTa-v3',
        generator: 'ollama-qwen2.5',
        is_fallback: false,
        message: 'No evidence found in loan contract'
      }
    ],
    calculation: {
      type: 'PENAL_INTEREST',
      summary: 'Calculated penal interest of INR 82.19 based on overdue amount',
      result: {
        steps: [
          'Overdue amount: INR 50,000',
          'Penal rate: 2.0% per annum w.e.f. 2024',
          'Penalty for 30 days: (50000 * 0.02 * 30)/365 = INR 82.19'
        ]
      }
    },
    retrieved_quotes: [
      {
        document_name: 'Personal_Loan_Agreement.pdf',
        page_number: 3,
        clause_number: '4.1',
        retrieval_score: 0.895,
        clause_text: 'Interest on the loan shall accrue at 12.5% per annum on daily reducing balance.'
      }
    ]
  };

  it('renders initial empty state with suggested questions and input box', () => {
    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Ask VerifyDoc', level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('query-input')).toBeInTheDocument();
    expect(screen.getByTestId('ask-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('empty-initial-state')).toBeInTheDocument();
    expect(screen.getByText(/Ready to Answer with 100% Verifiable Evidence/i)).toBeInTheDocument();
  });

  it('renders verified claim, blocked claim, and fallback-mode claim with verdicts and badges', async () => {
    vi.spyOn(askService, 'ask').mockResolvedValueOnce(mockAskResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'What is the interest rate and penal policy?' } });
    fireEvent.click(button);

    // Wait for response container to appear
    await waitFor(() => {
      expect(screen.getByTestId('ask-response-container')).toBeInTheDocument();
    });

    // 1. Faithfulness score & claims count
    expect(screen.getByTestId('faithfulness-meter')).toHaveTextContent('66.7%');
    expect(screen.getByTestId('claims-count-text')).toHaveTextContent('3 generated, 1 blocked');

    // 2. Conflict found badge linking to /contradictions?subject=
    const conflictBadge = screen.getByTestId('conflict-found-badge');
    expect(conflictBadge).toBeInTheDocument();
    expect(conflictBadge).toHaveTextContent(/Conflict found: Foreclosure Penal Charges/i);
    expect(conflictBadge.getAttribute('href')).toBe('/contradictions?subject=Foreclosure%20Penal%20Charges');

    // 3. Version chain link to /amendments
    const versionChainLink = screen.getByTestId('version-chain-link');
    expect(versionChainLink).toBeInTheDocument();
    expect(versionChainLink.getAttribute('href')).toBe('/amendments');

    // 4. Verified claim rendering
    expect(screen.getByText(/The interest rate for the personal loan facility is fixed at 12.5% per annum./i)).toBeInTheDocument();
    const verifiedBadges = screen.getAllByTestId('claim-verdict-verified');
    expect(verifiedBadges.length).toBe(2);
    expect(verifiedBadges[0]).toHaveTextContent('VERIFIED');
    const verifierTags = screen.getAllByText(/Verifier: DeBERTa-v3 NLI/i);
    expect(verifierTags.length).toBeGreaterThan(0);

    // 5. Fallback mode claim
    const fallbackBadges = screen.getAllByTestId('claim-fallback-badge');
    expect(fallbackBadges.length).toBeGreaterThan(0);
    expect(screen.getByText(/Prepayment penal charges are capped at zero/i)).toBeInTheDocument();
    expect(screen.getByText(/Generator: extractive-grounding/i)).toBeInTheDocument();

    // 6. CitationChip with hover quote
    const citationChips = screen.getAllByTestId('citation-chip');
    expect(citationChips.length).toBe(2);
    expect(citationChips[0]).toHaveTextContent('Personal_Loan_Agreement.pdf');
    expect(citationChips[0]).toHaveTextContent('P.3');

    // Hover over citation chip to display hover quote card
    fireEvent.mouseEnter(citationChips[0].parentElement!);
    const hoverCard = await screen.findByTestId('citation-hover-card');
    expect(hoverCard).toBeInTheDocument();
    expect(hoverCard).toHaveTextContent(/Interest on the loan shall accrue at 12.5% per annum on daily reducing balance./i);

    // 7. Blocked claim rendering with explicit "searched for" and "missing"
    const blockedCard = screen.getByTestId('blocked-claim-card');
    expect(blockedCard).toBeInTheDocument();
    const blockedBadge = screen.getByTestId('claim-verdict-blocked');
    expect(blockedBadge).toHaveTextContent('BLOCKED');
    expect(screen.getByText(/"Borrower is eligible for an automatic interest reduction after 6 months of prompt payments."/i)).toBeInTheDocument();

    const searchedFor = screen.getByTestId('blocked-searched-for');
    expect(searchedFor).toHaveTextContent('Automatic interest reduction after 6 months of prompt EMI payments');

    const missing = screen.getByTestId('blocked-missing');
    expect(missing).toHaveTextContent('Clause granting automatic rate reduction in Personal Loan Agreement or Sanction Letter');

    // 8. Calculation card
    const calcCard = screen.getByTestId('calculation-card');
    expect(calcCard).toBeInTheDocument();
    expect(calcCard).toHaveTextContent(/Deterministic Financial Calculation \(PENAL_INTEREST\)/i);
    expect(calcCard).toHaveTextContent(/Penalty for 30 days: \(50000 \* 0.02 \* 30\)\/365 = INR 82.19/i);

    // 9. Evidence drawer
    const drawerButton = screen.getByTestId('toggle-evidence-drawer-button');
    expect(drawerButton).toHaveTextContent(/View Retrieved Evidence Clauses \(1\)/i);
    expect(screen.queryByTestId('evidence-drawer-content')).not.toBeInTheDocument();

    // Toggle drawer open
    fireEvent.click(drawerButton);
    const drawerContent = screen.getByTestId('evidence-drawer-content');
    expect(drawerContent).toBeInTheDocument();
    expect(drawerContent).toHaveTextContent(/Personal_Loan_Agreement.pdf • Page 3 \(Clause 4.1\)/i);
    expect(drawerContent).toHaveTextContent('RRF: 0.895');
  });

  it('handles backend-down error with retry action', async () => {
    const networkError = new Error('Network Error');
    (networkError as any).code = 'ERR_NETWORK';
    vi.spyOn(askService, 'ask').mockRejectedValueOnce(networkError);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'What are the charges?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('backend-down-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Backend Verification Service Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Unable to reach the VerifyDoc backend/i)).toBeInTheDocument();

    // Verify retry button exists
    const retryBtn = screen.getByTestId('retry-button');
    expect(retryBtn).toBeInTheDocument();

    // Mock success on retry
    vi.spyOn(askService, 'ask').mockResolvedValueOnce(mockAskResponse);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('ask-response-container')).toBeInTheDocument();
    });
  });

  it('handles empty result state when no evidence exists', async () => {
    const emptyResponse: AskResponse = {
      session_id: 'empty-session-456',
      query: 'What is the interest rate for space travel financing?',
      answer: '',
      status: 'INSUFFICIENT_EVIDENCE',
      faithfulness_score: 0,
      generated_count: 0,
      verified_count: 0,
      blocked_count: 0,
      generation_provider: 'ollama-qwen2.5',
      is_fallback: false,
      conflict_found: false,
      has_version_chain: false,
      verified_claims: [],
      blocked_claims: [],
      retrieved_quotes: []
    };

    vi.spyOn(askService, 'ask').mockResolvedValueOnce(emptyResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'What is the interest rate for space travel financing?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('empty-result-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/No Documentary Evidence Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Under the VerifyDoc protocol, the engine abstains rather than halluncinating./i)).toBeInTheDocument();
  });

  it('handles missing-information conditional abstention box', async () => {
    const missingInfoResponse: AskResponse = {
      session_id: 'missing-info-789',
      query: 'Are unapproved modifications allowed?',
      answer: 'The system cannot confirm unapproved modifications without explicit board approval.',
      status: 'INSUFFICIENT_EVIDENCE',
      faithfulness_score: 0,
      generated_count: 1,
      verified_count: 0,
      blocked_count: 1,
      generation_provider: 'ollama-qwen2.5',
      is_fallback: false,
      conflict_found: false,
      has_version_chain: false,
      verified_claims: [],
      blocked_claims: [
        {
          original_claim: 'Unapproved modifications are permitted after 30 days notice.',
          verdict: 'BLOCKED',
          reason: 'No regulatory support found',
          searched_for: 'Unapproved modifications permitted with notice',
          missing: 'RBI Master Direction clause permitting unapproved contract changes',
          verifier: 'deterministic-regex',
          generator: 'ollama-qwen2.5',
          is_fallback: false,
          message: 'Regulatory clause missing'
        }
      ],
      retrieved_quotes: []
    };

    vi.spyOn(askService, 'ask').mockResolvedValueOnce(missingInfoResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'Are unapproved modifications allowed?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('missing-information-box')).toBeInTheDocument();
    });

    expect(screen.getByText(/Conditional Answer • Missing Documentary Proof/i)).toBeInTheDocument();
    expect(screen.getByText(/The verification gate identified missing evidence required to definitively certify this answer./i)).toBeInTheDocument();
  });
});

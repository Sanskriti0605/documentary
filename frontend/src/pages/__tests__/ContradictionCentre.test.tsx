import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContradictionCentre } from '../ContradictionCentre';
import { conflictService, documentService } from '../../services/api';
import { Conflict, ConflictSummaryStats } from '../../types';

describe('ContradictionCentre Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSummary: ConflictSummaryStats = {
    total: 3,
    pending_review: 1,
    confirmed_conflicts: 1,
    auto_resolved: 1,
    resolved_by_reviewer: 1
  };

  const mockConflicts: Conflict[] = [
    {
      id: 'conflict-1',
      clause_a_id: 'cl-a-1',
      clause_b_id: 'cl-b-1',
      subject: 'interest_rate',
      conflict_type: 'CONFIRMED_CONFLICT',
      severity: 'HIGH',
      scope_overlap: true,
      temporal_overlap: true,
      resolution_status: 'PENDING_REVIEW',
      resolution_notes: null,
      doc_a_name: 'BNB_Loan_Sanction_Letter.pdf',
      doc_b_name: 'BNB_Personal_Loan_Agreement.pdf',
      clause_a_number: 'Preamble',
      clause_b_number: '3.1',
      value_a: '11.0%',
      value_b: '12.5%',
      quote_a: 'Sanctioned Rate of Interest: 11.0% per annum fixed for the entire 36 months tenure.',
      quote_b: 'Clause 3.1: Interest Rate. The agreed Rate of Interest for this personal loan is 12.5% per annum on a reducing balance basis.',
      history: [
        {
          timestamp: '2026-11-23T10:00:00Z',
          action: 'DETECTED',
          previous_status: 'NONE',
          new_status: 'PENDING_REVIEW',
          notes: 'Detected conflicting interest rate between sanction letter and loan agreement.'
        }
      ],
      created_at: '2026-11-23T10:00:00Z'
    },
    {
      id: 'conflict-2',
      clause_a_id: 'cl-a-2',
      clause_b_id: 'cl-b-2',
      subject: 'penal_charge_rate',
      conflict_type: 'SUPERSEDED',
      severity: 'MEDIUM',
      scope_overlap: true,
      temporal_overlap: false,
      resolution_status: 'AUTO_RESOLVED',
      resolution_notes: 'Auto-reconciled: Prior clause (2.0%) in BNB_Retail_Loan_Policy_2023.pdf is superseded by subsequent amendment (1.75%) in BNB_Loan_Policy_Amendment_2025.pdf.',
      doc_a_name: 'BNB_Retail_Loan_Policy_2023.pdf',
      doc_b_name: 'BNB_Loan_Policy_Amendment_2025.pdf',
      clause_a_number: '4.1',
      clause_b_number: 'Preamble',
      value_a: '2.0%',
      value_b: '1.75%',
      quote_a: 'Clause 4.1: Penal charge for default on personal loan monthly installments shall be 2.0% per annum.',
      quote_b: 'In partial modification of Clause 4.1 of Retail Loan Policy 2023, penal charges shall be substituted with 1.75% per annum.',
      history: [
        {
          timestamp: '2026-11-23T09:00:00Z',
          action: 'AUTO_RESOLVED',
          previous_status: 'DETECTED',
          new_status: 'AUTO_RESOLVED',
          notes: 'Superseded by BNB_Loan_Policy_Amendment_2025.pdf w.e.f. 01/01/2025',
          linked_document_name: 'BNB_Loan_Policy_Amendment_2025.pdf'
        }
      ],
      created_at: '2026-11-23T09:00:00Z'
    }
  ];

  it('renders summary counts and filter controls', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValueOnce({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValueOnce({
      total: 2,
      documents: [
        { id: 'd1', name: 'BNB_Loan_Policy_Amendment_2025.pdf', file_hash: 'h1', document_type: 'OTHER', domain: 'banking', status: 'PROCESSED', page_count: 1, clause_count: 2, created_at: '', updated_at: '' }
      ]
    });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('summary-counts-bar')).toBeInTheDocument();
    });

    // Check summary counters
    expect(screen.getByTestId('summary-total-count')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-pending-count')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-confirmed-count')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-autoresolved-count')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-reviewed-count')).toHaveTextContent('1');

    // Check filter inputs
    expect(screen.getByTestId('filter-subject-input')).toBeInTheDocument();
    expect(screen.getByTestId('filter-document-input')).toBeInTheDocument();
    expect(screen.getByTestId('filter-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('filter-status-select')).toBeInTheDocument();
  });

  it('renders side-by-side quotes, highlighted differing values, and click-through chips', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValueOnce({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValueOnce({ total: 0, documents: [] });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-conflicts-list')).toBeInTheDocument();
    });

    // Subject badge
    expect(screen.getByTestId('conflict-subject-badge')).toHaveTextContent('Subject: interest_rate');

    // Differing values callout & highlighted values
    const diffCallout = screen.getByTestId('differing-values-callout');
    expect(diffCallout).toHaveTextContent(/Differing Values: 11.0% \(BNB_Loan_Sanction_Letter.pdf\) vs 12.5% \(BNB_Personal_Loan_Agreement.pdf\)/i);

    const highlightedPills = screen.getAllByTestId('highlighted-diff-value');
    expect(highlightedPills.length).toBeGreaterThanOrEqual(2);
    expect(highlightedPills[0]).toHaveTextContent('11.0%');
    expect(highlightedPills[1]).toHaveTextContent('12.5%');

    // Side-by-side boxes
    expect(screen.getByTestId('clause-a-box')).toHaveTextContent('BNB_Loan_Sanction_Letter.pdf');
    expect(screen.getByTestId('clause-b-box')).toHaveTextContent('BNB_Personal_Loan_Agreement.pdf');

    // Click-through CitationChips
    const chips = screen.getAllByTestId('citation-chip');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips[0]).toHaveTextContent('BNB_Loan_Sanction_Letter.pdf');
    expect(chips[1]).toHaveTextContent('BNB_Personal_Loan_Agreement.pdf');
  });

  it('handles reviewer action with linked document and persists via PATCH', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValue({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValue({
      total: 1,
      documents: [
        { id: 'd1', name: 'BNB_Loan_Policy_Amendment_2025.pdf', file_hash: 'h1', document_type: 'OTHER', domain: 'banking', status: 'PROCESSED', page_count: 1, clause_count: 2, created_at: '', updated_at: '' }
      ]
    });
    const patchSpy = vi.spyOn(conflictService, 'patchConflict').mockResolvedValueOnce({
      ...mockConflicts[0],
      resolution_status: 'RESOLVED_AMENDMENT',
      resolution_notes: 'Reconciled: agreement rate governed by sanction letter term.',
      linked_document_name: 'BNB_Loan_Policy_Amendment_2025.pdf'
    });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('review-button')).toBeInTheDocument();
    });

    // Open review modal
    fireEvent.click(screen.getByTestId('review-button'));

    expect(screen.getByTestId('review-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-resolution-select')).toBeInTheDocument();

    // Verify linked document input is visible when RESOLVED_AMENDMENT is selected
    expect(screen.getByTestId('modal-linked-document-input')).toBeInTheDocument();

    // Fill notes and linked doc
    fireEvent.change(screen.getByTestId('modal-linked-document-input'), {
      target: { value: 'BNB_Loan_Policy_Amendment_2025.pdf' }
    });
    fireEvent.change(screen.getByTestId('modal-review-notes-textarea'), {
      target: { value: 'Reconciled: agreement rate governed by sanction letter term.' }
    });

    // Submit review
    fireEvent.click(screen.getByTestId('modal-submit-button'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith('conflict-1', {
        resolution_status: 'RESOLVED_AMENDMENT',
        resolution_notes: 'Reconciled: agreement rate governed by sanction letter term.',
        linked_document_name: 'BNB_Loan_Policy_Amendment_2025.pdf'
      });
    });
  });

  it('renders reviewer audit trail on card', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValueOnce({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValueOnce({ total: 0, documents: [] });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('conflict-history-section')).toBeInTheDocument();
    });

    const historyToggle = screen.getByText(/Reviewer Audit Trail \(1\)/i);
    expect(historyToggle).toBeInTheDocument();

    // Expand audit trail
    fireEvent.click(historyToggle);

    expect(screen.getByText(/Detected conflicting interest rate between sanction letter/i)).toBeInTheDocument();
  });

  it('displays auto-resolved conflicts in a collapsible section', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValueOnce({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValueOnce({ total: 0, documents: [] });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('autoresolved-section')).toBeInTheDocument();
    });

    expect(screen.getByText(/Auto-Resolved Conflicts \(1\)/i)).toBeInTheDocument();
    expect(screen.queryByTestId('autoresolved-conflicts-list')).not.toBeInTheDocument();

    // Toggle expand
    const toggleBtn = screen.getByTestId('toggle-autoresolved-button');
    expect(toggleBtn).toHaveTextContent('Show Auto-Resolved');
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('autoresolved-conflicts-list')).toBeInTheDocument();
    expect(screen.getByText(/Prior clause \(2.0%\) in BNB_Retail_Loan_Policy_2023.pdf is superseded/i)).toBeInTheDocument();
  });

  it('handles re-scan button and reports new/changed counts banner', async () => {
    vi.spyOn(conflictService, 'listConflicts').mockResolvedValue({
      total: 2,
      conflicts: mockConflicts,
      summary: mockSummary
    });
    vi.spyOn(documentService, 'listDocuments').mockResolvedValueOnce({ total: 0, documents: [] });
    const scanSpy = vi.spyOn(conflictService, 'scanConflicts').mockResolvedValueOnce({
      scanned_clauses: 156,
      new_conflicts: 2,
      auto_resolved: 1,
      existing_conflicts: 0,
      total_conflicts: 3,
      message: 'Scan complete: 2 new conflicts detected, 1 auto-resolved, 0 existing.'
    });

    render(
      <MemoryRouter>
        <ContradictionCentre />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rescan-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('rescan-button'));

    await waitFor(() => {
      expect(scanSpy).toHaveBeenCalled();
    });

    const banner = await screen.findByTestId('scan-message-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Scan complete: 2 new conflicts detected, 1 auto-resolved, 0 existing.');
  });
});

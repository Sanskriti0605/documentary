import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PdfPageViewer } from '../PdfPageViewer';
import { pdfService } from '../../../services/api';
import { useAppStore } from '../../../stores/useAppStore';

const mockPdfInfo = {
  page_count: 2,
  pages: [
    { page_number: 1, width: 612, height: 792 },
    { page_number: 2, width: 612, height: 792 },
  ],
};

const mockQuoteBoxes = {
  found: true,
  page_number: 1,
  boxes: [
    [50, 150, 500, 165],
    [50, 170, 420, 185],
  ],
  is_multiline: true,
  cross_page: null,
  warning: null,
};

const mockClauses = [
  {
    id: 'cl-1',
    document_id: 'doc-1',
    page_number: 1,
    clause_number: '1',
    section_title: 'Loan Terms',
    clause_text: 'The loan term shall be 36 months.',
    bounding_box: [50, 100, 300, 115],
  },
  {
    id: 'cl-2',
    document_id: 'doc-1',
    page_number: 1,
    clause_number: '2',
    section_title: 'Interest Rate',
    clause_text: 'Interest rate is 10.5% p.a.',
    bounding_box: [50, 200, 300, 215],
  },
];

describe('PdfPageViewerClean (Single Layer & Clean Render Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ showHighlights: true });
    vi.spyOn(pdfService, 'getPdfInfo').mockResolvedValue(mockPdfInfo);
    vi.spyOn(pdfService, 'getQuoteBoxes').mockResolvedValue(mockQuoteBoxes);
    // Reset window.location.search
    window.history.replaceState({}, '', '/viewer');
  });

  it('renders ZERO highlight DOM elements when no citation is active', async () => {
    render(
      <PdfPageViewer
        documentName="BNB_Personal_Loan_Agreement.pdf"
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
        targetQuote=""
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /highlights:/i })).toBeInTheDocument();
    });

    // Zero quote highlight rectangles in DOM
    expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();
    // Zero clause rectangles in DOM (default is clean, no debug boxes)
    expect(screen.queryByTestId('other-clause-rect')).toBeNull();
  });

  it('renders ONLY the active citation in single soft amber overlay (no clause boxes by default)', async () => {
    render(
      <PdfPageViewer
        documentName="BNB_Personal_Loan_Agreement.pdf"
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
        targetQuote="The loan term shall be 36 months"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      const rects = screen.getAllByTestId('quote-highlight-rect');
      expect(rects.length).toBe(2);
      // Soft amber style class
      expect(rects[0]).toHaveClass('bg-amber-400/30');
      expect(rects[0]).toHaveClass('border-amber-500');
    });

    // Other clause boxes must NOT be rendered in DOM by default
    expect(screen.queryByTestId('other-clause-rect')).toBeNull();
  });

  it('renders clause boxes ONLY when ?debug=boxes query param is set', async () => {
    window.history.replaceState({}, '', '/viewer?debug=boxes');

    render(
      <PdfPageViewer
        documentName="BNB_Personal_Loan_Agreement.pdf"
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
        targetQuote="The loan term shall be 36 months"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
      expect(screen.getAllByTestId('other-clause-rect').length).toBe(2);
    });
  });

  it('removes ALL overlay elements completely from the DOM when highlights are toggled OFF', async () => {
    useAppStore.setState({ showHighlights: false });
    window.history.replaceState({}, '', '/viewer?debug=boxes');

    render(
      <PdfPageViewer
        documentName="BNB_Personal_Loan_Agreement.pdf"
        currentPage={1}
        totalPages={2}
        onPageChange={vi.fn()}
        targetQuote="The loan term shall be 36 months"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('highlights-off-hint')).toBeInTheDocument();
    });

    // Zero quote boxes and zero other clause boxes in DOM
    expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();
    expect(screen.queryByTestId('other-clause-rect')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PdfPageViewer } from '../PdfPageViewer';
import { pdfService } from '../../../services/api';
import { useAppStore } from '../../../stores/useAppStore';

const mockPdfInfo = {
  page_count: 3,
  pages: [
    { page_number: 1, width: 612, height: 792 },
    { page_number: 2, width: 612, height: 792 },
    { page_number: 3, width: 612, height: 792 },
  ],
};

const mockQuoteBoxes = {
  found: true,
  page_number: 1,
  boxes: [
    [50, 200, 500, 218],
    [50, 222, 380, 240],
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
    clause_number: '1.1',
    section_title: 'Scope',
    clause_text: 'This master policy applies to all retail lending products.',
    bounding_box: [50, 100, 500, 120],
  },
  {
    id: 'cl-2',
    document_id: 'doc-1',
    page_number: 2,
    clause_number: '4.1',
    section_title: 'Penal Charges',
    clause_text: 'Penal charge for default shall be 2.0% per annum.',
    bounding_box: [50, 200, 500, 240],
  },
];

describe('PdfPageViewer Component (Highlight Toggle & Precision)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({ showHighlights: true });

    vi.spyOn(pdfService, 'getPdfInfo').mockResolvedValue(mockPdfInfo);
    vi.spyOn(pdfService, 'getQuoteBoxes').mockResolvedValue(mockQuoteBoxes);
  });

  it('renders viewer toolbar with Highlight ON/OFF button having aria-pressed and tooltip', async () => {
    render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        targetQuote="This master policy applies to all retail lending products."
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('pdf-page-viewer')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('highlight-toggle-button');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    expect(toggleBtn).toHaveTextContent(/Highlights: ON/i);
    expect(toggleBtn.getAttribute('title')).toContain('Shortcut: H');
  });

  it('toggle OFF completely removes overlay elements from the DOM (skips drawing rectangles)', async () => {
    render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        targetQuote="Penal charge for default"
        clauses={mockClauses}
      />
    );

    // Initial state: ON -> rectangles are in the DOM
    await waitFor(() => {
      const rects = screen.getAllByTestId('quote-highlight-rect');
      expect(rects.length).toBe(2);
    });

    // Toggle highlights to OFF
    const toggleBtn = screen.getByTestId('highlight-toggle-button');
    fireEvent.click(toggleBtn);

    // After toggling OFF, rectangles are completely removed from DOM
    await waitFor(() => {
      expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();
      expect(screen.queryByTestId('other-clause-rect')).toBeNull();
    });
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    expect(toggleBtn).toHaveTextContent(/Highlights: OFF/i);
  });

  it('toggle persists across page changes', async () => {
    let page = 1;
    const handlePageChange = vi.fn((p) => {
      page = p;
    });

    const { rerender } = render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={page}
        totalPages={3}
        onPageChange={handlePageChange}
        targetQuote="Penal charge for default"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
    });

    // Toggle OFF on Page 1
    const toggleBtn = screen.getByTestId('highlight-toggle-button');
    fireEvent.click(toggleBtn);
    expect(useAppStore.getState().showHighlights).toBe(false);

    // Navigate to Page 2
    rerender(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={2}
        totalPages={3}
        onPageChange={handlePageChange}
        targetQuote="Penal charge for default"
        clauses={mockClauses}
      />
    );

    // Highlights should still remain OFF on Page 2
    expect(useAppStore.getState().showHighlights).toBe(false);
    expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();
    expect(screen.getByTestId('highlight-toggle-button')).toHaveTextContent(/Highlights: OFF/i);
  });

  it('keyboard shortcut "H" toggles highlights on/off and is ignored when typing in inputs', async () => {
    render(
      <div>
        <input data-testid="test-input" type="text" />
        <PdfPageViewer
          documentName="BNB_Retail_Loan_Policy_2023.pdf"
          currentPage={1}
          totalPages={3}
          onPageChange={vi.fn()}
          targetQuote="Penal charge for default"
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
    });

    // 1. Typing 'h' inside an input must NOT toggle highlights
    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'h', code: 'KeyH' });
    expect(useAppStore.getState().showHighlights).toBe(true);

    // 2. Pressing 'h' globally on window toggles to OFF
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    expect(useAppStore.getState().showHighlights).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();
    });

    // 3. Pressing 'h' again toggles back to ON
    fireEvent.keyDown(window, { key: 'H', code: 'KeyH' });
    expect(useAppStore.getState().showHighlights).toBe(true);
    await waitFor(() => {
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
    });
  });

  it('OFF state hides other-citation outlines', async () => {
    render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        clauses={mockClauses}
      />
    );

    // Turn OFF
    const toggleBtn = screen.getByTestId('highlight-toggle-button');
    fireEvent.click(toggleBtn);

    // When OFF, no other clause rectangle outlines can exist in DOM
    expect(screen.queryByTestId('other-clause-rect')).toBeNull();
  });

  it('Focus Highlight button turns highlights back ON when clicked while OFF', async () => {
    useAppStore.setState({ showHighlights: false });

    render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        targetQuote="Penal charge for default"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('focus-highlight-button')).toBeInTheDocument();
    });

    // Highlights initially OFF
    expect(useAppStore.getState().showHighlights).toBe(false);
    expect(screen.queryByTestId('quote-highlight-rect')).toBeNull();

    // Clicking Focus Highlight turns highlights back ON
    const focusBtn = screen.getByTestId('focus-highlight-button');
    expect(focusBtn).toHaveTextContent(/Show & Focus/i);
    fireEvent.click(focusBtn);

    expect(useAppStore.getState().showHighlights).toBe(true);
    await waitFor(() => {
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
    });
  });

  it('shows non-blocking hint when citation is opened and highlights are OFF, with one-click Show button', async () => {
    useAppStore.setState({ showHighlights: false });

    render(
      <PdfPageViewer
        documentName="BNB_Retail_Loan_Policy_2023.pdf"
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        targetQuote="Penal charge for default"
        clauses={mockClauses}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('highlights-off-hint')).toBeInTheDocument();
    });

    expect(screen.getByText(/Highlights are off. The cited passage is available on this page./i)).toBeInTheDocument();

    // Click "Show Highlights" button in the hint
    const showBtn = screen.getByTestId('show-highlights-hint-button');
    fireEvent.click(showBtn);

    expect(useAppStore.getState().showHighlights).toBe(true);
    await waitFor(() => {
      expect(screen.queryByTestId('highlights-off-hint')).toBeNull();
      expect(screen.getAllByTestId('quote-highlight-rect').length).toBe(2);
    });
  });
});

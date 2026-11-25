import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PdfViewerPage } from '../PdfViewerPage';
import { documentService, pdfService } from '../../services/api';

const mockDocuments = [
  {
    id: 'doc-1',
    name: 'BNB_Retail_Loan_Policy_2023.pdf',
    file_path: '/uploads/BNB_Retail_Loan_Policy_2023.pdf',
    file_hash: '9a8b7c6d5e4f3a2b1c0d',
    document_type: 'MASTER_POLICY',
    domain: 'RETAIL_LENDING',
    status: 'PROCESSED',
    doc_status: 'IN_FORCE',
    page_count: 3,
    clause_count: 5,
    created_at: '2023-01-01T00:00:00',
    updated_at: '2023-01-01T00:00:00',
  },
  {
    id: 'doc-2',
    name: 'BNB_Loan_Policy_Amendment_2025.pdf',
    file_path: '/uploads/BNB_Loan_Policy_Amendment_2025.pdf',
    file_hash: '1a2b3c4d5e6f7a8b9c0d',
    document_type: 'CIRCULAR',
    domain: 'RETAIL_LENDING',
    status: 'PROCESSED',
    doc_status: 'IN_FORCE',
    page_count: 2,
    clause_count: 3,
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
  },
];

const mockClauses = [
  {
    id: 'cl-1',
    document_id: 'doc-1',
    page_number: 1,
    clause_number: '1.1',
    section_title: 'Scope',
    clause_text: 'This master policy applies to all retail lending products including personal loans.',
    bounding_box: [50, 100, 500, 120],
  },
  {
    id: 'cl-2',
    document_id: 'doc-1',
    page_number: 1,
    clause_number: '4.1',
    section_title: 'Penal Charges for Default',
    clause_text: 'The penal charge for default on personal loan monthly installments shall be 2.0% per annum on the overdue amount.',
    bounding_box: [50, 200, 500, 240],
  },
  {
    id: 'cl-3',
    document_id: 'doc-1',
    page_number: 2,
    clause_number: '5.2',
    section_title: 'Minimum CIBIL Score',
    clause_text: 'All retail lending applicants must possess a minimum credit bureau CIBIL score of 720.',
    bounding_box: [50, 150, 500, 175],
  },
];

describe('PdfViewerPage Component (/viewer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(documentService, 'listDocuments').mockResolvedValue({
      total: 2,
      documents: mockDocuments as any,
    });

    vi.spyOn(documentService, 'getClauses').mockResolvedValue(mockClauses as any);

    vi.spyOn(pdfService, 'getPdfInfo').mockResolvedValue({
      page_count: 3,
      pages: [
        { page_number: 1, width: 612, height: 792 },
        { page_number: 2, width: 612, height: 792 },
        { page_number: 3, width: 612, height: 792 },
      ],
    });

    vi.spyOn(pdfService, 'getQuoteBoxes').mockResolvedValue({
      found: true,
      page_number: 1,
      boxes: [
        [50, 200, 500, 218],
        [50, 222, 380, 240],
      ],
      is_multiline: true,
      cross_page: null,
      warning: null,
    });
  });

  it('renders viewer page, document switcher, page navigation, and metadata sidebar', async () => {
    render(
      <MemoryRouter initialEntries={['/viewer?doc=BNB_Retail_Loan_Policy_2023.pdf&page=1']}>
        <PdfViewerPage />
      </MemoryRouter>
    );

    // Verify main components rendered
    await waitFor(() => {
      expect(screen.getByTestId('pdf-viewer-page')).toBeInTheDocument();
      expect(screen.getByTestId('document-switcher-select')).toBeInTheDocument();
      expect(screen.getByTestId('pdf-viewport-container')).toBeInTheDocument();
    });

    // Check page navigation controls
    expect(screen.getByTestId('prev-page-button')).toBeInTheDocument();
    expect(screen.getByTestId('next-page-button')).toBeInTheDocument();
    expect(screen.getByText(/3 pages/i)).toBeInTheDocument();

    // Check Document Lineage metadata rendered
    expect(screen.getByText('Document Lineage')).toBeInTheDocument();
    expect(screen.getByText('BNB_Retail_Loan_Policy_2023.pdf')).toBeInTheDocument();
    expect(screen.getByText(/SHA: 9a8b7c6d5e/i)).toBeInTheDocument();

    // Check Other Citations section rendered
    expect(screen.getByText('Other Citations in Document')).toBeInTheDocument();
    expect(screen.getByText(/Clause 1.1: Scope/i)).toBeInTheDocument();
  });

  it('overlays multi-line highlight rectangles for cited quote', async () => {
    const targetQuote = 'The penal charge for default on personal loan monthly installments shall be 2.0% per annum on the overdue amount.';

    render(
      <MemoryRouter
        initialEntries={[
          `/viewer?doc=BNB_Retail_Loan_Policy_2023.pdf&page=1&quote=${encodeURIComponent(targetQuote)}`,
        ]}
      >
        <PdfViewerPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const rects = screen.getAllByTestId('quote-highlight-rect');
      expect(rects.length).toBe(2); // Multi-line boxes: 2 lines
    });

    // Verify target citation quote card displayed in sidebar
    expect(screen.getByText('Target Citation Quote')).toBeInTheDocument();
    expect(screen.getByText(`"${targetQuote}"`)).toBeInTheDocument();
    expect(screen.getByText(/2 line rectangles highlighted/i)).toBeInTheDocument();
  });

  it('displays visible warning banner when quote bounding box cannot be located', async () => {
    vi.spyOn(pdfService, 'getQuoteBoxes').mockResolvedValue({
      found: false,
      page_number: 1,
      boxes: [],
      is_multiline: false,
      warning: 'Exact bounding box coordinates cannot be found for this quote.',
    });

    const missingQuote = 'Non-existent quote that cannot be found on page coordinates.';

    render(
      <MemoryRouter
        initialEntries={[
          `/viewer?doc=BNB_Retail_Loan_Policy_2023.pdf&page=1&quote=${encodeURIComponent(missingQuote)}`,
        ]}
      >
        <PdfViewerPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('missing-bbox-warning')).toBeInTheDocument();
    });

    expect(screen.getByText('Bounding Box Unavailable on Current Page')).toBeInTheDocument();
    expect(screen.getAllByText(`"${missingQuote}"`).length).toBeGreaterThanOrEqual(1);
  });

  it('supports document switching and citation navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/viewer?doc=BNB_Retail_Loan_Policy_2023.pdf&page=1']}>
        <PdfViewerPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('document-switcher-select')).toBeInTheDocument();
    });

    // Switch to second document
    const select = screen.getByTestId('document-switcher-select');
    fireEvent.change(select, { target: { value: 'BNB_Loan_Policy_Amendment_2025.pdf' } });

    await waitFor(() => {
      expect(documentService.getClauses).toHaveBeenCalled();
    });

    // Click on another citation
    const otherCitation = screen.getByText(/Clause 1.1: Scope/i);
    fireEvent.click(otherCitation);

    expect(screen.getByText('Target Citation Quote')).toBeInTheDocument();
  });
});

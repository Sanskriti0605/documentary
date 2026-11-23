import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AmendmentExplorer } from '../AmendmentExplorer';
import { amendmentService } from '../../services/api';
import { AmendmentResolutionResponse } from '../../types';

describe('AmendmentExplorer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockResolution: AmendmentResolutionResponse = {
    rule: 'penal_charges',
    as_of: '2024-05-01',
    version_in_force: {
      document_id: 'doc-ext',
      document_name: 'RBI_Extension_Circular_Dec2023.pdf',
      document_type: 'RBI_CIRCULAR',
      clause_number: '2',
      effective_from: '2024-04-01',
      status: 'IN_FORCE',
      quote: 'Paragraph 2: Implementation timeline extended to April 1, 2024. Penalty must strictly be designated as penal charges.',
      amending_quote: 'In partial modification of earlier circular, timeline extended to April 1, 2024.',
      is_partial_amendment: false,
      applicability_conditions: {
        lender_type: 'All Regulated Entities (Commercial Banks, NBFCs, HFCs)',
        sanction_date: 'New loans from April 1, 2024; existing loan transition deadline extended to June 30, 2024',
        scope: 'Retail Loan Accounts'
      }
    },
    chain: [
      {
        id: 'node-1',
        document_id: 'doc-draft',
        document_name: 'RBI_Draft_Circular_Penal_Charges_Apr2023.pdf',
        document_type: 'RBI_CIRCULAR',
        clause_number: 'Draft-Para-1',
        publication_date: '2023-04-12',
        effective_from: '2023-04-12',
        status: 'DRAFT_NON_BINDING',
        relationship_to_prior: 'CLARIFIES',
        quote: 'Draft Guidelines on Penal Charges for public comments.',
        amending_quote: 'Consultative paper - non-binding'
      },
      {
        id: 'node-2',
        document_id: 'doc-baseline',
        document_name: 'BNB_Retail_Loan_Policy_2023.pdf',
        document_type: 'BANK_LOAN_POLICY',
        clause_number: '4.1',
        publication_date: '2023-01-01',
        effective_from: '2023-01-01',
        status: 'SUPERSEDED',
        quote: 'Clause 4.1: Penal charge shall be 2.0% per annum on default.',
        amending_quote: 'Baseline bank policy'
      },
      {
        id: 'node-3',
        document_id: 'doc-ext',
        document_name: 'RBI_Extension_Circular_Dec2023.pdf',
        document_type: 'RBI_CIRCULAR',
        clause_number: '2',
        publication_date: '2023-12-29',
        effective_from: '2024-04-01',
        status: 'IN_FORCE',
        relationship_to_prior: 'EXTENDS',
        quote: 'Paragraph 2: Implementation timeline extended to April 1, 2024. Penalty must strictly be designated as penal charges.',
        amending_quote: 'In partial modification of earlier circular, timeline extended to April 1, 2024.'
      }
    ],
    nodes: [
      {
        id: 'node-1',
        label: 'RBI_Draft_Circular_Penal_Charges_Apr2023.pdf\n[DRAFT_NON_BINDING]',
        document_name: 'RBI_Draft_Circular_Penal_Charges_Apr2023.pdf',
        document_type: 'RBI_CIRCULAR',
        clause_number: 'Draft-Para-1',
        clause_text: 'Draft Guidelines on Penal Charges.',
        effective_from: '2023-04-12',
        status: 'DRAFT_NON_BINDING'
      },
      {
        id: 'node-2',
        label: 'BNB_Retail_Loan_Policy_2023.pdf\n[SUPERSEDED]',
        document_name: 'BNB_Retail_Loan_Policy_2023.pdf',
        document_type: 'BANK_LOAN_POLICY',
        clause_number: '4.1',
        clause_text: 'Penal charge 2.0% per annum.',
        effective_from: '2023-01-01',
        status: 'SUPERSEDED'
      },
      {
        id: 'node-3',
        label: 'RBI_Extension_Circular_Dec2023.pdf\n[IN_FORCE]',
        document_name: 'RBI_Extension_Circular_Dec2023.pdf',
        document_type: 'RBI_CIRCULAR',
        clause_number: '2',
        clause_text: 'Implementation timeline extended to April 1, 2024.',
        effective_from: '2024-04-01',
        status: 'IN_FORCE'
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-2',
        target: 'node-1',
        relationship: 'supersedes',
        effective_date: '2023-08-18'
      },
      {
        id: 'edge-2',
        source: 'node-3',
        target: 'node-2',
        relationship: 'extends',
        effective_date: '2024-04-01'
      }
    ],
    timeline: [
      {
        date: '2023-04-12',
        event_type: 'PUBLISHED',
        document_name: 'RBI_Draft_Circular_Penal_Charges_Apr2023.pdf',
        clause_number: 'Draft-Para-1',
        description: 'RBI Draft Circular - Fair Lending Practice (DRAFT_NON_BINDING)',
        clause_id: 'node-1',
        status: 'DRAFT_NON_BINDING',
        quote: 'Draft Guidelines on Penal Charges for public comments.'
      },
      {
        date: '2024-04-01',
        event_type: 'EXTENDS',
        document_name: 'RBI_Extension_Circular_Dec2023.pdf',
        clause_number: '2',
        description: 'RBI Circular Extension of Timeline (IN_FORCE)',
        clause_id: 'node-3',
        status: 'IN_FORCE',
        quote: 'Implementation timeline extended to April 1, 2024.'
      }
    ],
    available_rules: [
      { id: 'penal_charges', name: 'Penal Charges & Default Interest (RBI Fair Lending / Bank Policy)' },
      { id: 'interest_rate', name: 'Rate of Interest (Sanction Letter vs Loan Agreement)' },
      { id: 'foreclosure_charges', name: 'Foreclosure & Prepayment Fees (Floating Rate Rules)' }
    ]
  };

  it('renders rule selector, as-of date picker, and quick preset milestones', async () => {
    vi.spyOn(amendmentService, 'resolveAmendments').mockResolvedValueOnce(mockResolution);

    render(
      <MemoryRouter>
        <AmendmentExplorer />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('amendment-controls-bar')).toBeInTheDocument();
    });

    // Rule selector
    const ruleSelect = screen.getByTestId('rule-selector');
    expect(ruleSelect).toBeInTheDocument();
    expect(ruleSelect).toHaveValue('penal_charges');

    // Date picker
    const datePicker = screen.getByTestId('as-of-date-picker');
    expect(datePicker).toBeInTheDocument();

    // Preset buttons
    expect(screen.getByTestId('date-presets-container')).toBeInTheDocument();
    expect(screen.getByText(/Apr 2023 \(Draft Non-Binding\)/i)).toBeInTheDocument();
    expect(screen.getByText(/May 2024 \(RBI Circular In Force\)/i)).toBeInTheDocument();
  });

  it('highlights the version in force with amending quote and applicability conditions', async () => {
    vi.spyOn(amendmentService, 'resolveAmendments').mockResolvedValueOnce(mockResolution);

    render(
      <MemoryRouter>
        <AmendmentExplorer />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('version-in-force-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('version-in-force-badge')).toHaveTextContent('Version in Force as of 2024-05-01');
    expect(screen.getByTestId('in-force-document-name')).toHaveTextContent('RBI_Extension_Circular_Dec2023.pdf');

    // Amending quote box
    const amendingBox = screen.getByTestId('amending-quote-box');
    expect(amendingBox).toBeInTheDocument();
    expect(amendingBox).toHaveTextContent(/In partial modification of earlier circular, timeline extended to April 1, 2024./i);

    // Operative clause quote
    const operativeQuote = screen.getByTestId('in-force-provision-quote');
    expect(operativeQuote).toHaveTextContent(/Implementation timeline extended to April 1, 2024/i);

    // Applicability conditions
    expect(screen.getByTestId('applicability-conditions-section')).toBeInTheDocument();
    expect(screen.getByTestId('applicability-lender-type')).toHaveTextContent('All Regulated Entities (Commercial Banks, NBFCs, HFCs)');
    expect(screen.getByTestId('applicability-sanction-date')).toHaveTextContent('New loans from April 1, 2024');
  });

  it('renders graph view with colored nodes by status', async () => {
    vi.spyOn(amendmentService, 'resolveAmendments').mockResolvedValueOnce(mockResolution);

    render(
      <MemoryRouter>
        <AmendmentExplorer />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('amendment-graph-container')).toBeInTheDocument();
    });

    // Check node text rendered
    const docTitles = screen.getAllByText('RBI_Extension_Circular_Dec2023.pdf');
    expect(docTitles.length).toBeGreaterThan(0);
    expect(screen.getByText('IN FORCE')).toBeInTheDocument();
    expect(screen.getByText('DRAFT NON BINDING')).toBeInTheDocument();
    expect(screen.getByText('SUPERSEDED')).toBeInTheDocument();
  });

  it('switches between graph, timeline, and linear chain views', async () => {
    vi.spyOn(amendmentService, 'resolveAmendments').mockResolvedValue(mockResolution);

    render(
      <MemoryRouter>
        <AmendmentExplorer />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('amendment-graph-container')).toBeInTheDocument();
    });

    // Switch to Timeline View
    fireEvent.click(screen.getByTestId('view-timeline-button'));
    await waitFor(() => {
      expect(screen.getByTestId('amendment-timeline-container')).toBeInTheDocument();
    });
    const timelineEvents = screen.getAllByTestId('timeline-event-card');
    expect(timelineEvents.length).toBe(2);
    expect(screen.getByText('2023-04-12')).toBeInTheDocument();
    const dates = screen.getAllByText('2024-04-01');
    expect(dates.length).toBeGreaterThanOrEqual(1);

    // Switch to Linear Chain View
    fireEvent.click(screen.getByTestId('view-chain-button'));
    await waitFor(() => {
      expect(screen.getByTestId('linear-chain-container')).toBeInTheDocument();
    });
    const chainSteps = screen.getAllByTestId('chain-step-card');
    expect(chainSteps.length).toBe(3);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('triggers resolution update when as-of preset button is clicked', async () => {
    const resolveSpy = vi.spyOn(amendmentService, 'resolveAmendments').mockResolvedValue(mockResolution);

    render(
      <MemoryRouter>
        <AmendmentExplorer />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('preset-button-0')).toBeInTheDocument();
    });

    // Click Apr 2023 preset
    fireEvent.click(screen.getByTestId('preset-button-0'));

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith('penal_charges', '2023-06-01');
    });
  });
});

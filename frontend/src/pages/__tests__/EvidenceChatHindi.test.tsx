import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceChat } from '../EvidenceChat';
import { askService } from '../../services/api';
import { AskResponse } from '../../types';

describe('EvidenceChat Multilingual (Hindi) Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockHindiResponse: AskResponse = {
    session_id: 'hindi-session-123',
    query: 'क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?',
    answer: 'हां, 1 जनवरी 2025 से लागू आरबीआई मास्टर निर्देशों के अनुसार व्यक्तिगत फ्लोटिंग रेट ऋणों पर फोरक्लोज़र शुल्क पूर्ण रूप से प्रतिबंधित हैं।',
    english_answer: 'Yes, foreclosure charges on individual floating rate loans are strictly prohibited under RBI Master Directions effective 1 Jan 2025.',
    requested_language: 'auto',
    detected_language: 'hi',
    answer_language: 'hi',
    translation_status: 'translated',
    translator: 'local-compliance-engine',
    status: 'VERIFIED',
    faithfulness_score: 100.0,
    generated_count: 1,
    verified_count: 1,
    blocked_count: 0,
    generation_provider: 'local-extractive-engine',
    is_fallback: false,
    verified_claims: [
      {
        text: 'आरबीआई निर्देशों के तहत फ्लोटिंग रेट लोन पर फोरक्लोज़र शुल्क प्रतिबंधित हैं।',
        verdict: 'VERIFIED',
        status: 'VERIFIED',
        verifier: 'DeBERTa-v3 NLI',
        generator: 'local-extractive-engine',
        is_fallback: false,
        citations: [
          {
            id: 'cit-1',
            document_name: 'SYN_02_RBI_MD_Lending_Operations.pdf',
            page_number: 1,
            clause_number: '3.1',
            quote: 'No foreclosure charges or pre-payment penalties shall be levied on floating rate loans.',
            exact_quote: 'No foreclosure charges or pre-payment penalties shall be levied on floating rate loans.',
          },
        ],
      },
    ],
    blocked_claims: [],
    retrieved_quotes: [],
  };

  it('renders language selector and sends selected language in ask request', async () => {
    const askSpy = vi.spyOn(askService, 'ask').mockResolvedValueOnce(mockHindiResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const langSelect = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(langSelect).toBeInTheDocument();
    expect(langSelect.value).toBe('auto');

    // Change language to Hindi
    fireEvent.change(langSelect, { target: { value: 'hi' } });
    expect(langSelect.value).toBe('hi');

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(askSpy).toHaveBeenCalledWith(
        'क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?',
        undefined,
        expect.any(String),
        'hi'
      );
    });
  });

  it('displays Hindi answer, Hindi UI labels, and toggles English original', async () => {
    vi.spyOn(askService, 'ask').mockResolvedValueOnce(mockHindiResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('ask-response-container')).toBeInTheDocument();
    });

    // Check Hindi answer displayed
    const answerEl = screen.getByTestId('response-answer-text');
    expect(answerEl).toHaveTextContent(/व्यक्तिगत फ्लोटिंग रेट ऋणों पर फोरक्लोज़र शुल्क पूर्ण रूप से प्रतिबंधित हैं/i);

    // Check Hindi UI elements
    expect(screen.getByText(/उत्तर सारांश/i)).toBeInTheDocument();
    expect(screen.getAllByText(/साक्ष्य आधार/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId('claim-verdict-verified')).toHaveTextContent(/सत्यापित/i);

    // Toggle English Original
    const toggleBtn = screen.getByTestId('toggle-english-original-button');
    expect(toggleBtn).toHaveTextContent(/अंग्रेजी मूल देखें/i);

    fireEvent.click(toggleBtn);
    expect(answerEl).toHaveTextContent(/Yes, foreclosure charges on individual floating rate loans are strictly prohibited/i);
    expect(toggleBtn).toHaveTextContent(/हिंदी अनुवाद देखें/i);

    // Toggle back to Hindi
    fireEvent.click(toggleBtn);
    expect(answerEl).toHaveTextContent(/व्यक्तिगत फ्लोटिंग रेट ऋणों पर फोरक्लोज़र शुल्क पूर्ण रूप से प्रतिबंधित हैं/i);
  });

  it('shows visible banner when translation is unavailable', async () => {
    const unavailableResponse: AskResponse = {
      ...mockHindiResponse,
      answer: 'Yes, foreclosure charges on floating rate loans are prohibited.',
      english_answer: 'Yes, foreclosure charges on floating rate loans are prohibited.',
      answer_language: 'en',
      translation_status: 'unavailable',
    };

    vi.spyOn(askService, 'ask').mockResolvedValueOnce(unavailableResponse);

    render(
      <MemoryRouter>
        <EvidenceChat />
      </MemoryRouter>
    );

    const input = screen.getByTestId('query-input');
    const button = screen.getByTestId('ask-submit-button');

    fireEvent.change(input, { target: { value: 'क्या फ्लोटिंग रेट लोन पर फोरक्लोज़र चार्ज प्रतिबंधित हैं?' } });
    fireEvent.click(button);

    const banner = await screen.findByTestId('translation-unavailable-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/अनुवाद अनुपलब्ध/i);
    expect(banner).toHaveTextContent(/वर्तमान में हिंदी अनुवाद अनुपलब्ध है: सत्यापित अंग्रेजी उत्तर दिखाया जा रहा है।/i);
  });
});

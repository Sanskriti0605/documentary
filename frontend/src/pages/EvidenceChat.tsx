import React, { useState } from 'react';
import {
  Send,
  Percent,
  ExternalLink,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { askService, AskResponse } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAppStore } from '../stores/useAppStore';
import { useNavigate } from 'react-router-dom';

export const EvidenceChat: React.FC = () => {
  const [queryText, setQueryText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState<boolean>(false);

  const { asOfDate } = useAppStore();
  const navigate = useNavigate();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const data = await askService.ask(queryText, undefined, asOfDate);
      setResponse(data);
    } catch (err) {
      console.error('Query execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCitationClick = (docName: string, pageNum: number, bbox?: number[]) => {
    const bboxStr = bbox ? `&bbox=${bbox.join(',')}` : '';
    navigate(`/viewer?doc=${docName}&page=${pageNum}${bboxStr}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Ask VerifyDoc</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verifiable multi-document question answering. Factual claims require 100% verified citations, or the system strictly abstains.
        </p>
      </div>

      {/* Query Input Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <form onSubmit={handleAsk} className="space-y-3">
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="e.g. What is the current penal charge rate for personal loan default in force as of 2026?"
            rows={3}
            className="w-full p-3 border border-slate-200 rounded-lg text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2">
            <div className="text-xs text-slate-500 flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Evaluation As-Of Date:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-navy-900 font-semibold">{asOfDate}</span>
            </div>
            <button
              type="submit"
              disabled={loading || !queryText.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Verifying Evidence...' : 'Ask VerifyDoc'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Response Card */}
      {response && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
          {/* Status & Faithfulness Meter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center space-x-3">
              <StatusBadge status={response.status} className="text-sm px-3 py-1" />
              <div className="text-xs text-slate-500">
                Claims breakdown: <strong className="text-slate-800">{response.verified_count} verified</strong>,{' '}
                <strong className="text-rose-600">{response.blocked_count} blocked</strong> (Total: {response.generated_count})
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Percent className="w-4 h-4 text-blue-600" />
              <span className="text-slate-600 font-medium">Faithfulness:</span>
              <span className="font-bold text-navy-950 text-sm">{response.faithfulness_score}%</span>
            </div>
          </div>

          {/* Generated Answer */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Response</h3>
            <div className="p-4 bg-slate-50 rounded-lg text-slate-800 text-sm leading-relaxed border border-slate-200/60 font-medium">
              {response.answer}
            </div>
          </div>

          {/* Financial Calculation Card (if present) */}
          {response.calculation && (
            <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-sm">
                <Calculator className="w-4 h-4 text-blue-700" />
                <span>Deterministic Financial Calculation ({response.calculation.type})</span>
              </div>
              <p className="text-xs font-semibold text-blue-950">{response.calculation.summary}</p>

              {response.calculation.result?.steps && (
                <div className="p-3 bg-white/80 rounded border border-blue-100 text-xs font-mono text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 text-[11px] mb-1">AUDIT WORKING STEPS:</div>
                  {response.calculation.result.steps.map((step: string, sIdx: number) => (
                    <div key={sIdx}>{step}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Blocked Claims Box */}
          {response.blocked_claims && response.blocked_claims.length > 0 && (
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Verification Gate: {response.blocked_claims.length} Claims Blocked</span>
              </div>
              <div className="space-y-2">
                {response.blocked_claims.map((bc, bIdx) => (
                  <div key={bIdx} className="text-xs text-rose-800 bg-white p-2.5 rounded border border-rose-200">
                    <p className="font-semibold text-rose-900">"{bc.original_claim}"</p>
                    <p className="text-[11px] text-rose-700 mt-1">{bc.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verified Claims & Citation Chips */}
          {response.verified_claims && response.verified_claims.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Verified Documentary Claims & Citations
              </h3>
              <div className="space-y-3">
                {response.verified_claims.map((claim, idx) => (
                  <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {idx + 1}. {claim.text}
                      </div>
                      <StatusBadge status="VERIFIED" />
                    </div>

                    {/* Citation Chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {claim.citations.map((cit, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleCitationClick(cit.document_name, cit.page_number, cit.bounding_box)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-md border border-slate-200 text-xs transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold">{cit.document_name} &bull; P.{cit.page_number}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Drawer Toggle */}
          <div className="border-t border-slate-100 pt-3">
            <button
              onClick={() => setShowEvidenceDrawer(!showEvidenceDrawer)}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>{showEvidenceDrawer ? 'Hide Evidence Drawer' : `View Retrieved Evidence Clauses (${response.retrieved_quotes?.length || 0})`}</span>
              {showEvidenceDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showEvidenceDrawer && (
              <div className="mt-4 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {response.retrieved_quotes.map((rq, rIdx) => (
                  <div key={rIdx} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-semibold">
                      <span>{rq.document_name} &bull; Page {rq.page_number} (Clause {rq.clause_number || 'N/A'})</span>
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">RRF: {rq.retrieval_score}</span>
                    </div>
                    <p className="text-slate-700">{rq.clause_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

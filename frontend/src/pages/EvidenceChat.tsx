import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  Percent,
  Calculator,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  BookOpen,
  Loader2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  GitBranch,
  Flame,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ServerCrash,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { askService } from '../services/api';
import { AskResponse } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { CitationChip } from '../components/common/CitationChip';
import { useAppStore } from '../stores/useAppStore';

export const EvidenceChat: React.FC = () => {
  const [queryText, setQueryText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendDown, setIsBackendDown] = useState<boolean>(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState<boolean>(false);

  const { asOfDate } = useAppStore();

  const handleAsk = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const query = overrideQuery || queryText;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setIsBackendDown(false);

    try {
      const data = await askService.ask(query, undefined, asOfDate);
      setResponse(data);
    } catch (err: any) {
      console.error('Query execution failed:', err);
      const isNetworkErr =
        err?.code === 'ERR_NETWORK' ||
        err?.message?.includes('Network Error') ||
        err?.message?.includes('Failed to fetch') ||
        !err?.response;

      if (isNetworkErr) {
        setIsBackendDown(true);
        setError('Backend service is unreachable. Please verify that the FastAPI backend is running on port 8001.');
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Failed to process inquiry. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    'What is the foreclosure fee for prepayment of the personal loan facility?',
    'What is the agreed rate of interest for Rajesh Sharma\'s personal loan?',
    'What is the current penal charge rate for personal loan default in force as of 2026?',
    'Calculate the processing fee with 18% GST for a personal loan of INR 500,000.',
    'What is the interest subvention percentage for agricultural tractor loans?'
  ];

  const hasEmptyResult =
    response &&
    (!response.verified_claims || response.verified_claims.length === 0) &&
    (!response.blocked_claims || response.blocked_claims.length === 0) &&
    !response.calculation;

  const isConditionalOrMissing =
    response &&
    (response.status === 'INSUFFICIENT_EVIDENCE' ||
      (response.blocked_count > 0 && response.verified_count === 0));

  return (
    <div className="space-y-6 max-w-5xl mx-auto" data-testid="evidence-chat-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Ask VerifyDoc</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verifiable multi-document Document AI for Indian financial documents. Every claim requires verbatim source citations,
          or the system strictly abstains.
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
            data-testid="query-input"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2">
            <div className="text-xs text-slate-500 flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Evaluation As-Of Date:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-navy-900 font-semibold">{asOfDate}</span>
            </div>
            <button
              type="submit"
              disabled={loading || !queryText.trim()}
              data-testid="ask-submit-button"
              className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Evidence...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Ask VerifyDoc</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div data-testid="loading-state" className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="flex justify-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="text-base font-bold text-navy-950">Evaluating Verification Gate</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Retrieving multi-document clauses, executing DeBERTa-v3 cross-encoder NLI entailment, and checking deterministic number/date consistency...
            </p>
          </div>
        </div>
      )}

      {/* Backend-Down Error State */}
      {isBackendDown && !loading && (
        <div data-testid="backend-down-error" className="bg-rose-50 border border-rose-300 rounded-xl p-6 text-rose-900 space-y-4 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0">
              <ServerCrash className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-rose-950">Backend Verification Service Offline</h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                Unable to reach the VerifyDoc backend at <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">http://localhost:8001</code>.
                The verification engine, Qdrant/BM25 retrieval, and NLI models require the FastAPI service to be active.
              </p>
            </div>
          </div>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={() => handleAsk()}
              data-testid="retry-button"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
            <span className="text-xs text-rose-700">Check terminal or run: <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">uvicorn app.main:app --port 8001</code></span>
          </div>
        </div>
      )}

      {/* General Error State */}
      {error && !isBackendDown && !loading && (
        <div data-testid="general-error" className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Inquiry Verification Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={() => handleAsk()}
            data-testid="retry-button"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Question</span>
          </button>
        </div>
      )}

      {/* Empty State / Suggestions */}
      {!response && !loading && !error && (
        <div data-testid="empty-initial-state" className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-navy-950">Ready to Answer with 100% Verifiable Evidence</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Ask questions across RBI Master Directions, Sanction Letters, Loan Policies, and Schedules of Charges. Claims without proof will be strictly blocked.
            </p>
          </div>
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Suggested Inquiries</div>
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQueryText(q);
                    handleAsk(undefined, q);
                  }}
                  className="text-left text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-blue-500 inline mr-1.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Response Display */}
      {response && !loading && (
        <div data-testid="ask-response-container" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
          {/* Top Status, Faithfulness Meter, and Badges */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge status={response.status} className="text-sm px-3 py-1" />

              {/* Conflict Found Badge */}
              {response.conflict_found && (
                <Link
                  to={`/contradictions?subject=${encodeURIComponent(response.conflict_subject || '')}`}
                  data-testid="conflict-found-badge"
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold shadow-sm transition-colors"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Conflict found: {response.conflict_subject || 'Subject overlap'}</span>
                  <ArrowRight className="w-3 h-3 ml-0.5" />
                </Link>
              )}

              {/* Version Chain Link */}
              {response.has_version_chain && (
                <Link
                  to="/amendments"
                  data-testid="version-chain-link"
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md text-xs font-semibold transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                  <span>Version chain</span>
                </Link>
              )}

              {/* Fallback Mode or LLM Indicator */}
              {response.is_fallback ? (
                <span data-testid="fallback-mode-badge" className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-xs font-semibold">
                  <span>⚡ Fallback Mode (Extractive Grounding)</span>
                </span>
              ) : (
                <span data-testid="llm-mode-badge" className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-semibold">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ollama ({response.model_name || 'qwen2.5:7b'})</span>
                </span>
              )}
            </div>

            {/* Faithfulness Meter & Counts */}
            <div className="flex items-center space-x-4">
              <div className="text-xs text-slate-500" data-testid="claims-count-text">
                <span className="font-semibold text-slate-800">{response.generated_count} generated, {response.blocked_count} blocked</span>
              </div>

              <div data-testid="faithfulness-meter" className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
                <Percent className="w-4 h-4 text-blue-600" />
                <span className="text-slate-600 font-medium">Faithfulness:</span>
                <span className="font-bold text-navy-950 text-sm">{response.faithfulness_score}%</span>
              </div>
            </div>
          </div>

          {/* Empty Result Notification */}
          {hasEmptyResult && (
            <div data-testid="empty-result-state" className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="font-bold text-sm text-navy-950">No Documentary Evidence Found</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                No verifiable clauses were retrieved matching "{response.query}". Under the VerifyDoc protocol, the engine abstains rather than halluncinating.
              </p>
            </div>
          )}

          {/* Missing-Information / Conditional Answer Notice */}
          {isConditionalOrMissing && (
            <div data-testid="missing-information-box" className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Conditional Answer &bull; Missing Documentary Proof</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                The verification gate identified missing evidence required to definitively certify this answer.
                Any unverified claims have been blocked to prevent reliance on incomplete clauses.
              </p>
            </div>
          )}

          {/* Generated Answer Summary */}
          {response.answer && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Response Summary</h3>
              <div data-testid="response-answer-text" className="p-4 bg-slate-50 rounded-lg text-slate-800 text-sm leading-relaxed border border-slate-200/60 font-medium">
                {response.answer}
              </div>
            </div>
          )}

          {/* Financial Calculation Card */}
          {response.calculation && (
            <div data-testid="calculation-card" className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
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

          {/* Claims List with Verdicts */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Claims & Verification Gate Verdicts</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {response.verified_count} Verified &bull; {response.blocked_count} Blocked
              </span>
            </h3>

            {/* Verified Claims */}
            {response.verified_claims && response.verified_claims.length > 0 && (
              <div className="space-y-3" data-testid="verified-claims-list">
                {response.verified_claims.map((claim, idx) => {
                  const claimVerifier = claim.verifier || 'DeBERTa-v3 NLI';
                  const claimGenerator = claim.generator || response.generation_provider || (response.is_fallback ? 'extractive-grounding' : 'ollama-qwen2.5');
                  const claimIsFallback = claim.is_fallback ?? response.is_fallback;

                  return (
                    <div
                      key={`verified-${idx}`}
                      data-testid="verified-claim-card"
                      className="p-4 border border-emerald-200 bg-emerald-50/30 rounded-xl space-y-2.5 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex items-start space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="text-sm font-semibold text-slate-900 leading-snug">
                            {claim.text}
                          </div>
                        </div>

                        {/* Badges for Verdict, Verifier, Generator, Fallback */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <span
                            data-testid="claim-verdict-verified"
                            className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase"
                          >
                            {claim.verdict || 'VERIFIED'}
                          </span>
                          <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            Verifier: {claimVerifier}
                          </span>
                          <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            Generator: {claimGenerator}
                          </span>
                          {claimIsFallback && (
                            <span data-testid="claim-fallback-badge" className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                              ⚡ Fallback Mode
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reusable Citation Chips with Hover Quote */}
                      {claim.citations && claim.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1 pl-6">
                          {claim.citations.map((cit, cIdx) => (
                            <CitationChip
                              key={cIdx}
                              documentName={cit.document_name}
                              pageNumber={cit.page_number}
                              quote={cit.quote || cit.exact_quote}
                              clauseNumber={cit.clause_number}
                              boundingBox={cit.bounding_box || undefined}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Blocked Claims (Prominent Red Box with "searched for" and "missing") */}
            {response.blocked_claims && response.blocked_claims.length > 0 && (
              <div className="space-y-3" data-testid="blocked-claims-list">
                {response.blocked_claims.map((bc, bIdx) => {
                  const bcVerifier = bc.verifier || 'deterministic-regex / DeBERTa-v3';
                  const bcGenerator = bc.generator || response.generation_provider || (response.is_fallback ? 'extractive-grounding' : 'ollama-qwen2.5');
                  const bcIsFallback = bc.is_fallback ?? response.is_fallback;
                  const searchedFor = bc.searched_for || bc.original_claim;
                  const missingReason = bc.missing || bc.reason || bc.message;

                  return (
                    <div
                      key={`blocked-${bIdx}`}
                      data-testid="blocked-claim-card"
                      className="p-4 bg-rose-50/90 border border-rose-300 rounded-xl space-y-3 shadow-sm text-rose-950"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex items-start space-x-2">
                          <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                              Claim Blocked by Verification Gate
                            </span>
                            <p className="text-sm font-semibold text-rose-950 mt-0.5">
                              "{bc.original_claim}"
                            </p>
                          </div>
                        </div>

                        {/* Badges for Verdict, Verifier, Generator */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <span
                            data-testid="claim-verdict-blocked"
                            className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-400 uppercase"
                          >
                            {bc.verdict || 'BLOCKED'}
                          </span>
                          <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            Verifier: {bcVerifier}
                          </span>
                          <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            Generator: {bcGenerator}
                          </span>
                          {bcIsFallback && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                              ⚡ Fallback Mode
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Required Explicit "searched for" and "missing" fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="p-2.5 bg-white/90 rounded-lg border border-rose-200 space-y-1">
                          <span className="font-bold text-rose-900 text-[11px] uppercase tracking-wider block">
                            Searched for:
                          </span>
                          <p className="text-rose-800 leading-relaxed font-medium" data-testid="blocked-searched-for">
                            {searchedFor}
                          </p>
                        </div>
                        <div className="p-2.5 bg-white/90 rounded-lg border border-rose-200 space-y-1">
                          <span className="font-bold text-rose-900 text-[11px] uppercase tracking-wider block">
                            Missing:
                          </span>
                          <p className="text-rose-800 leading-relaxed font-medium" data-testid="blocked-missing">
                            {missingReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Evidence Drawer */}
          <div className="border-t border-slate-100 pt-3" data-testid="evidence-drawer-section">
            <button
              onClick={() => setShowEvidenceDrawer(!showEvidenceDrawer)}
              data-testid="toggle-evidence-drawer-button"
              className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>
                {showEvidenceDrawer
                  ? 'Hide Evidence Drawer'
                  : `View Retrieved Evidence Clauses (${response.retrieved_quotes?.length || 0})`}
              </span>
              {showEvidenceDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showEvidenceDrawer && (
              <div data-testid="evidence-drawer-content" className="mt-4 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {response.retrieved_quotes && response.retrieved_quotes.length > 0 ? (
                  response.retrieved_quotes.map((rq, rIdx) => (
                    <div key={rIdx} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-semibold">
                        <span>{rq.document_name} &bull; Page {rq.page_number} (Clause {rq.clause_number || 'N/A'})</span>
                        <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">RRF: {rq.retrieval_score}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{rq.clause_text}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 text-center">
                    No retrieved clauses in cache.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default EvidenceChat;

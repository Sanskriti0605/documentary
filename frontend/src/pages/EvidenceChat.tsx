import React, { useState } from 'react';
import {
  Send,
  ShieldAlert,
  Percent,
  ExternalLink
} from 'lucide-react';
import { queryService } from '../services/api';
import { QuerySession, CitationItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAppStore } from '../stores/useAppStore';
import { useNavigate } from 'react-router-dom';

export const EvidenceChat: React.FC = () => {
  const [queryText, setQueryText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<QuerySession | null>(null);

  const { asOfDate, setSelectedDocumentId } = useAppStore();
  const navigate = useNavigate();

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const session = await queryService.submitQuery(queryText, undefined, asOfDate);
      setCurrentSession(session);
    } catch (err) {
      console.error('Query execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCitationClick = (citation: CitationItem) => {
    if (citation.document_id) {
      setSelectedDocumentId(citation.document_id);
      navigate(`/viewer?doc=${citation.document_id}&page=${citation.page_number}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Evidence-First Chat</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask questions across multiple lending agreements, circulars, and policies. Answers require 100% verified supporting citations.
        </p>
      </div>

      {/* Query Input Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <form onSubmit={handleAsk} className="space-y-3">
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="e.g. What is the maximum penal charge rate permitted for personal loan default as of 2026?"
            rows={3}
            className="w-full p-3 border border-slate-200 rounded-lg text-sm text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
          />
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500 flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Temporal Scope:</span>
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{asOfDate}</span>
            </div>
            <button
              type="submit"
              disabled={loading || !queryText.trim()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Verifying Evidence...' : 'Ask Veritas AI'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Answer & Verification Breakdown Card */}
      {currentSession && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center space-x-3">
              <StatusBadge status={currentSession.status} className="text-sm px-3 py-1" />
              <div className="text-xs text-slate-500">
                Evaluation As-of: <strong className="text-slate-800">{currentSession.as_of_date || 'Current'}</strong>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Percent className="w-4 h-4 text-blue-600" />
              <span className="text-slate-600 font-medium">Faithfulness Score:</span>
              <span className="font-bold text-navy-950">{currentSession.faithfulness_score}%</span>
            </div>
          </div>

          {/* Generated Answer */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Response</h3>
            <div className="p-4 bg-slate-50 rounded-lg text-slate-800 text-sm leading-relaxed border border-slate-200/60 font-medium">
              {currentSession.answer}
            </div>
          </div>

          {/* Atomic Claims & Citations */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verified Atomic Claims & Documentary Provenance
            </h3>

            {currentSession.claims.length === 0 ? (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Abstention Enforced</div>
                  <div className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Under the principle of <strong>NO EVIDENCE = NO ANSWER</strong>, this system refrains from generating ungrounded facts when explicit documentary evidence is absent or conflicted.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSession.claims.map((claim, idx) => (
                  <div key={claim.id} className="p-4 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {idx + 1}. {claim.claim_text}
                      </div>
                      <StatusBadge status={claim.verification_status} />
                    </div>

                    {/* Citations List */}
                    {claim.citations.length > 0 && (
                      <div className="space-y-2 pl-3 border-l-2 border-blue-500">
                        {claim.citations.map((cit) => (
                          <div
                            key={cit.id}
                            onClick={() => handleCitationClick(cit)}
                            className="bg-slate-50 p-3 rounded border border-slate-200 text-xs cursor-pointer hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center justify-between text-slate-500 mb-1">
                              <span className="font-semibold text-blue-700">
                                {cit.document_name || 'Document'} &bull; Page {cit.page_number} (Clause {cit.clause_number || 'N/A'})
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <blockquote className="italic text-slate-700">
                              "{cit.exact_quote}"
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    )}
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

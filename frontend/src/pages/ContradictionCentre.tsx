import React, { useEffect, useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { conflictService } from '../services/api';
import { Conflict } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { CitationChip } from '../components/common/CitationChip';

export const ContradictionCentre: React.FC = () => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [resolutionStatus, setResolutionStatus] = useState<string>('RESOLVED_AMENDMENT');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchConflicts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await conflictService.listConflicts();
      setConflicts(data.conflicts);
    } catch (err: any) {
      console.error('Failed to load conflicts:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load contradiction intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConflict) return;

    setSubmitting(true);
    try {
      await conflictService.reviewConflict(selectedConflict.id, resolutionStatus, reviewNotes);
      await fetchConflicts();
      setSelectedConflict(null);
      setReviewNotes('');
    } catch (err: any) {
      console.error('Failed to submit conflict review:', err);
      alert(err?.response?.data?.detail || 'Failed to submit conflict resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Contradiction Centre</h1>
          <p className="text-sm text-slate-500 mt-1">
            Detect and resolve contradictions between RBI circulars, lending policies, and loan agreements.
          </p>
        </div>
        <button
          onClick={fetchConflicts}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Scanning for Document Contradictions</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Aligning facts across Loan Agreements, Sanction Letters, and Master Directions with canonical synonym mapping...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Contradiction Scan Failed</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={fetchConflicts}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Scan</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conflicts.length === 0 && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-navy-950">No Active Contradictions Detected</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            All ingested documents and clauses are currently consistent. Any conflicting rates, penal percentages, or dates across documents will be highlighted here for deterministic reconciliation.
          </p>
        </div>
      )}

      {/* Conflicts List */}
      {!loading && !error && conflicts.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {conflicts.map((conf) => (
            <div key={conf.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <StatusBadge status={conf.conflict_type} />
                  <span className="text-xs font-semibold text-slate-500">Severity: {conf.severity}</span>
                  {conf.subject && (
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Subject: {conf.subject}
                    </span>
                  )}
                </div>
                <StatusBadge status={conf.resolution_status} />
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>{conf.doc_a_name || 'Clause A (Prior / Baseline)'}</span>
                    <span className="font-mono text-slate-500">Clause: {conf.clause_a_number || conf.clause_a_id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed italic">
                    "{conf.quote_a || conf.clause_a?.clause_text || 'Clause text preview'}"
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>Effective: {conf.clause_a?.effective_from || 'N/A'}</span>
                    </span>
                    {conf.doc_a_name && (
                      <CitationChip
                        documentName={conf.doc_a_name}
                        pageNumber={1}
                        quote={conf.quote_a}
                        clauseNumber={conf.clause_a_number}
                      />
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                    <span>{conf.doc_b_name || 'Clause B (Contradictory / New)'}</span>
                    <span className="font-mono text-slate-500">Clause: {conf.clause_b_number || conf.clause_b_id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed italic">
                    "{conf.quote_b || conf.clause_b?.clause_text || 'Clause text preview'}"
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>Effective: {conf.clause_b?.effective_from || 'N/A'}</span>
                    </span>
                    {conf.doc_b_name && (
                      <CitationChip
                        documentName={conf.doc_b_name}
                        pageNumber={1}
                        quote={conf.quote_b}
                        clauseNumber={conf.clause_b_number}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 flex items-center space-x-4">
                  <span>Scope Overlap: <strong>{conf.scope_overlap ? 'Yes' : 'No'}</strong></span>
                  <span>Temporal Overlap: <strong>{conf.temporal_overlap ? 'Yes' : 'No'}</strong></span>
                </div>
                <button
                  onClick={() => setSelectedConflict(conf)}
                  className="px-3 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded text-xs font-semibold transition-colors"
                >
                  Review & Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      {selectedConflict && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-navy-950">Reconciliation & Review</h3>
            <p className="text-xs text-slate-500">
              Provide justification for resolving contradiction {selectedConflict.id.substring(0, 8)}.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Action</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="RESOLVED_AMENDMENT">Resolved: Superseded by Subsequent Amendment</option>
                  <option value="RESOLVED_SCOPE">Resolved: Scope Difference (Different Segments)</option>
                  <option value="DISMISSED">Dismissed: False Positive / Compatible Context</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reviewer Justification</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document why this contradiction is reconciled (e.g. Circular dated 2024 overrides 2023 Loan Policy)..."
                  rows={3}
                  required
                  className="w-full p-2 border border-slate-200 rounded text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedConflict(null)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reviewNotes.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : 'Confirm Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Calendar
} from 'lucide-react';
import { conflictService } from '../services/api';
import { ConflictItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const ContradictionCentre: React.FC = () => {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConflict, setSelectedConflict] = useState<ConflictItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [resolutionStatus, setResolutionStatus] = useState<string>('RESOLVED_AMENDMENT');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const data = await conflictService.listConflicts();
      setConflicts(data.conflicts);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
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
    } catch (err) {
      console.error('Failed to submit conflict review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Contradiction Centre</h1>
        <p className="text-sm text-slate-500 mt-1">
          Detect and resolve contradictions between RBI circulars, lending policies, and loan agreements.
        </p>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
          Loading contradiction records...
        </div>
      ) : conflicts.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-navy-950">No Active Contradictions Detected</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            As clauses and documents are ingested in subsequent stages, any conflicting rates, penal percentages, or dates will be flagged here for deterministic reconciliation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {conflicts.map((conf) => (
            <div key={conf.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <StatusBadge status={conf.conflict_type} />
                  <span className="text-xs font-semibold text-slate-500">Severity: {conf.severity}</span>
                </div>
                <StatusBadge status={conf.resolution_status} />
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>Clause A (Prior / Baseline)</span>
                    <span>Clause ID: {conf.clause_a_id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{conf.clause_a?.clause_text || 'Clause text preview'}"
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-2 pt-1 border-t border-slate-200">
                    <Calendar className="w-3 h-3" />
                    <span>Effective: {conf.clause_a?.effective_from || 'N/A'}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                    <span>Clause B (Contradictory / New)</span>
                    <span>Clause ID: {conf.clause_b_id.substring(0, 8)}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{conf.clause_b?.clause_text || 'Clause text preview'}"
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-2 pt-1 border-t border-slate-200">
                    <Calendar className="w-3 h-3" />
                    <span>Effective: {conf.clause_b?.effective_from || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
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

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Type
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="RESOLVED_AMENDMENT">RESOLVED_AMENDMENT (Clause B amends Clause A)</option>
                  <option value="RESOLVED_SCOPE">RESOLVED_SCOPE (Different customer / product segment)</option>
                  <option value="DISMISSED">DISMISSED (Not a legal contradiction)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Compliance Officer Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  required
                  rows={3}
                  placeholder="Explain why this difference is reconciled or superseded..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedConflict(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {submitting ? 'Saving...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

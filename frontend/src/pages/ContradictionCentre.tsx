import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Link2,
  Scan,
  History,
  X,
  Flame
} from 'lucide-react';
import { conflictService, documentService } from '../services/api';
import { Conflict, ConflictSummaryStats, DocumentItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { CitationChip } from '../components/common/CitationChip';

export const ContradictionCentre: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [subjectFilter, setSubjectFilter] = useState<string>(searchParams.get('subject') || '');
  const [documentFilter, setDocumentFilter] = useState<string>(searchParams.get('document') || '');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  // Data states
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [summary, setSummary] = useState<ConflictSummaryStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review modal state
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>('RESOLVED_AMENDMENT');
  const [linkedDocName, setLinkedDocName] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Collapsible auto-resolved section toggle
  const [showAutoResolved, setShowAutoResolved] = useState<boolean>(false);

  // Expanded history cards
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const toggleHistory = (id: string) => {
    setExpandedHistories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchConflicts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await conflictService.listConflicts({
        subject: subjectFilter || undefined,
        document: documentFilter || undefined,
        conflict_type: typeFilter || undefined,
        resolution_status: statusFilter || undefined,
      });
      setConflicts(data.conflicts);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error('Failed to load conflicts:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load contradiction intelligence.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const docsRes = await documentService.listDocuments();
      setDocuments(docsRes.documents);
    } catch (err) {
      console.error('Failed to load documents list for linking:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    fetchConflicts();
    // Sync URL search params
    const params: Record<string, string> = {};
    if (subjectFilter) params.subject = subjectFilter;
    if (documentFilter) params.document = documentFilter;
    if (typeFilter) params.type = typeFilter;
    if (statusFilter) params.status = statusFilter;
    setSearchParams(params, { replace: true });
  }, [subjectFilter, documentFilter, typeFilter, statusFilter]);

  const handleRescan = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await conflictService.scanConflicts();
      setScanMessage(res.message);
      await fetchConflicts();
    } catch (err: any) {
      console.error('Re-scan failed:', err);
      setError(err?.response?.data?.detail || err?.message || 'Contradiction re-scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConflict) return;

    setSubmitting(true);
    try {
      await conflictService.patchConflict(selectedConflict.id, {
        resolution_status: resolutionStatus,
        resolution_notes: reviewNotes,
        linked_document_name: resolutionStatus === 'RESOLVED_AMENDMENT' ? linkedDocName : undefined,
      });
      await fetchConflicts();
      setSelectedConflict(null);
      setReviewNotes('');
      setLinkedDocName('');
    } catch (err: any) {
      console.error('Failed to submit conflict review:', err);
      alert(err?.response?.data?.detail || 'Failed to submit conflict resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSubjectFilter('');
    setDocumentFilter('');
    setTypeFilter('');
    setStatusFilter('');
  };

  // Split into active conflicts and auto-resolved conflicts
  const activeConflicts = useMemo(() => {
    return conflicts.filter(c => c.resolution_status !== 'AUTO_RESOLVED');
  }, [conflicts]);

  const autoResolvedConflicts = useMemo(() => {
    return conflicts.filter(c => c.resolution_status === 'AUTO_RESOLVED');
  }, [conflicts]);

  // Highlight differing values in text
  const renderHighlightedQuote = (quoteText: string, diffValue?: string) => {
    if (!quoteText) return <span className="italic text-slate-400">No excerpt available</span>;
    if (!diffValue) return <span>"{quoteText}"</span>;

    const cleanVal = diffValue.trim();
    const index = quoteText.indexOf(cleanVal);
    if (index === -1) {
      return <span>"{quoteText}"</span>;
    }

    const before = quoteText.substring(0, index);
    const match = quoteText.substring(index, index + cleanVal.length);
    const after = quoteText.substring(index + cleanVal.length);

    return (
      <span>
        "{before}
        <mark
          data-testid="highlighted-diff-value"
          className="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-bold border border-amber-300"
        >
          {match}
        </mark>
        {after}"
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="contradiction-centre-page">
      {/* Page Header & Re-scan Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Contradiction Centre</h1>
          <p className="text-sm text-slate-500 mt-1">
            Detect, inspect, and reconcile conflicting rates, dates, and provisions across RBI Master Directions, Sanction Letters, and Loan Policies.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleRescan}
            disabled={scanning || loading}
            data-testid="rescan-button"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Scan className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning Documents...' : 'Re-scan Documents'}</span>
          </button>
          <button
            onClick={fetchConflicts}
            disabled={loading}
            data-testid="refresh-button"
            className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Re-scan Report Message Banner */}
      {scanMessage && (
        <div data-testid="scan-message-banner" className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{scanMessage}</span>
          </div>
          <button onClick={() => setScanMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Counts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="summary-counts-bar">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Conflicts</div>
          <div className="text-xl font-bold text-navy-950" data-testid="summary-total-count">
            {summary ? summary.total : conflicts.length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Review</div>
          <div className="text-xl font-bold text-amber-900" data-testid="summary-pending-count">
            {summary ? summary.pending_review : conflicts.filter(c => c.resolution_status === 'PENDING_REVIEW').length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Confirmed Conflicts</div>
          <div className="text-xl font-bold text-rose-900" data-testid="summary-confirmed-count">
            {summary ? summary.confirmed_conflicts : conflicts.filter(c => c.conflict_type === 'CONFIRMED_CONFLICT').length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Auto-Resolved</div>
          <div className="text-xl font-bold text-purple-900" data-testid="summary-autoresolved-count">
            {summary ? summary.auto_resolved : autoResolvedConflicts.length}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Reviewed / Resolved</div>
          <div className="text-xl font-bold text-emerald-900" data-testid="summary-reviewed-count">
            {summary ? summary.resolved_by_reviewer : conflicts.filter(c => ['RESOLVED_AMENDMENT', 'RESOLVED_SCOPE', 'DISMISSED'].includes(c.resolution_status)).length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3" data-testid="filters-toolbar">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter Contradictions</span>
          </div>
          {(subjectFilter || documentFilter || typeFilter || statusFilter) && (
            <button
              onClick={clearFilters}
              data-testid="clear-filters-button"
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Subject Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Subject</label>
            <input
              type="text"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              placeholder="e.g. rate, penal, fee..."
              data-testid="filter-subject-input"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Document Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Document</label>
            <input
              type="text"
              value={documentFilter}
              onChange={(e) => setDocumentFilter(e.target.value)}
              placeholder="e.g. Sanction, Loan Policy..."
              data-testid="filter-document-input"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Conflict Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              data-testid="filter-type-select"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="CONFIRMED_CONFLICT">CONFIRMED_CONFLICT</option>
              <option value="TEMPORAL_DIFFERENCE">TEMPORAL_DIFFERENCE</option>
              <option value="POSSIBLE_CONFLICT">POSSIBLE_CONFLICT</option>
              <option value="SUPERSEDED">SUPERSEDED</option>
              <option value="CONDITIONAL_DIFFERENCE">CONDITIONAL_DIFFERENCE</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Resolution Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="filter-status-select"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="RESOLVED_AMENDMENT">RESOLVED_AMENDMENT</option>
              <option value="RESOLVED_SCOPE">RESOLVED_SCOPE</option>
              <option value="DISMISSED">DISMISSED</option>
              <option value="AUTO_RESOLVED">AUTO_RESOLVED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div data-testid="loading-state" className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Loading Contradictions</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Retrieving conflict graph across Indian banking policies, sanction letters, and RBI directives...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div data-testid="error-state" className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
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
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conflicts.length === 0 && (
        <div data-testid="empty-conflicts-state" className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-navy-950">No Contradictions Matching Filters</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            All ingested documents and clauses are consistent for the current filter criteria.
          </p>
          {(subjectFilter || documentFilter || typeFilter || statusFilter) && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Active Conflict Cards */}
      {!loading && !error && activeConflicts.length > 0 && (
        <div className="space-y-4" data-testid="active-conflicts-list">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Conflicts Requiring Governance ({activeConflicts.length})
          </div>

          {activeConflicts.map((conf) => (
            <div
              key={conf.id}
              data-testid="conflict-card"
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={conf.conflict_type} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    conf.severity === 'HIGH' || conf.severity === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    Severity: {conf.severity}
                  </span>
                  {conf.subject && (
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold" data-testid="conflict-subject-badge">
                      Subject: {conf.subject}
                    </span>
                  )}
                </div>
                <StatusBadge status={conf.resolution_status} />
              </div>

              {/* Differing Values Callout */}
              {(conf.value_a || conf.value_b) && (
                <div
                  data-testid="differing-values-callout"
                  className="flex items-center space-x-2 text-xs bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/80 text-amber-950 font-medium"
                >
                  <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Differing Values: <strong>{conf.value_a || 'N/A'}</strong> ({conf.doc_a_name || 'Doc A'}) vs{' '}
                    <strong>{conf.value_b || 'N/A'}</strong> ({conf.doc_b_name || 'Doc B'})
                  </span>
                </div>
              )}

              {/* Side-by-side comparison with highlighted quotes & click-through to viewer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Clause A */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5" data-testid="clause-a-box">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-900 border-b border-slate-200/60 pb-1.5">
                    <span className="truncate max-w-[200px]" title={conf.doc_a_name}>
                      {conf.doc_a_name || 'Document A'}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      Cl. {conf.clause_a_number || 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed font-serif">
                    {renderHighlightedQuote(conf.quote_a || conf.clause_a?.clause_text || '', conf.value_a)}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Effective: {conf.clause_a?.effective_from || 'N/A'}</span>
                    </span>
                    {conf.doc_a_name && (
                      <CitationChip
                        documentName={conf.doc_a_name}
                        pageNumber={1}
                        quote={conf.quote_a || conf.clause_a?.clause_text}
                        clauseNumber={conf.clause_a_number}
                      />
                    )}
                  </div>
                </div>

                {/* Clause B */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5" data-testid="clause-b-box">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-900 border-b border-slate-200/60 pb-1.5">
                    <span className="truncate max-w-[200px]" title={conf.doc_b_name}>
                      {conf.doc_b_name || 'Document B'}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      Cl. {conf.clause_b_number || 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed font-serif">
                    {renderHighlightedQuote(conf.quote_b || conf.clause_b?.clause_text || '', conf.value_b)}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Effective: {conf.clause_b?.effective_from || 'N/A'}</span>
                    </span>
                    {conf.doc_b_name && (
                      <CitationChip
                        documentName={conf.doc_b_name}
                        pageNumber={1}
                        quote={conf.quote_b || conf.clause_b?.clause_text}
                        clauseNumber={conf.clause_b_number}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Review History Trail on Card */}
              {conf.history && conf.history.length > 0 && (
                <div className="border-t border-slate-100 pt-2" data-testid="conflict-history-section">
                  <button
                    onClick={() => toggleHistory(conf.id)}
                    className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Reviewer Audit Trail ({conf.history.length})</span>
                    {expandedHistories[conf.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedHistories[conf.id] && (
                    <div className="mt-2 space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      {conf.history.map((hist, hIdx) => (
                        <div key={hIdx} className="space-y-0.5 border-b border-slate-200/60 pb-1.5 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                            <span>{new Date(hist.timestamp).toLocaleString()}</span>
                            <span className="font-bold text-slate-700">{hist.action} &bull; {hist.new_status}</span>
                          </div>
                          <p className="text-slate-800 italic">"{hist.notes}"</p>
                          {hist.linked_document_name && (
                            <div className="flex items-center space-x-1 text-[11px] text-blue-700 font-medium">
                              <Link2 className="w-3 h-3" />
                              <span>Superseding Document: {hist.linked_document_name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 flex items-center space-x-4">
                  <span>Scope Overlap: <strong>{conf.scope_overlap ? 'Yes' : 'No'}</strong></span>
                  <span>Temporal Overlap: <strong>{conf.temporal_overlap ? 'Yes' : 'No'}</strong></span>
                </div>
                <button
                  onClick={() => {
                    setSelectedConflict(conf);
                    setResolutionStatus(conf.resolution_status === 'PENDING_REVIEW' ? 'RESOLVED_AMENDMENT' : conf.resolution_status);
                    setReviewNotes(conf.resolution_notes || '');
                    setLinkedDocName(conf.linked_document_name || '');
                  }}
                  data-testid="review-button"
                  className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Review & Reconcile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Resolved Conflicts Collapsed Section */}
      {!loading && !error && autoResolvedConflicts.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4" data-testid="autoresolved-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-sm text-navy-950">
                  Auto-Resolved Conflicts ({autoResolvedConflicts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Reconciled deterministically via amendment edges, circulars, or temporal succession graph.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAutoResolved(!showAutoResolved)}
              data-testid="toggle-autoresolved-button"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-sm"
            >
              <span>{showAutoResolved ? 'Hide Auto-Resolved' : 'Show Auto-Resolved'}</span>
              {showAutoResolved ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showAutoResolved && (
            <div className="space-y-4 pt-2" data-testid="autoresolved-conflicts-list">
              {autoResolvedConflicts.map((conf) => (
                <div
                  key={conf.id}
                  data-testid="autoresolved-card"
                  className="bg-white rounded-xl border border-purple-200 p-5 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                        AUTO RESOLVED
                      </span>
                      <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Subject: {conf.subject}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Superseded Prior Provision</span>
                  </div>

                  <p className="text-xs text-purple-900 bg-purple-50 p-2.5 rounded-lg border border-purple-100 font-medium">
                    {conf.resolution_notes || 'Auto-reconciled: Clause A superseded by subsequent policy or amendment clause.'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <span className="font-semibold text-slate-700">{conf.doc_a_name} (Prior)</span>
                      <p className="text-slate-600 italic">"{conf.quote_a || conf.clause_a?.clause_text}"</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                      <span className="font-semibold text-slate-700">{conf.doc_b_name} (Superseding)</span>
                      <p className="text-slate-600 italic">"{conf.quote_b || conf.clause_b?.clause_text}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review & Reconcile Modal Dialog */}
      {selectedConflict && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="review-modal">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy-950">Reviewer Reconciliation</h3>
              <button onClick={() => setSelectedConflict(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Reconcile contradiction on <strong>{selectedConflict.subject || 'clause terms'}</strong> between{' '}
              <span className="font-semibold">{selectedConflict.doc_a_name}</span> and{' '}
              <span className="font-semibold">{selectedConflict.doc_b_name}</span>.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Action</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                  data-testid="modal-resolution-select"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="RESOLVED_AMENDMENT">Resolved by amendment with a linked document</option>
                  <option value="RESOLVED_SCOPE">Resolved by scope difference (e.g. retail vs corporate)</option>
                  <option value="DISMISSED">Dismissed (false positive / compatible terms)</option>
                  <option value="PENDING_REVIEW">Reopen to Pending Review</option>
                </select>
              </div>

              {/* Linked Document Selector when resolved by amendment */}
              {resolutionStatus === 'RESOLVED_AMENDMENT' && (
                <div data-testid="linked-document-input-group">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linked Superseding Document
                  </label>
                  <input
                    type="text"
                    value={linkedDocName}
                    onChange={(e) => setLinkedDocName(e.target.value)}
                    placeholder="e.g. BNB_Loan_Policy_Amendment_2025.pdf or circular number"
                    list="available-documents-list"
                    data-testid="modal-linked-document-input"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <datalist id="available-documents-list">
                    {documents.map((d) => (
                      <option key={d.id} value={d.name} />
                    ))}
                  </datalist>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reviewer Note & Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document specific regulatory justification, effective dates, or reasons for resolving this discrepancy..."
                  rows={3}
                  required
                  data-testid="modal-review-notes-textarea"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-navy-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedConflict(null)}
                  disabled={submitting}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reviewNotes.trim()}
                  data-testid="modal-submit-button"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Persisting...' : 'Confirm Resolution'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ContradictionCentre;

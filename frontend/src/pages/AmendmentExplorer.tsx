import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Info,
  Layers,
  Filter
} from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { amendmentService } from '../services/api';
import { AmendmentResolutionResponse } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { CitationChip } from '../components/common/CitationChip';
import { useAppStore } from '../stores/useAppStore';

export const AmendmentExplorer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { asOfDate: globalAsOfDate, setAsOfDate: setGlobalAsOfDate } = useAppStore();

  // State
  const [selectedRule, setSelectedRule] = useState<string>(searchParams.get('rule') || 'penal_charges');
  const [asOfDate, setAsOfDate] = useState<string>(searchParams.get('as_of') || globalAsOfDate || '2026-11-23');
  const [resolution, setResolution] = useState<AmendmentResolutionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline' | 'chain'>('graph');

  const fetchResolution = async (ruleToFetch?: string, dateToFetch?: string) => {
    const rule = ruleToFetch || selectedRule;
    const date = dateToFetch || asOfDate;
    setLoading(true);
    setError(null);
    try {
      const data = await amendmentService.resolveAmendments(rule, date);
      setResolution(data);
    } catch (err: any) {
      console.error('Failed to resolve amendment chain:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load amendment relationships.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResolution(selectedRule, asOfDate);
    // Sync URL search params
    const params: Record<string, string> = {};
    if (selectedRule) params.rule = selectedRule;
    if (asOfDate) params.as_of = asOfDate;
    setSearchParams(params, { replace: true });
  }, [selectedRule, asOfDate]);

  const handleDateChange = (newDate: string) => {
    setAsOfDate(newDate);
    setGlobalAsOfDate(newDate);
  };

  const handleRuleChange = (newRule: string) => {
    setSelectedRule(newRule);
  };

  const presets = [
    { label: 'Apr 2023 (Draft Non-Binding)', date: '2023-06-01' },
    { label: 'Nov 2023 (Future Effective)', date: '2023-11-01' },
    { label: 'Jan 2024 (Extension Period)', date: '2024-01-15' },
    { label: 'May 2024 (RBI Circular In Force)', date: '2024-05-01' },
    { label: '2026 (Bank Partial Amendment)', date: '2026-11-23' }
  ];

  // Helper for status colors
  const getStatusNodeStyle = (status: string) => {
    switch (status) {
      case 'IN_FORCE':
        return {
          background: '#ecfdf5',
          border: '2px solid #10b981',
          color: '#064e3b',
          badgeBg: '#10b981',
          badgeText: '#ffffff'
        };
      case 'FUTURE_EFFECTIVE':
        return {
          background: '#f0f9ff',
          border: '2px solid #0284c7',
          color: '#075985',
          badgeBg: '#0284c7',
          badgeText: '#ffffff'
        };
      case 'DRAFT_NON_BINDING':
        return {
          background: '#fefce8',
          border: '2px dashed #ca8a04',
          color: '#713f12',
          badgeBg: '#eab308',
          badgeText: '#ffffff'
        };
      case 'WITHDRAWN':
        return {
          background: '#fff1f2',
          border: '2px solid #e11d48',
          color: '#881337',
          badgeBg: '#e11d48',
          badgeText: '#ffffff'
        };
      case 'SUPERSEDED':
      default:
        return {
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          color: '#475569',
          badgeBg: '#94a3b8',
          badgeText: '#ffffff'
        };
    }
  };

  // Convert backend nodes & edges to React Flow
  const flowNodes: Node[] = useMemo(() => {
    if (!resolution?.nodes) return [];
    return resolution.nodes.map((node, index) => {
      const nodeStatus = node.status || 'SUPERSEDED';
      const styleConfig = getStatusNodeStyle(nodeStatus);

      return {
        id: node.id,
        data: {
          label: (
            <div className="space-y-1 text-left">
              <div className="flex items-center justify-between gap-1">
                <span
                  style={{ backgroundColor: styleConfig.badgeBg, color: styleConfig.badgeText }}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                >
                  {nodeStatus.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {node.effective_from ? `w.e.f. ${node.effective_from}` : 'N/A'}
                </span>
              </div>
              <div className="font-bold text-xs truncate max-w-[200px]" title={node.document_name}>
                {node.document_name}
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                Clause {node.clause_number || 'N/A'}
              </div>
            </div>
          ),
          documentName: node.document_name,
          clauseText: node.clause_text,
          clauseNumber: node.clause_number,
          status: nodeStatus
        },
        position: { x: 60 + (index % 3) * 290, y: 50 + Math.floor(index / 3) * 170 },
        style: {
          background: styleConfig.background,
          border: styleConfig.border,
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
          width: 250,
          cursor: 'pointer'
        }
      };
    });
  }, [resolution]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!resolution?.edges) return [];
    return resolution.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relationship.toUpperCase(),
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      labelStyle: { fill: '#1e3a8a', fontWeight: 700, fontSize: 10 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: '#3b82f6'
      }
    }));
  }, [resolution]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data as Record<string, any> | undefined;
    const docName = nodeData?.documentName ? String(nodeData.documentName) : '';
    const clauseText = nodeData?.clauseText ? String(nodeData.clauseText) : '';
    if (docName) {
      navigate(`/viewer?doc=${encodeURIComponent(docName)}&page=1&quote=${encodeURIComponent(clauseText)}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" data-testid="amendment-explorer-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Amendment Explorer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Resolve temporal supersession chains A &rarr; B &rarr; C, future effective dates, non-binding drafts, and partial amendments.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fetchResolution()}
            disabled={loading}
            data-testid="refresh-button"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Chain</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar: Rule Family Selector & As-Of Date Picker */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3" data-testid="amendment-controls-bar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rule Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Rule / Document Family</span>
            </label>
            <select
              value={selectedRule}
              onChange={(e) => handleRuleChange(e.target.value)}
              data-testid="rule-selector"
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-navy-950 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              {(resolution?.available_rules || [
                { id: 'penal_charges', name: 'Penal Charges & Default Interest (RBI Fair Lending / Bank Policy)' },
                { id: 'interest_rate', name: 'Rate of Interest (Sanction Letter vs Loan Agreement)' },
                { id: 'foreclosure_charges', name: 'Foreclosure & Prepayment Fees (Floating Rate Rules)' },
                { id: 'processing_fee', name: 'Loan Processing & Administrative Fees' }
              ]).map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name}
                </option>
              ))}
            </select>
          </div>

          {/* As-Of Date Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Evaluation "As Of" Date</span>
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => handleDateChange(e.target.value)}
              data-testid="as-of-date-picker"
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs text-navy-950 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Quick Date Presets for Penal Charges Regulatory Timeline */}
        {selectedRule === 'penal_charges' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2" data-testid="date-presets-container">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick Milestones:</span>
            {presets.map((preset, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleDateChange(preset.date)}
                data-testid={`preset-button-${pIdx}`}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors ${
                  asOfDate === preset.date
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div data-testid="loading-state" className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Evaluating Amendment Graph & Legally In-Force Version</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Traversing directed supersession edges, checking future effective dates, drafts, and partial modifications as of {asOfDate}...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div data-testid="error-state" className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Amendment Intelligence Resolution Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={() => fetchResolution()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      )}

      {/* Main Content: Version In Force Card + Graph / Timeline View */}
      {!loading && !error && resolution && (
        <div className="space-y-6">
          {/* Highlighted Version in Force Card */}
          {resolution.version_in_force ? (
            <div
              data-testid="version-in-force-card"
              className="bg-emerald-50/50 border-2 border-emerald-500 rounded-xl p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-emerald-200/60">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-bold uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span data-testid="version-in-force-badge">Version in Force as of {resolution.as_of}</span>
                  </span>
                  {resolution.version_in_force.is_partial_amendment && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded text-xs font-semibold">
                      Partial Amendment
                    </span>
                  )}
                </div>

                <div className="text-xs text-emerald-900 font-mono">
                  Effective From: <strong>{resolution.version_in_force.effective_from || 'N/A'}</strong>
                </div>
              </div>

              {/* Document and Quote Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-navy-950" data-testid="in-force-document-name">
                    {resolution.version_in_force.document_name}
                  </h3>
                  <CitationChip
                    documentName={resolution.version_in_force.document_name}
                    pageNumber={1}
                    clauseNumber={resolution.version_in_force.clause_number || undefined}
                    quote={resolution.version_in_force.quote}
                  />
                </div>

                {/* Amending Quote */}
                {resolution.version_in_force.amending_quote && (
                  <div className="p-3 bg-white/90 rounded-lg border border-emerald-200 text-xs space-y-1" data-testid="amending-quote-box">
                    <span className="font-bold text-emerald-950 uppercase tracking-wider text-[10px] block">
                      Amending Quote / Regulatory Enactment:
                    </span>
                    <p className="text-emerald-900 italic font-serif leading-relaxed">
                      "{resolution.version_in_force.amending_quote}"
                    </p>
                  </div>
                )}

                {/* In-Force Provision Quote */}
                <div className="p-3.5 bg-white rounded-lg border border-emerald-200/80 text-xs text-slate-800 space-y-1 font-serif leading-relaxed" data-testid="in-force-provision-quote">
                  <span className="font-sans font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                    Operative Clause Text (Clause {resolution.version_in_force.clause_number || 'N/A'}):
                  </span>
                  "{resolution.version_in_force.quote}"
                </div>

                {/* Partial Amendment Inheritance Notice */}
                {resolution.version_in_force.inherited_from_document && (
                  <div className="flex items-center space-x-2 text-xs text-purple-900 bg-purple-50 p-2.5 rounded-lg border border-purple-200 font-medium">
                    <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      Partial Amendment: Non-modified contractual clauses are inherited from{' '}
                      <strong>{resolution.version_in_force.inherited_from_document}</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* Applicability Conditions */}
              {resolution.version_in_force.applicability_conditions && (
                <div className="pt-2 border-t border-emerald-200/60" data-testid="applicability-conditions-section">
                  <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Regulatory Applicability Conditions</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 space-y-0.5">
                      <span className="font-bold text-slate-700 block">Lender Type:</span>
                      <p className="text-slate-600 leading-snug" data-testid="applicability-lender-type">
                        {resolution.version_in_force.applicability_conditions.lender_type || 'All Regulated Entities'}
                      </p>
                    </div>
                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 space-y-0.5">
                      <span className="font-bold text-slate-700 block">Sanction Date:</span>
                      <p className="text-slate-600 leading-snug" data-testid="applicability-sanction-date">
                        {resolution.version_in_force.applicability_conditions.sanction_date || 'All Loans'}
                      </p>
                    </div>
                    <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-100 space-y-0.5">
                      <span className="font-bold text-slate-700 block">Scope:</span>
                      <p className="text-slate-600 leading-snug" data-testid="applicability-scope">
                        {resolution.version_in_force.applicability_conditions.scope || 'Retail Term Loans'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div data-testid="no-in-force-version" className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
              <h3 className="font-bold text-sm text-navy-950">No Version Legally In Force as of {resolution.as_of}</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Documents published prior to this date are non-binding drafts or have future effective dates.
              </p>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold" data-testid="view-mode-buttons">
              <button
                onClick={() => setViewMode('graph')}
                data-testid="view-graph-button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'graph' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Graph View
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                data-testid="view-timeline-button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'timeline' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Timeline View
              </button>
              <button
                onClick={() => setViewMode('chain')}
                data-testid="view-chain-button"
                className={`px-3 py-1.5 rounded-md transition-all ${
                  viewMode === 'chain' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Linear Chain
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Chain length: <strong>{resolution.chain.length} versions</strong> &bull; Edges:{' '}
              <strong>{resolution.edges.length} directed relations</strong>
            </div>
          </div>

          {/* Graph View */}
          {viewMode === 'graph' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[560px] relative overflow-hidden" data-testid="amendment-graph-container">
              {flowNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm space-y-2">
                  <GitBranch className="w-8 h-8 text-slate-300" />
                  <p className="font-semibold text-slate-700">No amendment relationship edges detected</p>
                </div>
              ) : (
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  onNodeClick={handleNodeClick}
                  fitView
                >
                  <Background color="#cbd5e1" gap={16} size={1} />
                  <Controls />
                </ReactFlow>
              )}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6" data-testid="amendment-timeline-container">
              <div className="relative border-l-2 border-blue-500 ml-4 space-y-6">
                {resolution.timeline.map((item, idx) => (
                  <div key={idx} className="relative pl-6 space-y-2" data-testid="timeline-event-card">
                    <div
                      className={`absolute -left-2 top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                        item.status === 'IN_FORCE'
                          ? 'bg-emerald-600'
                          : item.status === 'FUTURE_EFFECTIVE'
                          ? 'bg-blue-600'
                          : item.status === 'DRAFT_NON_BINDING'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span>{item.date || 'Undated Event'}</span>
                      <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 uppercase text-[10px]">
                        {item.event_type}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="font-bold text-sm text-navy-950">{item.document_name}</div>
                      <CitationChip
                        documentName={item.document_name}
                        pageNumber={1}
                        clauseNumber={item.clause_number}
                        quote={item.quote || item.description}
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linear Chain View */}
          {viewMode === 'chain' && (
            <div className="space-y-4" data-testid="linear-chain-container">
              {resolution.chain.map((cItem, cIdx) => (
                <div
                  key={cIdx}
                  data-testid="chain-step-card"
                  className={`bg-white p-5 rounded-xl border shadow-sm space-y-3 transition-colors ${
                    cItem.status === 'IN_FORCE'
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : cItem.status === 'FUTURE_EFFECTIVE'
                      ? 'border-blue-300 bg-blue-50/20'
                      : cItem.status === 'DRAFT_NON_BINDING'
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-400">Step {cIdx + 1}</span>
                      <StatusBadge status={cItem.status} />
                      {cItem.relationship_to_prior && (
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded uppercase font-semibold text-slate-700">
                          {cItem.relationship_to_prior}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Pub: {cItem.publication_date || 'N/A'} &bull; Effective: {cItem.effective_from || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-navy-950">{cItem.document_name}</h4>
                    <CitationChip
                      documentName={cItem.document_name}
                      pageNumber={1}
                      clauseNumber={cItem.clause_number || undefined}
                      quote={cItem.quote}
                    />
                  </div>

                  <p className="text-xs text-slate-700 font-serif leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                    "{cItem.quote}"
                  </p>

                  {cItem.amending_quote && (
                    <div className="text-xs text-slate-600 bg-blue-50/60 p-2.5 rounded border border-blue-100">
                      <span className="font-bold text-blue-950 text-[10px] uppercase tracking-wider block">
                        Amending Signal:
                      </span>
                      "{cItem.amending_quote}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default AmendmentExplorer;

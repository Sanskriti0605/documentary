import React, { useEffect, useState } from 'react';
import { GitBranch, AlertTriangle, RefreshCw, Loader2, Calendar } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { amendmentService } from '../services/api';
import { AmendmentGraph, TimelineItem } from '../types';
import { CitationChip } from '../components/common/CitationChip';

export const AmendmentExplorer: React.FC = () => {
  const [graphData, setGraphData] = useState<AmendmentGraph | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [graph, time] = await Promise.all([
        amendmentService.getGraph(),
        amendmentService.getTimeline(),
      ]);
      setGraphData(graph);
      setTimeline(time);
    } catch (err: any) {
      console.error('Failed to load amendment intelligence:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load amendment relationships.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const flowNodes: Node[] = (graphData?.nodes || []).map((node, index) => ({
    id: node.id,
    data: { label: `${node.document_name} (Clause ${node.clause_number || 'N/A'})` },
    position: { x: 100 + (index % 3) * 280, y: 80 + Math.floor(index / 3) * 160 },
    style: {
      background: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#0f172a',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      width: 220,
    },
  }));

  const flowEdges: Edge[] = (graphData?.edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.relationship || edge.relationship_type || 'AMENDS',
    animated: true,
    style: { stroke: '#2563eb', strokeWidth: 2 },
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Amendment Explorer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track policy revisions, superseded clauses, and effective date timelines across circulars.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'graph' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              Graph View
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'timeline' ? 'bg-white text-navy-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              Timeline View
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Building Amendment Lineage Graph</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Resolving directed edges between RBI Master Directions, Circulars, and Loan Policies...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Amendment Intelligence Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      )}

      {/* Graph View */}
      {!loading && !error && viewMode === 'graph' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[560px] relative overflow-hidden">
          {flowNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm space-y-2">
              <GitBranch className="w-8 h-8 text-slate-300" />
              <p className="font-semibold text-slate-700">No amendment relationship edges detected</p>
              <p className="text-xs text-slate-400 max-w-xs text-center">
                As revised clauses containing amendment signals are parsed, they will be automatically mapped into a directed lineage graph.
              </p>
            </div>
          ) : (
            <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
              <Background color="#94a3b8" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          )}
        </div>
      )}

      {/* Timeline View */}
      {!loading && !error && viewMode === 'timeline' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No historical timeline entries detected</p>
              <p className="text-xs text-slate-400">
                Timeline events will populate automatically as circulars with effective dates are ingested.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-blue-500 ml-4 space-y-6">
              {timeline.map((item, idx) => (
                <div key={idx} className="relative pl-6 space-y-2">
                  <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white" />
                  <div className="text-xs text-slate-400 font-semibold">{item.date || 'Undated Event'}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-navy-950">{item.document_name}</div>
                    <CitationChip
                      documentName={item.document_name}
                      pageNumber={1}
                      clauseNumber={item.clause_number}
                      quote={item.description}
                    />
                  </div>
                  <p className="text-xs text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

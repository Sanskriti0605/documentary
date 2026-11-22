import React, { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
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

export const AmendmentExplorer: React.FC = () => {
  const [graphData, setGraphData] = useState<AmendmentGraph | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [graph, time] = await Promise.all([
          amendmentService.getGraph(),
          amendmentService.getTimeline(),
        ]);
        setGraphData(graph);
        setTimeline(time);
      } catch (err) {
        console.error('Failed to load amendment intelligence:', err);
      } finally {
        setLoading(false);
      }
    };
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
    label: edge.relationship,
    animated: true,
    style: { stroke: '#2563eb', strokeWidth: 2 },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Amendment Explorer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track policy revisions, superseded clauses, and effective date timelines across circulars.
          </p>
        </div>

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
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
          Loading amendment relationships...
        </div>
      ) : viewMode === 'graph' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[560px] relative overflow-hidden">
          {flowNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm space-y-2">
              <GitBranch className="w-8 h-8 text-slate-300" />
              <p>No amendment relationship edges detected yet.</p>
              <p className="text-xs text-slate-400">
                In subsequent stages, revised clauses will be automatically mapped into a directed graph.
              </p>
            </div>
          ) : (
            <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
              <Background color="#94a3b8" gap={16} size={1} />
              <Controls />
            </ReactFlow>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No historical timeline entries detected yet.
            </div>
          ) : (
            <div className="relative border-l-2 border-blue-500 ml-4 space-y-6">
              {timeline.map((item, idx) => (
                <div key={idx} className="relative pl-6">
                  <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white" />
                  <div className="text-xs text-slate-400 font-semibold">{item.date || 'Undated'}</div>
                  <div className="text-sm font-bold text-navy-950 mt-0.5">{item.document_name}</div>
                  <p className="text-xs text-slate-600 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

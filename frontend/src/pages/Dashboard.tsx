import React, { useEffect, useState } from 'react';
import {
  FileText,
  FileCheck2,
  FileSearch,
  GitBranch,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  MessageSquare,
  Upload,
  Layers,
  ChevronRight
} from 'lucide-react';
import { systemService, documentService } from '../services/api';
import { AnalyticsStats, DocumentItem, ClauseItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Link, useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [recentClauses, setRecentClauses] = useState<ClauseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [statsData, docsData, clausesData] = await Promise.all([
        systemService.getAnalytics(),
        documentService.listDocuments().catch(() => ({ total: 0, documents: [] })),
        documentService.getAllClauses(6).catch(() => [])
      ]);
      setStats(statsData);
      setDocuments(docsData.documents);
      setRecentClauses(clausesData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const firstDocId = documents.length > 0 ? documents[0].id : '';

  const statCards = [
    {
      title: 'Total Documents',
      value: stats?.total_documents ?? 0,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: 'Banking & Lending PDFs uploaded',
      link: '/documents',
      actionLabel: 'View Documents'
    },
    {
      title: 'Processed Documents',
      value: stats?.processed_documents ?? 0,
      icon: FileCheck2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: 'Fully parsed & indexed with embeddings',
      link: '/documents',
      actionLabel: 'View Processed'
    },
    {
      title: 'Extracted Clauses',
      value: stats?.extracted_clauses ?? 0,
      icon: FileSearch,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      desc: 'Segmented with bounding boxes',
      link: firstDocId ? `/viewer?doc=${firstDocId}` : '/viewer',
      actionLabel: 'Open Document & Clauses'
    },
    {
      title: 'Active Amendment Chains',
      value: stats?.active_amendments ?? 0,
      icon: GitBranch,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      desc: 'Directed graph edge connections',
      link: '/amendments',
      actionLabel: 'Explore Lineages'
    },
    {
      title: 'Detected Contradictions',
      value: stats?.detected_conflicts ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      desc: 'Numerical & conditional conflicts',
      link: '/contradictions',
      actionLabel: 'Resolve Conflicts'
    },
    {
      title: 'Pending Reviews',
      value: stats?.pending_reviews ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      desc: 'Awaiting compliance review',
      link: '/contradictions',
      actionLabel: 'Review Pending'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            System overview across Indian retail lending policies, circulars, and loan sanction schedules.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => navigate(firstDocId ? `/viewer?doc=${firstDocId}` : '/viewer')}
            className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <FileSearch className="w-4 h-4" />
            <span>Open Extracted Clauses</span>
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Quick Actions:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(firstDocId ? `/viewer?doc=${firstDocId}` : '/viewer')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>Extract & Inspect Clauses</span>
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Documents</span>
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Ask Evidence Chat</span>
          </button>
          <button
            onClick={() => navigate('/contradictions')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Contradictions</span>
          </button>
          <button
            onClick={() => navigate('/amendments')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5 text-purple-400" />
            <span>Amendments</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (All Cards Clickable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => navigate(card.link)}
              className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-600">{card.title}</span>
                  <div className={`p-2 rounded-lg ${card.bg} group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-navy-950 tracking-tight mb-1">
                    {loading ? '-' : card.value}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{card.desc}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                <span>{card.actionLabel}</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Extracted Clauses Quick Inspector Section */}
      {recentClauses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSearch className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-base font-bold text-navy-950">Recently Extracted Clauses</h2>
                <p className="text-xs text-slate-500">
                  Direct clause snippets with pixel bounding boxes and section metadata.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(firstDocId ? `/viewer?doc=${firstDocId}` : '/viewer')}
              className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              <span>Open in Full PDF Viewer</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentClauses.map((c) => (
              <div
                key={c.id}
                onClick={() =>
                  navigate(
                    `/viewer?doc=${c.document_id}&page=${c.page_number || 1}${
                      c.bounding_box ? `&bbox=${c.bounding_box.join(',')}` : ''
                    }`
                  )
                }
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-blue-700 truncate max-w-[200px]">
                      Clause {c.clause_number || 'N/A'}: {c.section_title || 'Policy Section'}
                    </span>
                    {c.page_number && (
                      <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        Pg {c.page_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {c.clause_text}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 pt-2 border-t border-slate-200/50">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {c.bounding_box ? `BBox: [${c.bounding_box.map(Math.round).join(', ')}]` : 'Extracted Span'}
                  </span>
                  <span className="inline-flex items-center space-x-1 group-hover:underline">
                    <span>View in PDF</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Principle Banner & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-navy-900 text-white rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 bg-navy-800 px-3 py-1 rounded-full text-xs text-blue-300 font-semibold border border-navy-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-First Guarantee</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">NO EVIDENCE = NO ANSWER</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              VERITAS AI eliminates ungrounded hallucination in financial compliance. All statements are partitioned into atomic claims and mathematically checked against exact clause quotations and bounding boxes.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-navy-800 flex items-center justify-between">
            <Link
              to="/chat"
              className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-semibold"
            >
              <span>Explore Evidence Chat</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              to="/eval"
              className="inline-flex items-center space-x-1 text-xs text-slate-300 hover:text-white font-medium"
            >
              <span>Run Benchmarks &rarr;</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-navy-950">Recent Documents & Verification Activity</h2>
            <Link to="/documents" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View All Documents &rarr;
            </Link>
          </div>

          {stats?.recent_activity && stats.recent_activity.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {stats.recent_activity.map((act) => (
                <div key={act.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 rounded-lg px-2 -mx-2 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{act.title}</div>
                      <div className="text-xs text-slate-400">{new Date(act.timestamp).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <StatusBadge status={act.status} />
                    <button
                      onClick={() => navigate(`/viewer?doc=${act.id}`)}
                      title="Open Document & Extracted Clauses"
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Clauses</span>
                    </button>
                    <button
                      onClick={() => navigate('/chat')}
                      title="Ask questions about this document"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm space-y-3">
              <p>No documents processed yet. Upload your first PDF to begin evidence extraction.</p>
              <button
                onClick={() => navigate('/documents')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                Upload First Document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

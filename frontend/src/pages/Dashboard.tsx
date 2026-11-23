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
  Layers,
  ChevronRight,
  Loader2
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
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, docsData, clausesData] = await Promise.all([
        systemService.getAnalytics(),
        documentService.listDocuments().catch(() => ({ total: 0, documents: [] })),
        documentService.getAllClauses(6).catch(() => [])
      ]);
      setStats(statsData);
      setDocuments(docsData.documents);
      setRecentClauses(clausesData);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch dashboard data.');
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

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Gathering Document Intelligence Metrics</h3>
          <p className="text-xs text-slate-500">Querying database, policy lineages, and verification audit trails...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Dashboard Sync Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={fetchStats}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Metric Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                onClick={() => card.link && navigate(card.link)}
                className={`bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                  card.link ? 'cursor-pointer hover:border-slate-300' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                      {card.title}
                    </span>
                    <div className={`p-1.5 rounded-lg ${card.bg}`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-navy-950 tracking-tight mb-1">
                    {card.value}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{card.desc}</p>
                </div>

                {card.actionLabel && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    <span>{card.actionLabel}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Extracted Clauses Carousel */}
      {!loading && !error && recentClauses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-bold text-navy-950">Extracted Clause Previews</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                Interactive Bounding Boxes
              </span>
            </div>
            <Link
              to={firstDocId ? `/viewer?doc=${firstDocId}` : '/viewer'}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>View Full Document PDF</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentClauses.map((clause) => (
              <div
                key={clause.id}
                onClick={() => navigate(`/viewer?doc=${clause.document_id}`)}
                className="group border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-white rounded-xl p-4 transition-all cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded">
                      Clause {clause.clause_number || 'Section'}
                    </span>
                    {clause.bounding_box && (
                      <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        BBox [{clause.bounding_box.map(Math.round).join(', ')}]
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-slate-800 line-clamp-1">
                    {clause.section_title || 'General Terms'}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {clause.clause_text}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-indigo-600 font-medium">
                  <span>Open in PDF</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Core Principle Banner & Recent Activity */}
      {!loading && !error && (
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
                to="/ask"
                className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>Ask VerifyDoc</span>
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
                        onClick={() => navigate('/ask')}
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
      )}
    </div>
  );
};

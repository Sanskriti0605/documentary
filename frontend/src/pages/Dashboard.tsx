import React, { useEffect, useState } from 'react';
import {
  FileText,
  FileCheck2,
  FileSearch,
  GitBranch,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { systemService } from '../services/api';
import { AnalyticsStats } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await systemService.getAnalytics();
      setStats(data);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch analytics metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Documents',
      value: stats?.total_documents ?? 0,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: 'Banking & Lending PDFs uploaded'
    },
    {
      title: 'Processed Documents',
      value: stats?.processed_documents ?? 0,
      icon: FileCheck2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: 'Fully parsed & indexed'
    },
    {
      title: 'Extracted Clauses',
      value: stats?.extracted_clauses ?? 0,
      icon: FileSearch,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      desc: 'Segmented with bounding boxes'
    },
    {
      title: 'Active Amendments',
      value: stats?.active_amendments ?? 0,
      icon: GitBranch,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      desc: 'Lineage edges in policy graph'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time status of document ingestion, clause extraction, policy lineages, and verification audit trails.
          </p>
        </div>
        <button
          onClick={fetchStats}
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
          <h3 className="font-semibold text-navy-950 text-sm">Gathering Document Intelligence Metrics</h3>
          <p className="text-xs text-slate-500">Querying SQLite database and verification logs...</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{card.title}</span>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-navy-950 tracking-tight mb-1">
                    {card.value}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{card.desc}</p>
                </div>
              </div>
            );
          })}
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
                VerifyDoc eliminates hallucination in financial compliance. All statements are partitioned into atomic claims, checked against exact page quotations, and verified via DeBERTa-v3 cross-encoder NLI.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-navy-800">
              <Link
                to="/ask"
                className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>Ask VerifyDoc</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-navy-950">Recent Ingestion & Verification Activity</h2>
              <Link to="/documents" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All Documents &rarr;
              </Link>
            </div>

            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {stats.recent_activity.map((act) => (
                  <div key={act.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{act.title}</div>
                        <div className="text-xs text-slate-400">{new Date(act.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <StatusBadge status={act.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No documents processed yet</p>
                <p className="text-xs text-slate-400">Upload your first PDF or generate synthetic documents to begin.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

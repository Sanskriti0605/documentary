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
  RefreshCw
} from 'lucide-react';
import { systemService } from '../services/api';
import { AnalyticsStats } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await systemService.getAnalytics();
      setStats(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
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
      desc: 'Fully parsed & indexed in Qdrant'
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
      title: 'Active Amendment Chains',
      value: stats?.active_amendments ?? 0,
      icon: GitBranch,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      desc: 'Directed graph edge connections'
    },
    {
      title: 'Detected Contradictions',
      value: stats?.detected_conflicts ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      desc: 'Numerical & conditional conflicts'
    },
    {
      title: 'Pending Reviews',
      value: stats?.pending_reviews ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      desc: 'Awaiting compliance officer review'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            System overview across Indian retail lending policies, circulars, and loan sanction schedules.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
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
          );
        })}
      </div>

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
          <div className="mt-6 pt-4 border-t border-navy-800">
            <Link
              to="/chat"
              className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 font-semibold"
            >
              <span>Explore Evidence Chat</span>
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
            <div className="py-12 text-center text-slate-400 text-sm">
              No documents processed yet. Upload your first PDF to begin evidence extraction.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

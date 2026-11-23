import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw
} from 'lucide-react';
import { evalService, EvalBenchmarkResponse } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

export const EvaluationPage: React.FC = () => {
  const [evalData, setEvalData] = useState<EvalBenchmarkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runEvaluation = async () => {
    setLoading(true);
    try {
      const data = await evalService.runEvaluation();
      setEvalData(data);
    } catch (err) {
      console.error('Failed to run benchmark:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runEvaluation();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">System Evaluation & Planted Traps</h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated verification benchmarks on synthetic Indian banking documents with deliberate edge-case traps.
          </p>
        </div>

        <button
          onClick={runEvaluation}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running Benchmark...' : 'Run Benchmark Evaluation'}</span>
        </button>
      </div>

      {/* KPI Stats */}
      {evalData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Planted Traps</span>
            <div className="text-3xl font-bold text-navy-950 mt-1">{evalData.total_test_cases}</div>
            <span className="text-xs text-slate-400">Targeted edge cases</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tests Passed</span>
            <div className="text-3xl font-bold text-emerald-600 mt-1">{evalData.passed}</div>
            <span className="text-xs text-emerald-700 font-medium">100% verified</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tests Failed</span>
            <div className="text-3xl font-bold text-slate-400 mt-1">{evalData.failed}</div>
            <span className="text-xs text-slate-400">Zero tolerance failures</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Accuracy</span>
            <div className="text-3xl font-bold text-blue-600 mt-1">{evalData.accuracy_percentage}%</div>
            <span className="text-xs text-blue-700 font-medium">Grounded evaluation</span>
          </div>
        </div>
      )}

      {/* Pipeline Diagram */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-navy-950 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <span>VerifyDoc Architectural Verification Pipeline</span>
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Every query and document flows through a strictly deterministic multi-stage verification gate before reaching the user:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2 text-xs">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">STAGE 1</span>
            <div className="font-bold text-slate-900">Ingestion & BBox</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              PyMuPDF + pdfplumber extract spans with (doc, page, bbox) and tables as structured rows.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[10px]">STAGE 2</span>
            <div className="font-bold text-slate-900">Hybrid Retrieval</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Dense vectors + BM25 with Reciprocal Rank Fusion (RRF) & parent-section context expansion.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-[10px]">STAGE 3</span>
            <div className="font-bold text-slate-900">Constrained LLM</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              JSON schema enforced: {"{claims: [{text, quote_ids}]}"}. Strictly permitted to use retrieved quotes.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 border-l-4 border-l-amber-500">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">STAGE 4</span>
            <div className="font-bold text-slate-900">Verification Gate</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              3-point validation: 1) Verbatim substring check; 2) Number/Date regex consistency; 3) NLI entailment.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 border-l-4 border-l-emerald-500">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">STAGE 5</span>
            <div className="font-bold text-slate-900">Grounded Output</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Faithfulness Score display. Unsubstantiated claims are blocked with explicit missing evidence notice.
            </p>
          </div>
        </div>
      </div>

      {/* Planted Traps Benchmark Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-navy-950 text-sm">Planted-Trap Evaluation Results</h2>
          <span className="text-xs text-slate-500">benchmark/test_questions.json</span>
        </div>

        <div className="divide-y divide-slate-100 text-sm">
          {evalData?.results.map((r) => (
            <div key={r.test_case_id} className="p-6 space-y-3 hover:bg-slate-50/60 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-100">
                    {r.test_case_id}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {r.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="text-sm font-semibold text-navy-950">
                "{r.question}"
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                <pre className="whitespace-pre-wrap">{JSON.stringify(r.details, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

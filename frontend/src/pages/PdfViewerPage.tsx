import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { documentService } from '../services/api';
import { DocumentItem, ClauseItem } from '../types';

export const PdfViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const docId = searchParams.get('doc');
  const targetPage = parseInt(searchParams.get('page') || '1', 10);

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (docId) {
      setLoading(true);
      Promise.all([
        documentService.getDocument(docId),
        documentService.getClauses(docId),
      ])
        .then(([doc, cls]) => {
          setDocument(doc);
          setClauses(cls);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [docId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">PDF Evidence Viewer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit extracted clauses, exact quotations, and page bounding boxes in their original layout.
          </p>
        </div>

        {document && (
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-slate-800">{document.name}</span>
          </div>
        )}
      </div>

      {!docId ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-navy-950">No Document Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Select a document from the Document Library or click on a citation card in Evidence Chat to inspect original pages.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
          Loading document evidence...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Viewer Surface */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[620px]">
            {/* Viewer Controls */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between text-xs bg-slate-50/60">
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700">
                  Page {currentPage} of {document?.page_count || 1}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1 rounded hover:bg-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2 text-slate-500">
                <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                  SHA-256: {document?.file_hash.substring(0, 16)}...
                </span>
              </div>
            </div>

            {/* Document Page Display */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-100/50">
              <div className="w-full max-w-xl bg-white shadow-md border border-slate-200 rounded p-8 min-h-[500px] flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <span className="font-bold text-sm text-navy-950 uppercase tracking-wider">
                      {document?.name}
                    </span>
                    <span className="text-xs text-slate-400">Page {currentPage}</span>
                  </div>

                  <div className="space-y-3 text-xs text-slate-700 leading-relaxed font-serif">
                    <p className="bg-yellow-50 p-2 border-l-2 border-amber-400">
                      <strong>Supporting Evidence Highlighter:</strong> In Stage 2, rendered PyMuPDF high-resolution page bitmaps with SVG bounding box overlays will be active here.
                    </p>
                    <p>
                      This section displays verified text extracted from page {currentPage}. Citations jump directly to this view with the exact supporting quotation highlighted in real time.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>VERITAS AI DOCUMENT AUDIT</span>
                  <span>CONFIDENTIALITY: INTERNAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clauses Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-navy-950">Extracted Clauses</h3>
              <span className="text-xs text-slate-500">{clauses.length} clauses</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[520px] custom-scrollbar">
              {clauses.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No segmented clauses for this document yet.
                </div>
              ) : (
                clauses.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 hover:border-blue-300 transition-colors"
                  >
                    <div className="font-semibold text-blue-700">
                      Clause {c.clause_number || 'N/A'}: {c.section_title || 'Section'}
                    </div>
                    <p className="text-slate-600 line-clamp-3">{c.clause_text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

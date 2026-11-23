import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Highlighter
} from 'lucide-react';
import { documentService } from '../services/api';
import { DocumentItem, ClauseItem } from '../types';

export const PdfViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docNameOrId = searchParams.get('doc') || '';
  const targetPage = parseInt(searchParams.get('page') || '1', 10);
  const bbox = searchParams.get('bbox') || '';

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);

  useEffect(() => {
    documentService.listDocuments().then((res) => {
      setAllDocs(res.documents);
      if (docNameOrId) {
        const found = res.documents.find(
          (d) => d.id === docNameOrId || d.name === docNameOrId
        );
        if (found) {
          setDocument(found);
          documentService.getClauses(found.id).then(setClauses).catch(console.error);
        }
      }
    });
  }, [docNameOrId]);

  const handleDocChange = (docName: string) => {
    setSearchParams({ doc: docName, page: '1' });
    setCurrentPage(1);
  };

  const currentDocName = document?.name || docNameOrId;
  const imageSrc = currentDocName
    ? `/api/v1/pdf/${encodeURIComponent(currentDocName)}/page/${currentPage}${bbox ? `?bbox=${encodeURIComponent(bbox)}` : ''}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">PDF Evidence Viewer</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visual verification of extracted clauses, exact quotations, and page bounding boxes in their original layout.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={document?.name || docNameOrId}
            onChange={(e) => handleDocChange(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select Document to Inspect...</option>
            {allDocs.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!currentDocName ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-navy-950">No Document Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Select a document from the dropdown above or click on a citation chip in the Ask VerifyDoc page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Viewer Surface */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[640px]">
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
                {bbox && (
                  <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-semibold">
                    <Highlighter className="w-3 h-3" />
                    <span>Passage BBox Highlighted</span>
                  </span>
                )}
                {document?.file_hash && (
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    SHA: {document.file_hash.substring(0, 12)}...
                  </span>
                )}
              </div>
            </div>

            {/* Document Page Display */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-100/60 overflow-auto">
              <div className="max-w-xl w-full bg-white shadow-lg border border-slate-300 rounded overflow-hidden">
                <img
                  src={imageSrc}
                  alt={`Page ${currentPage} of ${currentDocName}`}
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    // Fallback to text preview if image render not ready
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Clauses Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-navy-950">Segmented Clauses</h3>
              <span className="text-xs text-slate-500">{clauses.length} clauses</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[540px] custom-scrollbar">
              {clauses.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No segmented clauses for this document.
                </div>
              ) : (
                clauses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (c.bounding_box) {
                        setSearchParams({
                          doc: currentDocName,
                          page: String(currentPage),
                          bbox: c.bounding_box.join(','),
                        });
                      }
                    }}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 hover:border-blue-300 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-blue-700">
                      Clause {c.clause_number || 'N/A'}: {c.section_title || 'Section'}
                    </div>
                    <p className="text-slate-600 line-clamp-3">{c.clause_text}</p>
                    {c.bounding_box && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        BBox: [{c.bounding_box.map((v) => Math.round(v)).join(', ')}]
                      </span>
                    )}
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

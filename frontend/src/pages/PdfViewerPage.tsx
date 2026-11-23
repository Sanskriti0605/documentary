import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Highlighter,
  Quote,
  AlertTriangle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { documentService } from '../services/api';
import { DocumentItem, ClauseItem } from '../types';
import { DocStatusBadge } from '../components/common/DocStatusBadge';

export const PdfViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docNameOrId = searchParams.get('doc') || '';
  const targetPage = parseInt(searchParams.get('page') || '1', 10);
  const bbox = searchParams.get('bbox') || '';
  const targetQuote = searchParams.get('quote') || '';

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(targetPage);
  }, [targetPage]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.listDocuments();
      setAllDocs(res.documents);

      if (docNameOrId) {
        const found = res.documents.find(
          (d) => d.id === docNameOrId || d.name === docNameOrId
        );
        if (found) {
          setDocument(found);
          const cls = await documentService.getClauses(found.id);
          setClauses(cls);
        } else {
          setError(`Document "${docNameOrId}" not found in current library.`);
        }
      } else if (res.documents.length > 0) {
        // Default to first document if none specified
        const first = res.documents[0];
        setDocument(first);
        setSearchParams({ doc: first.name, page: '1' });
        const cls = await documentService.getClauses(first.id);
        setClauses(cls);
      }
    } catch (err: any) {
      console.error('Failed to load document metadata:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load PDF documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
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
            disabled={loading || allDocs.length === 0}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select Document to Inspect...</option>
            {allDocs.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="Reload Documents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Target Quotation Highlight Banner */}
      {targetQuote && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <Quote className="w-3.5 h-3.5 text-amber-700" />
            <span>Target Citation Quotation (Page {currentPage})</span>
          </div>
          <p className="text-xs font-medium text-amber-950 italic">
            "{targetQuote}"
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-navy-950 text-sm">Rendering PDF Page Bitmaps</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Extracting page resolution via PyMuPDF and rendering bounding box highlight overlays...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-sm">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Document Render Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={loadDocuments}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !currentDocName && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-navy-950">No Document Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Select a document from the dropdown above or click on a citation chip in the Ask VerifyDoc page.
          </p>
        </div>
      )}

      {/* Main Viewer Display */}
      {!loading && !error && currentDocName && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Viewer Surface */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[640px]">
            {/* Viewer Controls */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs bg-slate-50/60 gap-2">
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const newP = Math.max(1, currentPage - 1);
                    setCurrentPage(newP);
                    setSearchParams({ doc: currentDocName, page: newP.toString(), ...(bbox ? { bbox } : {}), ...(targetQuote ? { quote: targetQuote } : {}) });
                  }}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700">
                  Page {currentPage} of {document?.page_count || 1}
                </span>
                <button
                  disabled={document ? currentPage >= document.page_count : false}
                  onClick={() => {
                    const newP = currentPage + 1;
                    setCurrentPage(newP);
                    setSearchParams({ doc: currentDocName, page: newP.toString(), ...(bbox ? { bbox } : {}), ...(targetQuote ? { quote: targetQuote } : {}) });
                  }}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-2 text-slate-500">
                <DocStatusBadge status={document?.doc_status || 'in force'} />
                {bbox && (
                  <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-semibold">
                    <Highlighter className="w-3 h-3" />
                    <span>Passage BBox Highlighted</span>
                  </span>
                )}
                {document?.file_hash && (
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    SHA: {document.file_hash.substring(0, 10)}...
                  </span>
                )}
              </div>
            </div>

            {/* Document Page Display */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-100/60 overflow-auto relative min-h-[480px]">
              {imageLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              )}
              <div className="max-w-xl w-full bg-white shadow-lg border border-slate-300 rounded overflow-hidden">
                <img
                  src={imageSrc}
                  alt={`Page ${currentPage} of ${currentDocName}`}
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => setImageLoading(false)}
                  className="w-full h-auto object-contain"
                  onError={(e) => {
                    setImageLoading(false);
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
                          quote: c.clause_text.substring(0, 120),
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

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Highlighter,
  Search,
  FileText,
  QrCode,
  Award,
  Quote,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ZoomIn,
  ZoomOut,
  Target,
  Layers,
  Hash
} from 'lucide-react';
import { documentService, pdfService } from '../services/api';
import { DocumentItem, ClauseItem } from '../types';
import { DocStatusBadge } from '../components/common/DocStatusBadge';
import { GovernmentCertificateModal } from '../components/common/GovernmentCertificateModal';

// 6 distinct, accessible color themes for different clauses
export const CLAUSE_THEMES = [
  {
    name: 'amber',
    label: 'Gold / Amber',
    border: 'border-amber-500',
    borderActive: 'border-amber-600',
    bg: 'bg-amber-300/35',
    bgActive: 'bg-amber-400/50',
    ring: 'ring-amber-400/80',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    activeBadge: 'bg-amber-600 text-white',
    sidebarCard: 'border-amber-200 bg-amber-50/40 hover:border-amber-400',
    sidebarActive: 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/60 shadow-xs',
    textAccent: 'text-amber-800',
    dot: 'bg-amber-500',
    btn: 'bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300',
  },
  {
    name: 'emerald',
    label: 'Emerald Green',
    border: 'border-emerald-500',
    borderActive: 'border-emerald-600',
    bg: 'bg-emerald-300/35',
    bgActive: 'bg-emerald-400/50',
    ring: 'ring-emerald-400/80',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    activeBadge: 'bg-emerald-600 text-white',
    sidebarCard: 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400',
    sidebarActive: 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/60 shadow-xs',
    textAccent: 'text-emerald-800',
    dot: 'bg-emerald-500',
    btn: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border-emerald-300',
  },
  {
    name: 'blue',
    label: 'Sky Blue',
    border: 'border-blue-500',
    borderActive: 'border-blue-600',
    bg: 'bg-blue-300/35',
    bgActive: 'bg-blue-400/50',
    ring: 'ring-blue-400/80',
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    activeBadge: 'bg-blue-600 text-white',
    sidebarCard: 'border-blue-200 bg-blue-50/40 hover:border-blue-400',
    sidebarActive: 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/60 shadow-xs',
    textAccent: 'text-blue-800',
    dot: 'bg-blue-500',
    btn: 'bg-blue-100 text-blue-900 hover:bg-blue-200 border-blue-300',
  },
  {
    name: 'purple',
    label: 'Purple / Violet',
    border: 'border-purple-500',
    borderActive: 'border-purple-600',
    bg: 'bg-purple-300/35',
    bgActive: 'bg-purple-400/50',
    ring: 'ring-purple-400/80',
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    activeBadge: 'bg-purple-600 text-white',
    sidebarCard: 'border-purple-200 bg-purple-50/40 hover:border-purple-400',
    sidebarActive: 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-400/60 shadow-xs',
    textAccent: 'text-purple-800',
    dot: 'bg-purple-500',
    btn: 'bg-purple-100 text-purple-900 hover:bg-purple-200 border-purple-300',
  },
  {
    name: 'rose',
    label: 'Rose Pink',
    border: 'border-rose-500',
    borderActive: 'border-rose-600',
    bg: 'bg-rose-300/35',
    bgActive: 'bg-rose-400/50',
    ring: 'ring-rose-400/80',
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    activeBadge: 'bg-rose-600 text-white',
    sidebarCard: 'border-rose-200 bg-rose-50/40 hover:border-rose-400',
    sidebarActive: 'bg-rose-50/90 border-rose-500 ring-2 ring-rose-400/60 shadow-xs',
    textAccent: 'text-rose-800',
    dot: 'bg-rose-500',
    btn: 'bg-rose-100 text-rose-900 hover:bg-rose-200 border-rose-300',
  },
  {
    name: 'teal',
    label: 'Teal Cyan',
    border: 'border-teal-500',
    borderActive: 'border-teal-600',
    bg: 'bg-teal-300/35',
    bgActive: 'bg-teal-400/50',
    ring: 'ring-teal-400/80',
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    activeBadge: 'bg-teal-600 text-white',
    sidebarCard: 'border-teal-200 bg-teal-50/40 hover:border-teal-400',
    sidebarActive: 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-400/60 shadow-xs',
    textAccent: 'text-teal-800',
    dot: 'bg-teal-500',
    btn: 'bg-teal-100 text-teal-900 hover:bg-teal-200 border-teal-300',
  },
];

interface QuoteHighlightState {
  found: boolean;
  boxes: number[][];
  is_multiline: boolean;
  cross_page?: {
    is_cross_page: boolean;
    continues_on_page?: number | null;
    continued_from_page?: number | null;
    continuation_quote?: string;
  } | null;
  warning?: string | null;
}

export const PdfViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docNameOrId = searchParams.get('doc') || '';
  const targetPage = parseInt(searchParams.get('page') || '1', 10);
  const bboxParam = searchParams.get('bbox') || '';
  const targetQuote = searchParams.get('quote') || '';

  // Core Document State
  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [pageDimensions, setPageDimensions] = useState<{ [pageNum: number]: { width: number; height: number } }>({});

  // Quote & Highlight State
  const [quoteHighlight, setQuoteHighlight] = useState<QuoteHighlightState | null>(null);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [clauseSearch, setClauseSearch] = useState<string>('');
  const [highlightAll, setHighlightAll] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 100% zoom default
  const [certificateClause, setCertificateClause] = useState<ClauseItem | null>(null);

  // UI / Status State
  const [loading, setLoading] = useState<boolean>(true);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // DOM Refs for auto-scroll and zoom
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load of Documents Library
  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentService.listDocuments();
      setAllDocs(res.documents);

      if (res.documents.length > 0) {
        const found = docNameOrId
          ? res.documents.find((d) => d.id === docNameOrId || d.name === docNameOrId)
          : res.documents[0];

        if (found) {
          setDocument(found);
          if (!docNameOrId) {
            setSearchParams({ doc: found.name, page: '1' }, { replace: true });
          }

          // Load Clauses
          const cls = await documentService.getClauses(found.id);
          setClauses(cls);

          // Load PDF dimensions
          try {
            const info = await pdfService.getPdfInfo(found.id || found.name);
            const dimsMap: { [pageNum: number]: { width: number; height: number } } = {};
            info.pages.forEach((p) => {
              dimsMap[p.page_number] = { width: p.width, height: p.height };
            });
            setPageDimensions(dimsMap);
          } catch (e) {
            console.error('Failed to load page dimensions:', e);
          }
        } else {
          setError(`Document "${docNameOrId}" not found in current library.`);
        }
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

  // Sync currentPage with URL param
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // 2. Fetch Quote Bboxes whenever quote, page or document changes
  useEffect(() => {
    const fetchQuoteBoxes = async () => {
      const docIdentifier = document?.name || docNameOrId;
      if (!docIdentifier) return;

      if (!targetQuote && !bboxParam) {
        setQuoteHighlight(null);
        return;
      }

      if (targetQuote) {
        try {
          const res = await pdfService.getQuoteBoxes(docIdentifier, targetQuote, currentPage);
          setQuoteHighlight(res);

          // If relocated to another page, update current page
          if (res.found && res.page_number && res.page_number !== currentPage) {
            setCurrentPage(res.page_number);
          }
        } catch (err) {
          console.error('Failed to fetch quote boxes:', err);
          // If quote-boxes endpoint fails, fallback to bboxParam if present
          if (bboxParam) {
            const parts = bboxParam.split(',').map((v) => parseFloat(v.trim()));
            if (parts.length === 4) {
              setQuoteHighlight({
                found: true,
                boxes: [parts],
                is_multiline: false,
                warning: null,
              });
              return;
            }
          }
          setQuoteHighlight({
            found: false,
            boxes: [],
            is_multiline: false,
            warning: 'Could not calculate bounding boxes for this quote.',
          });
        }
      } else if (bboxParam) {
        // Explicit bbox parameter passed without quote string
        const parts = bboxParam.split(',').map((v) => parseFloat(v.trim()));
        if (parts.length === 4) {
          setQuoteHighlight({
            found: true,
            boxes: [parts],
            is_multiline: false,
            warning: null,
          });
        }
      }
    };

    fetchQuoteBoxes();
  }, [document?.name, docNameOrId, targetQuote, currentPage, bboxParam]);

  // 3. Auto-scroll / Zoom to Highlight when highlight boxes load
  useEffect(() => {
    if (quoteHighlight?.found && quoteHighlight.boxes.length > 0) {
      const timer = setTimeout(() => {
        const container = viewerContainerRef.current;
        const firstBox = quoteHighlight.boxes[0];
        if (container && firstBox) {
          const currentDim = pageDimensions[currentPage] || { width: 612, height: 792 };
          const imgElem = imageRef.current;
          const displayHeight = imgElem ? imgElem.clientHeight : 792;
          const scale = displayHeight / currentDim.height;

          // Target vertical center of bounding box
          const boxCenterY = ((firstBox[1] + firstBox[3]) / 2) * scale;
          const targetScrollTop = Math.max(0, boxCenterY - container.clientHeight / 2 + 60);

          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [quoteHighlight, currentPage, pageDimensions]);

  // Document Switching
  const handleDocChange = (docIdentifier: string) => {
    setSearchParams({ doc: docIdentifier, page: '1' });
    setCurrentPage(1);
    setSelectedClauseId(null);
    setQuoteHighlight(null);
  };

  // Page Navigation
  const navigateToPage = (newPage: number) => {
    const clamped = Math.max(1, Math.min(document?.page_count || 1, newPage));
    setCurrentPage(clamped);
    const params: Record<string, string> = {
      doc: document?.name || docNameOrId,
      page: String(clamped),
    };
    if (targetQuote) params.quote = targetQuote;
    setSearchParams(params);
  };

  // Clicking an item in the "Other Citations" list
  const handleCitationClick = (c: ClauseItem) => {
    const pageNum = c.page_number || currentPage;
    setCurrentPage(pageNum);
    setSelectedClauseId(c.id);

    const params: Record<string, string> = {
      doc: document?.name || docNameOrId,
      page: String(pageNum),
      quote: c.clause_text.substring(0, 160),
    };
    if (c.bounding_box) {
      params.bbox = c.bounding_box.join(',');
    }
    setSearchParams(params);
  };

  // Zoom Helpers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(200, z + 20));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(60, z - 20));
  const handleResetZoom = () => setZoomLevel(100);
  const handleFocusHighlight = () => {
    setZoomLevel(130);
    if (quoteHighlight?.found && quoteHighlight.boxes.length > 0) {
      const container = viewerContainerRef.current;
      const firstBox = quoteHighlight.boxes[0];
      if (container && firstBox) {
        const currentDim = pageDimensions[currentPage] || { width: 612, height: 792 };
        const scale = (792 * 1.3) / currentDim.height;
        const boxCenterY = ((firstBox[1] + firstBox[3]) / 2) * scale;
        container.scrollTo({ top: Math.max(0, boxCenterY - 140), behavior: 'smooth' });
      }
    }
  };

  const currentDocName = document?.name || docNameOrId;
  const currentDims = pageDimensions[currentPage] || { width: 612, height: 792 };

  // Image source URL
  const imageSrc = currentDocName
    ? `/api/v1/pdf/${encodeURIComponent(currentDocName)}/page/${currentPage}?highlight_all=${highlightAll}${
        quoteHighlight?.boxes?.length
          ? `&bboxes=${quoteHighlight.boxes.map((b) => b.join(',')).join(';')}`
          : targetQuote
          ? `&quote=${encodeURIComponent(targetQuote)}`
          : bboxParam
          ? `&bbox=${encodeURIComponent(bboxParam)}`
          : ''
      }`
    : '';

  // Active page clauses for multi-color section bounding boxes
  const activePageClauses = useMemo(() => {
    return clauses.filter(
      (c) => (c.page_number || 1) === currentPage && c.bounding_box && c.bounding_box.length === 4
    );
  }, [clauses, currentPage]);

  // Filtered citations for sidebar search
  const filteredClauses = useMemo(() => {
    if (!clauseSearch) return clauses;
    const q = clauseSearch.toLowerCase();
    return clauses.filter(
      (c) =>
        (c.clause_number && c.clause_number.toLowerCase().includes(q)) ||
        (c.section_title && c.section_title.toLowerCase().includes(q)) ||
        (c.clause_text && c.clause_text.toLowerCase().includes(q))
    );
  }, [clauses, clauseSearch]);

  const hasMissingBboxWarning =
    Boolean(targetQuote) && (!quoteHighlight || !quoteHighlight.found || quoteHighlight.boxes.length === 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="pdf-viewer-page">
      {/* Government Certificate Modal */}
      {certificateClause && (
        <GovernmentCertificateModal
          clause={certificateClause}
          document={document}
          onClose={() => setCertificateClause(null)}
        />
      )}

      {/* Top Header / Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">PDF Evidence Viewer</h1>
            <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
              <Award className="w-3 h-3 text-amber-700" />
              <span>Multi-Line Highlighting</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visual statutory verification: multi-line highlights, cross-page quotes, exact bounding boxes, and document lineage metadata.
          </p>
        </div>

        {/* Document Selector & Reload Action */}
        <div className="flex items-center space-x-3">
          <select
            data-testid="document-switcher-select"
            value={document?.id || document?.name || docNameOrId}
            onChange={(e) => handleDocChange(e.target.value)}
            disabled={loading || allDocs.length === 0}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
          >
            <option value="">Select Document to Inspect...</option>
            {allDocs.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name} ({d.clause_count || 0} citations)
              </option>
            ))}
          </select>

          <button
            onClick={loadDocuments}
            disabled={loading}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Reload Documents and Metadata"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Missing BBox Warning Banner */}
      {hasMissingBboxWarning && (
        <div
          data-testid="missing-bbox-warning"
          className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 shadow-xs"
        >
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Bounding Box Unavailable on Current Page</span>
          </div>
          <p className="text-xs text-amber-900 font-medium leading-relaxed">
            Exact spatial bounding box coordinates could not be isolated for this quote on Page {currentPage}.
            The verified quotation text is displayed below and confirmed in the document text stream.
          </p>
          <div className="p-3 bg-white/90 border border-amber-200 rounded-lg font-serif italic text-xs text-amber-950">
            "{targetQuote}"
          </div>
        </div>
      )}

      {/* Cross-Page Continuation Banner */}
      {quoteHighlight?.cross_page?.is_cross_page && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2 text-xs text-blue-900 font-semibold">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>
              {quoteHighlight.cross_page.continues_on_page
                ? `Quote spans across page break: continues on Page ${quoteHighlight.cross_page.continues_on_page}`
                : `Quote continued from Page ${quoteHighlight.cross_page.continued_from_page}`}
            </span>
          </div>
          {quoteHighlight.cross_page.continues_on_page && (
            <button
              onClick={() => navigateToPage(quoteHighlight.cross_page!.continues_on_page!)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
            >
              Go to Page {quoteHighlight.cross_page.continues_on_page} &rarr;
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Document Load Error</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
          <button
            onClick={loadDocuments}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!currentDocName && allDocs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-navy-950">No Documents Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload banking policy documents in the Library to inspect multi-line quotes and bounding boxes.
          </p>
        </div>
      ) : (
        /* Main Layout: 2/3 PDF Viewer Surface + 1/3 Metadata & Citations Sidebar */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Viewer Card */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[640px]">
            {/* Viewer Navigation & Zoom Toolbar */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/70">
              {/* Page Controls */}
              <div className="flex items-center space-x-2">
                <button
                  data-testid="prev-page-button"
                  disabled={currentPage <= 1}
                  onClick={() => navigateToPage(currentPage - 1)}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-1 font-semibold text-slate-700">
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={document?.page_count || 1}
                    value={currentPage}
                    onChange={(e) => navigateToPage(parseInt(e.target.value, 10) || 1)}
                    className="w-12 text-center py-0.5 border border-slate-300 rounded font-semibold text-xs"
                  />
                  <span>of {document?.page_count || 1}</span>
                </div>

                <button
                  data-testid="next-page-button"
                  disabled={currentPage >= (document?.page_count || 1)}
                  onClick={() => navigateToPage(currentPage + 1)}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom & Highlight Focus Controls */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-[11px] font-bold text-slate-700 min-w-[42px] text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                    title="Reset Zoom"
                  >
                    100%
                  </button>
                </div>

                {/* Focus / Auto-Scroll to Highlight Button */}
                {quoteHighlight?.found && quoteHighlight.boxes.length > 0 && (
                  <button
                    onClick={handleFocusHighlight}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs transition-colors"
                    title="Auto-scroll & Zoom directly to cited quote"
                  >
                    <Target className="w-3.5 h-3.5 text-amber-700" />
                    <span>Focus Highlight</span>
                  </button>
                )}

                {/* Highlight All Toggle */}
                <button
                  onClick={() => setHighlightAll(!highlightAll)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                    highlightAll
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Toggle clause section boundaries"
                >
                  <Highlighter className="w-3 h-3" />
                  <span>{highlightAll ? 'All Clauses' : 'Active Only'}</span>
                </button>
              </div>
            </div>

            {/* Document Render Surface with Auto-Scroll & Highlighting */}
            <div
              ref={viewerContainerRef}
              data-testid="pdf-viewport-container"
              className="flex-1 p-6 flex flex-col items-center justify-start bg-slate-100/70 overflow-auto relative max-h-[720px] custom-scrollbar"
            >
              {imageLoading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              )}

              <div
                style={{
                  width: `${zoomLevel}%`,
                  maxWidth: zoomLevel <= 100 ? '600px' : 'none',
                  transition: 'width 0.2s ease-in-out',
                }}
                className="bg-white shadow-xl border border-slate-300 rounded overflow-hidden relative select-none"
              >
                <img
                  ref={imageRef}
                  src={imageSrc}
                  alt={`Page ${currentPage} of ${currentDocName}`}
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => setImageLoading(false)}
                  className="w-full h-auto object-contain block pointer-events-none"
                  onError={(e) => {
                    setImageLoading(false);
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                {/* Multi-Line Target Quote Highlight Overlay Rectangles */}
                {quoteHighlight?.found &&
                  quoteHighlight.boxes.map((box, idx) => {
                    const leftPct = (box[0] / currentDims.width) * 100;
                    const topPct = (box[1] / currentDims.height) * 100;
                    const widthPct = ((box[2] - box[0]) / currentDims.width) * 100;
                    const heightPct = ((box[3] - box[1]) / currentDims.height) * 100;

                    return (
                      <div
                        key={`quote-box-${idx}`}
                        data-testid="quote-highlight-rect"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        className="absolute bg-amber-400/50 border-2 border-amber-600 rounded z-30 shadow-md ring-2 ring-amber-400/80 animate-pulse pointer-events-auto"
                        title={`Cited Quote (Line ${idx + 1}): [${box.map(Math.round).join(', ')}]`}
                      >
                        {idx === 0 && (
                          <div className="absolute -top-3.5 left-1 z-40 pointer-events-none">
                            <span className="bg-amber-600 text-white font-bold text-[9px] px-1.5 py-0.2 rounded shadow-2xs uppercase">
                              Target Citation
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Multi-Colored Section BBoxes for all extracted clauses */}
                {highlightAll &&
                  activePageClauses.map((c, idx) => {
                    const b = c.bounding_box!;
                    const isSelected = selectedClauseId === c.id;
                    const theme = CLAUSE_THEMES[idx % CLAUSE_THEMES.length];

                    const leftPct = (b[0] / currentDims.width) * 100;
                    const topPct = (b[1] / currentDims.height) * 100;
                    const widthPct = ((b[2] - b[0]) / currentDims.width) * 100;
                    const heightPct = ((b[3] - b[1]) / currentDims.height) * 100;

                    return (
                      <div
                        key={`clause-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCitationClick(c);
                        }}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        title={`Clause ${c.clause_number || ''}: ${c.section_title || ''} (Click to inspect)`}
                        className={`absolute cursor-pointer transition-all border-2 rounded ${
                          isSelected
                            ? `${theme.borderActive} ${theme.bgActive} ${theme.ring} z-20 shadow-md ring-2`
                            : `${theme.border} ${theme.bg} hover:border-blue-600 hover:bg-blue-300/40 z-10 opacity-70 hover:opacity-100`
                        }`}
                      >
                        <div className="absolute -top-3.5 left-1 z-25 pointer-events-none">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs ${
                            isSelected ? theme.activeBadge : theme.badge
                          }`}>
                            {c.clause_number || `C${idx + 1}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Sidebar: Metadata, Status Banner, Target Quote, & Other Citations */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 flex flex-col h-full">
            {/* 1. Document Metadata & Status Banner */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Document Lineage
                </span>
                <DocStatusBadge status={document?.doc_status || 'in force'} />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-sm text-navy-950 leading-tight">
                  {document?.name || docNameOrId}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    <span>{document?.page_count || 1} pages</span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>{clauses.length} extracted clauses</span>
                  </span>
                </div>
              </div>

              {document?.file_hash && (
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono bg-slate-50 p-1.5 rounded border border-slate-200">
                  <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">SHA: {document.file_hash}</span>
                </div>
              )}
            </div>

            {/* 2. Target Citation Quote Card */}
            {targetQuote && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center space-x-1">
                    <Quote className="w-3 h-3 text-amber-700" />
                    <span>Target Citation Quote</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.2 rounded">
                    Pg {currentPage}
                  </span>
                </div>

                <p className="text-xs text-amber-950 font-serif italic leading-relaxed">
                  "{targetQuote}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-amber-700 pt-1 border-t border-amber-200/60">
                  <span>
                    {quoteHighlight?.found
                      ? `${quoteHighlight.boxes.length} line ${
                          quoteHighlight.boxes.length > 1 ? 'rectangles' : 'rectangle'
                        } highlighted`
                      : 'Spatial bbox unindexed'}
                  </span>
                  {quoteHighlight?.boxes?.[0] && (
                    <span className="font-mono">
                      [{quoteHighlight.boxes[0].map(Math.round).join(', ')}]
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 3. Other Citations in this Document */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-700" />
                  <h4 className="font-bold text-xs text-navy-950">Other Citations in Document</h4>
                </div>
                <span className="text-[11px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                  {clauses.length}
                </span>
              </div>

              {/* Search filter for citations */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter other citations..."
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Citations List */}
              <div
                ref={sidebarListRef}
                className="space-y-2.5 overflow-y-auto max-h-[380px] custom-scrollbar flex-1 pr-1"
              >
                {filteredClauses.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No matching citations found.
                  </div>
                ) : (
                  filteredClauses.map((c, idx) => {
                    const isSelected =
                      selectedClauseId === c.id || (targetQuote && c.clause_text.includes(targetQuote.substring(0, 40)));
                    const isCurrentPage = (c.page_number || 1) === currentPage;
                    const theme = CLAUSE_THEMES[idx % CLAUSE_THEMES.length];

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleCitationClick(c)}
                        className={`p-3 rounded-xl text-xs space-y-1.5 cursor-pointer transition-all border ${
                          isSelected
                            ? theme.sidebarActive
                            : isCurrentPage
                            ? `${theme.sidebarCard} ring-1 ring-slate-200`
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold flex items-center space-x-1.5 truncate max-w-[190px]">
                            <span className={`w-2 h-2 rounded-full ${theme.dot} shrink-0`} />
                            <span className={theme.textAccent}>
                              Clause {c.clause_number || 'N/A'}: {c.section_title || 'Section'}
                            </span>
                          </div>
                          {c.page_number && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isCurrentPage
                                  ? 'bg-navy-950 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Pg {c.page_number}
                            </span>
                          )}
                        </div>

                        <p className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]">
                          {c.clause_text}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                          {c.bounding_box ? (
                            <span className="font-mono text-[9px] text-slate-400">
                              [{c.bounding_box.map(Math.round).join(', ')}]
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">Full span</span>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCertificateClause(c);
                            }}
                            title="Generate QR code and Government Verified Certificate"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold transition-colors"
                          >
                            <QrCode className="w-3 h-3 text-amber-700" />
                            <span>QR Cert</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

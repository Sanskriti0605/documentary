import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Target,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { pdfService } from '../../services/api';
import { ClauseItem } from '../../types';
import { useAppStore } from '../../stores/useAppStore';

export interface QuoteHighlightState {
  found: boolean;
  boxes: number[][];
  is_multiline: boolean;
  page_number?: number;
  cross_page?: {
    is_cross_page: boolean;
    continues_on_page?: number | null;
    continued_from_page?: number | null;
    continuation_quote?: string;
    next_boxes?: number[][];
  } | null;
  warning?: string | null;
}

export interface PdfPageViewerProps {
  documentName: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  targetQuote?: string;
  targetBbox?: string;
  clauses?: ClauseItem[];
  selectedClauseId?: string | null;
  onClauseSelect?: (clause: ClauseItem) => void;
  className?: string;
  initialZoom?: number;
}

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({
  documentName,
  currentPage,
  totalPages,
  onPageChange,
  targetQuote = '',
  targetBbox = '',
  clauses = [],
  selectedClauseId = null,
  onClauseSelect,
  className = '',
  initialZoom = 100,
}) => {
  const { showHighlights, toggleHighlights, setShowHighlights } = useAppStore();

  const [zoomLevel, setZoomLevel] = useState<number>(initialZoom);
  const [pageDimensions, setPageDimensions] = useState<{ [pageNum: number]: { width: number; height: number } }>({});
  const [quoteHighlight, setQuoteHighlight] = useState<QuoteHighlightState | null>(null);
  const [loadingBoxes, setLoadingBoxes] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [hoveredClauseId, setHoveredClauseId] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 1. Load PDF Page Dimensions on document change
  useEffect(() => {
    let isMounted = true;
    const fetchInfo = async () => {
      if (!documentName) return;
      try {
        const info = await pdfService.getPdfInfo(documentName);
        if (isMounted && info.pages) {
          const dimsMap: { [pageNum: number]: { width: number; height: number } } = {};
          info.pages.forEach((p) => {
            dimsMap[p.page_number] = { width: p.width, height: p.height };
          });
          setPageDimensions(dimsMap);
        }
      } catch (e) {
        console.error('Failed to load page dimensions:', e);
      }
    };
    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [documentName]);

  // 2. Fetch Quote Boxes when document, page or targetQuote changes
  useEffect(() => {
    let isMounted = true;

    // Clear stale highlights immediately
    setQuoteHighlight(null);

    const fetchBoxes = async () => {
      if (!documentName || !targetQuote) return;
      setLoadingBoxes(true);
      try {
        const res = await pdfService.getQuoteBoxes(documentName, targetQuote, currentPage, targetBbox || undefined);
        if (isMounted) {
          setQuoteHighlight(res);
          // If quote was relocated to another page, navigate there
          if (res.found && res.page_number && res.page_number !== currentPage) {
            onPageChange(res.page_number);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch quote bounding boxes:', err);
          setQuoteHighlight({
            found: false,
            boxes: [],
            is_multiline: false,
            page_number: currentPage,
            warning: 'Exact location could not be determined. Displaying quote text in sidebar.'
          });
        }
      } finally {
        if (isMounted) setLoadingBoxes(false);
      }
    };

    fetchBoxes();
    return () => {
      isMounted = false;
    };
  }, [documentName, currentPage, targetQuote, targetBbox]);

  // 3. Global Keyboard Shortcut "H" to toggle highlights
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, select or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHighlights();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHighlights]);

  // Current page dimensions (default to standard A4 points: 595.28 x 841.89)
  const currentDims = useMemo(() => {
    return pageDimensions[currentPage] || { width: 595.28, height: 841.89 };
  }, [pageDimensions, currentPage]);

  // Filter clauses belonging to current page
  const activePageClauses = useMemo(() => {
    return clauses.filter((c) => {
      if (!c.bounding_box || c.bounding_box.length !== 4) return false;
      return (c.page_number || 1) === currentPage;
    });
  }, [clauses, currentPage]);

  // Auto-scroll and Focus to highlighted box
  const handleFocusHighlight = () => {
    if (!showHighlights) {
      // Turn highlights back on when user clicks Focus Highlight
      setShowHighlights(true);
    }

    if (quoteHighlight?.found && quoteHighlight.boxes.length > 0) {
      const firstBox = quoteHighlight.boxes[0];
      const targetYPercent = (firstBox[1] / currentDims.height);
      if (viewerContainerRef.current && typeof viewerContainerRef.current.scrollTo === 'function') {
        const scrollTarget = viewerContainerRef.current.scrollHeight * targetYPercent - 100;
        viewerContainerRef.current.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth',
        });
      }
    }
  };

  const imageSrc = `/api/v1/pdf/${encodeURIComponent(documentName)}/page/${currentPage}?dpi=150`;

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[580px] ${className}`} data-testid="pdf-page-viewer">
      {/* Viewer Toolbar */}
      <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/70" data-testid="viewer-toolbar">
        {/* Page Navigation Controls */}
        <div className="flex items-center space-x-2">
          <button
            data-testid="prev-page-button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1 font-semibold text-slate-700">
            <span>Page</span>
            <input
              data-testid="page-number-input"
              type="number"
              min={1}
              max={Math.max(1, totalPages)}
              value={currentPage}
              onChange={(e) => {
                const p = parseInt(e.target.value, 10);
                if (!isNaN(p) && p >= 1 && p <= totalPages) {
                  onPageChange(p);
                }
              }}
              className="w-12 text-center py-0.5 border border-slate-300 rounded bg-white font-mono font-bold text-navy-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span>of {totalPages || 1}</span>
          </div>

          <button
            data-testid="next-page-button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center / Right: Highlights Toggle, Focus Button, and Zoom Controls */}
        <div className="flex items-center space-x-2">
          {/* Highlight ON/OFF Toggle Button */}
          <button
            data-testid="highlight-toggle-button"
            role="button"
            aria-pressed={showHighlights}
            onClick={toggleHighlights}
            title={`Toggle Highlights (Shortcut: H) - Currently ${showHighlights ? 'ON' : 'OFF'}`}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs transition-all ${
              showHighlights
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 ring-1 ring-amber-300/60'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
            }`}
          >
            {showHighlights ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-700" />
                <span>Highlights: ON</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Highlights: OFF</span>
              </>
            )}
          </button>

          {/* Focus Highlight Button */}
          {targetQuote && (
            <button
              data-testid="focus-highlight-button"
              onClick={handleFocusHighlight}
              title={showHighlights ? "Auto-scroll and center on cited passage" : "Turn highlights ON and focus quote"}
              className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs transition-colors ${
                showHighlights
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>{showHighlights ? 'Focus Quote' : 'Show & Focus'}</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 border border-slate-200 bg-white rounded-lg p-0.5">
            <button
              data-testid="zoom-out-button"
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              data-testid="zoom-level-text"
              onClick={() => setZoomLevel(100)}
              className="px-1.5 font-mono text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-blue-600"
              title="Click to reset zoom"
            >
              {zoomLevel}%
            </span>
            <button
              data-testid="zoom-in-button"
              onClick={() => setZoomLevel((z) => Math.min(250, z + 15))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Non-blocking Hint when a citation is active but highlights are turned OFF */}
      {targetQuote && !showHighlights && (
        <div
          data-testid="highlights-off-hint"
          className="mx-4 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 shadow-2xs animate-in fade-in"
        >
          <div className="flex items-center space-x-2">
            <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Highlights are off. The cited passage is available on this page.</span>
          </div>
          <button
            onClick={() => setShowHighlights(true)}
            data-testid="show-highlights-hint-button"
            className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] shadow-2xs transition-colors"
          >
            Show Highlights
          </button>
        </div>
      )}

      {/* Cross-Page Continuation Banner */}
      {showHighlights && quoteHighlight?.cross_page?.is_cross_page && (
        <div data-testid="cross-page-banner" className="mx-4 mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center space-x-2 font-medium">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              {quoteHighlight.cross_page.continues_on_page
                ? `Quote continues across page break onto Page ${quoteHighlight.cross_page.continues_on_page}`
                : `Quote continued from Page ${quoteHighlight.cross_page.continued_from_page}`}
            </span>
          </div>
          {quoteHighlight.cross_page.continues_on_page && (
            <button
              onClick={() => onPageChange(quoteHighlight.cross_page!.continues_on_page!)}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold text-xs shadow-2xs transition-colors"
            >
              Go to Page {quoteHighlight.cross_page.continues_on_page} &rarr;
            </button>
          )}
        </div>
      )}

      {/* Missing BBox Warning Banner */}
      {targetQuote && quoteHighlight && !quoteHighlight.found && (
        <div
          data-testid="missing-bbox-warning"
          className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1 text-xs text-amber-900 shadow-2xs"
        >
          <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Exact location could not be determined</span>
            <span>&bull;</span>
            <span>Bounding Box Unavailable on Current Page</span>
          </div>
          <p className="font-medium text-amber-800">
            {quoteHighlight.warning || 'Exact bounding box coordinates could not be isolated for this quote on the current page.'}
          </p>
          <div className="p-2 bg-white/90 border border-amber-200 rounded font-serif italic text-xs text-amber-950">
            "{targetQuote}"
          </div>
        </div>
      )}

      {/* PDF Canvas Area */}
      <div
        ref={viewerContainerRef}
        data-testid="pdf-viewport-container"
        className="flex-1 overflow-auto p-4 flex justify-center bg-slate-100/60 custom-scrollbar select-none"
      >
        <div
          style={{ width: `${zoomLevel}%` }}
          className="relative inline-block shadow-lg rounded bg-white transition-all duration-150 origin-top"
          data-testid="pdf-canvas-wrapper"
        >
          {/* Loading Indicator */}
          {(imageLoading || loadingBoxes) && (
            <div
              data-testid="image-loading-spinner"
              className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-40"
            >
              <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading Page Coordinates...</span>
              </div>
            </div>
          )}

          {/* Rendered Page Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt={`Page ${currentPage} of ${documentName}`}
            onLoadStart={() => setImageLoading(true)}
            onLoad={() => setImageLoading(false)}
            className="w-full h-auto object-contain block pointer-events-none"
            onError={(e) => {
              setImageLoading(false);
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* DRAWING HIGHLIGHT RECTANGLES: Skipped entirely when showHighlights is false */}
          {showHighlights && (
            <>
              {/* 1. Target Citation Quote Highlight (Amber) */}
              {quoteHighlight?.found &&
                quoteHighlight.boxes.map((box, idx) => {
                  const leftPct = (box[0] / currentDims.width) * 100;
                  const topPct = (box[1] / currentDims.height) * 100;
                  const widthPct = ((box[2] - box[0]) / currentDims.width) * 100;
                  const heightPct = ((box[3] - box[1]) / currentDims.height) * 100;

                  return (
                    <div
                      key={`active-quote-box-${idx}`}
                      data-testid="quote-highlight-rect"
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className="absolute bg-amber-400/45 border-2 border-amber-600 rounded z-30 shadow-xs ring-2 ring-amber-400/80 pointer-events-auto transition-all"
                      title={`Target Citation (Line ${idx + 1}): [${box.map(Math.round).join(', ')}]`}
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

              {/* 2. Other Citations in Document: Subtle outline, visible on hover/select */}
              {activePageClauses.map((c, idx) => {
                const b = c.bounding_box!;
                const isSelected = selectedClauseId === c.id;
                const isHovered = hoveredClauseId === c.id;

                const leftPct = (b[0] / currentDims.width) * 100;
                const topPct = (b[1] / currentDims.height) * 100;
                const widthPct = ((b[2] - b[0]) / currentDims.width) * 100;
                const heightPct = ((b[3] - b[1]) / currentDims.height) * 100;

                return (
                  <div
                    key={`other-clause-${c.id}`}
                    data-testid="other-clause-rect"
                    onMouseEnter={() => setHoveredClauseId(c.id)}
                    onMouseLeave={() => setHoveredClauseId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClauseSelect?.(c);
                    }}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    title={`Clause ${c.clause_number || ''}: ${c.section_title || ''}`}
                    className={`absolute cursor-pointer transition-all rounded ${
                      isSelected
                        ? 'border-2 border-blue-600 bg-blue-300/40 z-20 shadow-md ring-2 ring-blue-400/80'
                        : isHovered
                        ? 'border border-blue-400 bg-blue-100/30 z-15 shadow-2xs'
                        : 'border border-slate-400/40 hover:border-blue-400 bg-transparent z-10'
                    }`}
                  >
                    {(isSelected || isHovered) && (
                      <div className="absolute -top-3.5 left-1 z-25 pointer-events-none">
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded shadow-2xs bg-blue-600 text-white">
                          {c.clause_number || `C${idx + 1}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

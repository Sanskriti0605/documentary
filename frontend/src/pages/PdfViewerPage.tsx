import React, { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import { documentService, pdfService } from '../services/api';
import { DocumentItem, ClauseItem } from '../types';
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

export const PdfViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const docNameOrId = searchParams.get('doc') || '';
  const targetPage = parseInt(searchParams.get('page') || '1', 10);
  const bbox = searchParams.get('bbox') || '';

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [clauses, setClauses] = useState<ClauseItem[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(targetPage);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [clauseSearch, setClauseSearch] = useState<string>('');
  const [highlightAll, setHighlightAll] = useState<boolean>(true);
  const [pageDimensions, setPageDimensions] = useState<{ [pageNum: number]: { width: number; height: number } }>({});
  const [certificateClause, setCertificateClause] = useState<ClauseItem | null>(null);

  const sidebarListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    documentService.listDocuments().then((res) => {
      setAllDocs(res.documents);
      if (res.documents.length > 0) {
        const found = docNameOrId
          ? res.documents.find((d) => d.id === docNameOrId || d.name === docNameOrId)
          : res.documents[0];
        if (found) {
          setDocument(found);
          if (!docNameOrId) {
            setSearchParams({ doc: found.id, page: '1' }, { replace: true });
          }
          // Load clauses
          documentService.getClauses(found.id).then((cl) => {
            setClauses(cl);
            if (bbox && cl.length > 0) {
              const matched = cl.find(
                (c) => c.bounding_box && c.bounding_box.join(',') === bbox
              );
              if (matched) setSelectedClauseId(matched.id);
            } else if (cl.length > 0) {
              const firstOnPage = cl.find((c) => (c.page_number || 1) === targetPage);
              if (firstOnPage) {
                setSelectedClauseId(firstOnPage.id);
              }
            }
          }).catch(console.error);

          // Load PDF page dimensions
          pdfService.getPdfInfo(found.id || found.name).then((info) => {
            const dimsMap: { [pageNum: number]: { width: number; height: number } } = {};
            info.pages.forEach((p) => {
              dimsMap[p.page_number] = { width: p.width, height: p.height };
            });
            setPageDimensions(dimsMap);
          }).catch(console.error);
        }
      }
    });
  }, [docNameOrId]);

  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [targetPage]);

  // Auto-select first clause on current page if none selected for current page
  useEffect(() => {
    if (clauses.length > 0) {
      const pageClauses = clauses.filter((c) => (c.page_number || 1) === currentPage);
      if (pageClauses.length > 0) {
        const isCurrentSelectedOnPage = pageClauses.some((c) => c.id === selectedClauseId);
        if (!isCurrentSelectedOnPage) {
          const first = pageClauses[0];
          setSelectedClauseId(first.id);
          if (first.bounding_box) {
            setSearchParams({
              doc: document?.id || docNameOrId,
              page: String(currentPage),
              bbox: first.bounding_box.join(',')
            }, { replace: true });
          }
        }
      }
    }
  }, [currentPage, clauses]);

  const handleDocChange = (docIdentifier: string) => {
    setSearchParams({ doc: docIdentifier, page: '1' });
    setCurrentPage(1);
    setSelectedClauseId(null);
  };

  const handleClauseClick = (c: ClauseItem) => {
    const pageNum = c.page_number || currentPage;
    setCurrentPage(pageNum);
    setSelectedClauseId(c.id);
    const params: Record<string, string> = {
      doc: document?.id || docNameOrId,
      page: String(pageNum),
    };
    if (c.bounding_box) {
      params.bbox = c.bounding_box.join(',');
    }
    setSearchParams(params);
  };

  const currentDocName = document?.name || docNameOrId;
  const imageSrc = currentDocName
    ? `/api/v1/pdf/${encodeURIComponent(currentDocName)}/page/${currentPage}?highlight_all=${highlightAll}${bbox ? `&bbox=${encodeURIComponent(bbox)}` : ''}`
    : '';

  const activePageClauses = clauses.filter(
    (c) => (c.page_number || 1) === currentPage && c.bounding_box && c.bounding_box.length === 4
  );

  const currentDims = pageDimensions[currentPage] || { width: 612, height: 792 };

  const filteredClauses = clauses.filter((c) => {
    if (!clauseSearch) return true;
    const q = clauseSearch.toLowerCase();
    return (
      (c.clause_number && c.clause_number.toLowerCase().includes(q)) ||
      (c.section_title && c.section_title.toLowerCase().includes(q)) ||
      (c.clause_text && c.clause_text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Government Certificate Modal */}
      {certificateClause && (
        <GovernmentCertificateModal
          clause={certificateClause}
          document={document}
          onClose={() => setCertificateClause(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-navy-950 tracking-tight">PDF Evidence Viewer</h1>
            <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
              <Award className="w-3 h-3 text-amber-700" />
              <span>Gov. Certified QR Verification</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visual statutory verification: Each clause is highlighted with distinct colors and scannable QR verification certificates.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={document?.id || document?.name || docNameOrId}
            onChange={(e) => handleDocChange(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          >
            <option value="">Select Document to Inspect...</option>
            {allDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.clause_count || 0} clauses)
              </option>
            ))}
          </select>
        </div>
      </div>

      {!currentDocName && allDocs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-navy-950">No Document Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upload a document in the Document Library or run the synthetic seeder to view clauses and pages.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Viewer Surface */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[640px]">
            {/* Viewer Controls */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/60">
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const newPage = Math.max(1, currentPage - 1);
                    setCurrentPage(newPage);
                    setSearchParams({ doc: document?.id || docNameOrId, page: String(newPage) });
                  }}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-700">
                  Page {currentPage} of {document?.page_count || 1}
                </span>
                <button
                  disabled={currentPage >= (document?.page_count || 1)}
                  onClick={() => {
                    const newPage = currentPage + 1;
                    setCurrentPage(newPage);
                    setSearchParams({ doc: document?.id || docNameOrId, page: String(newPage) });
                  }}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="text-slate-300">|</span>

                {/* Multi-Color Highlight Toggle Button */}
                <button
                  onClick={() => setHighlightAll(!highlightAll)}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    highlightAll
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                  title="Toggle multi-color highlights"
                >
                  <Highlighter className="w-3.5 h-3.5 text-amber-600" />
                  <span>{highlightAll ? 'Multi-Color Highlights (ON)' : 'Highlights OFF'}</span>
                </button>
              </div>

              {/* Color legend & active count */}
              <div className="flex items-center space-x-3 text-slate-500">
                <div className="hidden sm:flex items-center space-x-1.5 text-[11px]">
                  <span className="text-slate-400">Colors:</span>
                  {activePageClauses.map((c, idx) => {
                    const theme = CLAUSE_THEMES[idx % CLAUSE_THEMES.length];
                    return (
                      <span
                        key={c.id}
                        title={`Clause ${c.clause_number}: ${theme.label}`}
                        className={`w-2.5 h-2.5 rounded-full ${theme.dot}`}
                      />
                    );
                  })}
                </div>

                <span className="inline-flex items-center space-x-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px] font-semibold">
                  <span>{activePageClauses.length} clause{activePageClauses.length === 1 ? '' : 's'}</span>
                </span>
              </div>
            </div>

            {/* Document Page Display with Multi-Colored Overlays & QR Anchors */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-100/60 overflow-auto">
              <div className="relative max-w-xl w-full bg-white shadow-lg border border-slate-300 rounded overflow-hidden select-none">
                <img
                  src={imageSrc}
                  alt={`Page ${currentPage} of ${currentDocName}`}
                  className="w-full h-auto object-contain block"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLElement).style.display = 'block';
                  }}
                />

                {/* Multi-Colored Interactive Clickable Overlays */}
                {highlightAll && activePageClauses.map((c, idx) => {
                  const isSelected = selectedClauseId === c.id;
                  const theme = CLAUSE_THEMES[idx % CLAUSE_THEMES.length];
                  const [x0, y0, x1, y1] = c.bounding_box!;
                  const leftPct = (x0 / currentDims.width) * 100;
                  const topPct = (y0 / currentDims.height) * 100;
                  const widthPct = Math.max(3, ((x1 - x0) / currentDims.width) * 100);
                  const heightPct = Math.max(2, ((y1 - y0) / currentDims.height) * 100);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleClauseClick(c)}
                      title={`Clause ${c.clause_number}: ${c.section_title || ''}\n${c.clause_text}`}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className={`absolute cursor-pointer transition-all rounded group ${
                        isSelected
                          ? `${theme.bgActive} border-2 ${theme.borderActive} shadow-lg ring-2 ${theme.ring} z-20`
                          : `${theme.bg} border ${theme.border} hover:${theme.bgActive} z-10`
                      }`}
                    >
                      {/* Floating Badge with Clause Title + QR Certificate Trigger */}
                      <div className="absolute -top-4 left-1 flex items-center space-x-1 z-30 pointer-events-auto">
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold shadow-xs truncate max-w-[130px] transition-all flex items-center space-x-1 ${
                            isSelected
                              ? `${theme.activeBadge} scale-105 shadow-sm`
                              : `${theme.badge} group-hover:scale-102`
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : theme.dot}`} />
                          <span>Clause {c.clause_number || 'N/A'}</span>
                        </div>

                        {/* Interactive QR Code Button right on the PDF Highlight */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCertificateClause(c);
                          }}
                          title="Scan QR & View Official Gov. Certified Certificate"
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/95 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-sm flex items-center space-x-1 transition-all hover:scale-110"
                        >
                          <QrCode className="w-2.5 h-2.5 text-amber-700" />
                          <span>QR</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Clauses Sidebar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 flex flex-col">
            <div className="border-b border-slate-100 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-navy-950">Extracted Clauses</h3>
                </div>
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {clauses.length} total
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clauses are colored by section. Click <span className="font-bold text-amber-800">QR Code</span> to view the Government Certified Certificate.
              </p>

              {/* Clause Filter Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter clauses..."
                  value={clauseSearch}
                  onChange={(e) => setClauseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div
              ref={sidebarListRef}
              className="space-y-3 overflow-y-auto max-h-[520px] custom-scrollbar flex-1 pr-1"
            >
              {filteredClauses.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  {clauses.length === 0 ? 'No segmented clauses for this document.' : 'No clauses match your filter.'}
                </div>
              ) : (
                filteredClauses.map((c, idx) => {
                  const isSelected = selectedClauseId === c.id;
                  const isCurrentPage = (c.page_number || 1) === currentPage;
                  const theme = CLAUSE_THEMES[idx % CLAUSE_THEMES.length];

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleClauseClick(c)}
                      className={`p-3.5 rounded-xl text-xs space-y-2 cursor-pointer transition-all border ${
                        isSelected
                          ? theme.sidebarActive
                          : isCurrentPage
                          ? `${theme.sidebarCard} ring-1 ring-slate-200`
                          : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold flex items-center space-x-1.5 truncate max-w-[200px]">
                          <span className={`w-2 h-2 rounded-full ${theme.dot} shrink-0`} />
                          <span className={theme.textAccent}>
                            Clause {c.clause_number || 'N/A'}: {c.section_title || 'Section'}
                          </span>
                        </div>
                        {c.page_number && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isCurrentPage
                              ? 'bg-navy-950 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            Pg {c.page_number}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 line-clamp-3 leading-relaxed">{c.clause_text}</p>
                      
                      {/* Action Row: Coordinates + QR Code & Government Certificate Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        {c.bounding_box ? (
                          <span className="font-mono text-[10px] text-slate-400">
                            [{c.bounding_box.map(Math.round).join(', ')}]
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Full span</span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCertificateClause(c);
                          }}
                          title="Open Scannable QR Code and Government Certified Certificate"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold shadow-2xs transition-colors hover:scale-102"
                        >
                          <QrCode className="w-3.5 h-3.5 text-amber-700" />
                          <span>QR & Gov. Certificate</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

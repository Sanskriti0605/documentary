import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink, Quote } from 'lucide-react';

export interface CitationChipProps {
  documentName: string;
  pageNumber: number;
  quote?: string;
  clauseNumber?: string;
  boundingBox?: number[];
  className?: string;
  onClick?: () => void;
}

export const CitationChip: React.FC<CitationChipProps> = ({
  documentName,
  pageNumber,
  quote,
  clauseNumber,
  boundingBox,
  className = '',
  onClick
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
      return;
    }

    const params = new URLSearchParams();
    params.set('doc', documentName);
    params.set('page', pageNumber.toString());
    if (quote) {
      params.set('quote', quote);
    }
    if (boundingBox && boundingBox.length === 4) {
      params.set('bbox', boundingBox.join(','));
    }

    navigate(`/viewer?${params.toString()}`);
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        data-testid="citation-chip"
        className={`inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-md border border-slate-200 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${className}`}
      >
        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="font-semibold truncate max-w-[200px]">{documentName}</span>
        <span className="text-slate-400">&bull;</span>
        <span className="font-mono text-slate-600">P.{pageNumber}</span>
        {clauseNumber && (
          <>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-500 truncate max-w-[90px]">Cl. {clauseNumber}</span>
          </>
        )}
        <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400 shrink-0" />
      </button>

      {/* Hover Quote Card */}
      {isHovered && quote && (
        <div
          data-testid="citation-hover-card"
          className="absolute z-50 bottom-full left-0 mb-2 w-72 sm:w-80 p-3 bg-navy-950 text-white rounded-lg shadow-xl border border-slate-700 text-xs space-y-1.5 pointer-events-none animate-fadeIn"
        >
          <div className="flex items-center space-x-1.5 text-blue-400 font-bold text-[11px] uppercase tracking-wider">
            <Quote className="w-3 h-3" />
            <span>Exact Cited Passage &bull; Page {pageNumber}</span>
          </div>
          <p className="text-slate-200 leading-relaxed italic line-clamp-4 font-serif">
            "{quote}"
          </p>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
            <span>{documentName}</span>
            <span className="text-blue-400">Click to view in PDF Viewer</span>
          </div>
        </div>
      )}
    </div>
  );
};

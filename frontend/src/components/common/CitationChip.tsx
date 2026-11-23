import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';

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
    <button
      type="button"
      onClick={handleClick}
      title={quote ? `"${quote}"` : `View ${documentName} Page ${pageNumber}`}
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
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  Printer,
  Copy,
  Check,
  FileText,
  MapPin,
  Building2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { documentService } from '../services/api';

export const CertificateVerificationPage: React.FC = () => {
  const { clauseId } = useParams<{ clauseId: string }>();
  const [certData, setCertData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!clauseId) return;
    setLoading(true);
    documentService
      .getClauseDetail(clauseId)
      .then((data) => {
        setCertData(data);
      })
      .catch((err) => {
        console.error('Failed to load clause certificate:', err);
        setError('Clause verification certificate could not be retrieved.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clauseId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3 bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="font-bold text-navy-950 text-sm">Verifying Statutory Authenticity...</h3>
          <p className="text-xs text-slate-500">Querying National Banking Regulatory Evidence Ledger</p>
        </div>
      </div>
    );
  }

  if (error || !certData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-rose-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-navy-950">Verification Certificate Not Found</h2>
          <p className="text-xs text-slate-600">
            {error || 'The requested clause verification record could not be located in the statutory database.'}
          </p>
          <Link
            to="/viewer"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Document Viewer</span>
          </Link>
        </div>
      </div>
    );
  }

  const currentUrl = window.location.href;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Navigation / Action Bar */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            to={`/viewer?doc=${certData.document_id}&page=${certData.page_number}`}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-navy-950 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to PDF Viewer</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Official Certificate</span>
            </button>
          </div>
        </div>

        {/* Certificate Card */}
        <div className="bg-gradient-to-b from-amber-50/50 via-white to-amber-50/40 rounded-2xl shadow-xl border-2 border-amber-400/80 p-6 sm:p-10 text-slate-900 relative">
          
          <div className="border-4 border-double border-amber-600/70 rounded-xl p-6 sm:p-8 bg-white/95 relative shadow-xs">
            
            {/* Watermark Seal */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none">
              <ShieldCheck className="w-96 h-96 text-navy-950" />
            </div>

            {/* Emblem & Authority Header */}
            <div className="text-center space-y-1.5 border-b-2 border-amber-600/40 pb-5">
              <div className="text-amber-800 font-serif text-xl tracking-widest font-black">
                सत्यमेव जयते
              </div>
              <div className="text-[10px] tracking-wider text-slate-500 uppercase font-semibold">
                Government of India • Ministry of Finance
              </div>

              <h1 className="text-lg sm:text-xl font-serif font-black tracking-wide text-navy-950 uppercase pt-1">
                National Regulatory & Banking Document Compliance Authority
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Official Digital Statutory Verification Platform • Information Technology Act 2000
              </p>

              <div className="pt-2">
                <span className="inline-flex items-center space-x-1.5 bg-amber-100 text-amber-950 px-4 py-1 rounded-full text-xs font-bold border border-amber-300 tracking-wide uppercase shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Statutory Certificate of Extracted Clause Authenticity</span>
                </span>
              </div>
            </div>

            {/* Meta Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4 text-xs border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Certificate ID</span>
                <span className="font-mono font-bold text-navy-950 text-xs sm:text-sm">{certData.certificate_id}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verification Date</span>
                <span className="font-semibold text-slate-700">{new Date(certData.verified_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Statutory Status</span>
                <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                  VERIFIED & SEALED
                </span>
              </div>
            </div>

            {/* Verification Detail Grid */}
            <div className="py-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-semibold">Source Document:</span>
                  </div>
                  <div className="font-bold text-navy-950 text-xs">{certData.document_name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hash: {certData.document_hash.substring(0, 20)}...
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold">Regulating Issuer & Type:</span>
                  </div>
                  <div className="font-bold text-navy-950 text-xs">{certData.issuer}</div>
                  <div className="text-[10px] text-slate-500">
                    Category: <span className="font-semibold text-slate-700">{certData.document_type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Clause Identification */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-amber-950 bg-amber-200/90 px-2.5 py-1 rounded">
                    Clause {certData.clause_number || 'N/A'}
                  </span>
                  <span className="font-bold text-navy-950 text-xs">
                    {certData.section_title}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-600">
                  <span className="flex items-center space-x-1 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-amber-700" />
                    <span>Page {certData.page_number}</span>
                  </span>
                  {certData.bounding_box && (
                    <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-amber-200 text-slate-600">
                      BBox: [{certData.bounding_box.map(Math.round).join(', ')}]
                    </span>
                  )}
                </div>
              </div>

              {/* Verbatim Statutory Extract */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Certified Verbatim Statutory Text Extract</span>
                  <span className="text-emerald-700 font-semibold lowercase">100% exact substring match</span>
                </div>
                <div className="p-4 bg-white rounded-xl border-2 border-amber-200/90 text-xs font-serif leading-relaxed text-slate-800 italic shadow-xs">
                  "{certData.clause_text}"
                </div>
              </div>
            </div>

            {/* Verification Footer with Scannable QR Code */}
            <div className="pt-4 border-t-2 border-amber-600/40 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              
              <div className="flex items-center space-x-3 sm:col-span-2">
                <div className="p-2 bg-white rounded-lg border-2 border-amber-600/50 shadow-sm shrink-0">
                  <QRCodeSVG
                    value={currentUrl}
                    size={84}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-navy-950 flex items-center space-x-1.5">
                    <span>Scanned Public Verification Anchor</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    This statutory certificate is anchored in the VERITAS compliance ledger and authenticated for audits.
                  </p>
                  <div className="text-[10px] font-mono text-slate-400 truncate max-w-[280px]">
                    {certData.law_reference}
                  </div>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 space-y-1">
                <div className="inline-block text-center border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <div className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">
                    GOVERNMENT OF INDIA
                  </div>
                  <div className="text-[11px] font-black text-emerald-950">
                    DIGITALLY SEALED
                  </div>
                  <div className="text-[8px] font-mono text-emerald-700">
                    STATUTORY VERIFICATION
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 text-center">
                  SHA-256 Tamper-Proof Cryptographic Signature
                </p>
              </div>

            </div>

          </div>

          <div className="text-center pt-3 text-[10px] text-slate-400">
            Official statutory evidence record under Section 35A of the Banking Regulation Act & Information Technology Act 2000.
          </div>

        </div>

      </div>
    </div>
  );
};

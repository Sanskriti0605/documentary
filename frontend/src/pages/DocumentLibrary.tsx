import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Search,
  Filter,
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { documentService } from '../services/api';
import { DocumentItem } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { DocStatusBadge } from '../components/common/DocStatusBadge';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';

const DOCUMENT_TYPES = [
  { value: '', label: 'All Document Types' },
  { value: 'RBI_MASTER_DIRECTION', label: 'RBI Master Direction' },
  { value: 'RBI_CIRCULAR', label: 'RBI Circular / Notification' },
  { value: 'BANK_LOAN_POLICY', label: 'Bank Loan Policy' },
  { value: 'PERSONAL_LOAN_AGREEMENT', label: 'Personal Loan Agreement' },
  { value: 'HOME_LOAN_AGREEMENT', label: 'Home Loan Agreement' },
  { value: 'KEY_FACTS_STATEMENT', label: 'Key Facts Statement (KFS)' },
  { value: 'SANCTION_LETTER', label: 'Loan Sanction Letter' },
  { value: 'INTEREST_REVISION_NOTICE', label: 'Interest Rate Revision Notice' },
  { value: 'REPAYMENT_SCHEDULE', label: 'Repayment Schedule' },
  { value: 'PENAL_CHARGES_POLICY', label: 'Penal Charges Policy' },
  { value: 'FORECLOSURE_POLICY', label: 'Foreclosure Policy' },
  { value: 'SCHEDULE_OF_CHARGES', label: 'Schedule of Charges' },
  { value: 'ACCOUNT_STATEMENT', label: 'Loan Account Statement' },
];

export const DocumentLibrary: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setSelectedDocumentId } = useAppStore();

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentService.listDocuments(selectedType || undefined);
      setDocuments(data.documents);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to retrieve document library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedType]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', selectedType || 'OTHER');
        formData.append('domain', 'RETAIL_LENDING');
        await documentService.uploadDocument(formData);
      }
      await fetchDocuments();
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await documentService.deleteDocument(id);
      setDocuments(documents.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleView = (id: string) => {
    setSelectedDocumentId(id);
    navigate(`/viewer?doc=${id}`);
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">Document Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage, upload and inspect Indian banking regulatory & lending agreements.
          </p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading PDFs...' : 'Upload PDF Documents'}</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents by name or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDocuments}
            className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Document Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Document Name</th>
                <th className="px-6 py-3.5">Classification</th>
                <th className="px-6 py-3.5">Legal State</th>
                <th className="px-6 py-3.5">Ingestion</th>
                <th className="px-6 py-3.5">Pages</th>
                <th className="px-6 py-3.5">Clauses</th>
                <th className="px-6 py-3.5">Upload Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    Loading documents...
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No documents found. Click "Upload PDF Documents" to add lending policies and circulars.
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-navy-950">{doc.name}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {doc.file_hash.substring(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                        {doc.document_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <DocStatusBadge status={doc.doc_status || (doc.status === 'PROCESSED' ? 'in force' : 'draft')} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{doc.page_count}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{doc.clause_count}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleView(doc.id)}
                        title="View PDF Evidence"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        title="Delete Document"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

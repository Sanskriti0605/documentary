import axios from 'axios';
import {
  DocumentItem,
  ConflictItem,
  AmendmentGraph,
  TimelineItem,
  AnalyticsStats,
  SystemHealth,
  ClauseItem
} from '../types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface AskResponse {
  session_id: string;
  query: string;
  answer: string;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'CONFLICTED' | 'INSUFFICIENT_EVIDENCE';
  faithfulness_score: number;
  generated_count: number;
  verified_count: number;
  blocked_count: number;
  verified_claims: Array<{
    text: string;
    status: string;
    citations: Array<{
      quote: string;
      document_name: string;
      page_number: number;
      clause_number?: string;
      bounding_box?: number[];
    }>;
  }>;
  blocked_claims: Array<{
    original_claim: string;
    reason: string;
    message: string;
  }>;
  calculation?: {
    type: string;
    result: any;
    summary: string;
  };
  retrieved_quotes: Array<any>;
}

export interface EvalBenchmarkResponse {
  total_test_cases: number;
  passed: number;
  failed: number;
  accuracy_percentage: number;
  results: Array<{
    test_case_id: string;
    category: string;
    question: string;
    status: 'PASSED' | 'FAILED';
    details: any;
  }>;
}

export const systemService = {
  getHealth: async (): Promise<SystemHealth> => {
    const res = await api.get<SystemHealth>('/health');
    return res.data;
  },
  getAnalytics: async (): Promise<AnalyticsStats> => {
    const res = await api.get<AnalyticsStats>('/analytics');
    return res.data;
  },
};

export const documentService = {
  listDocuments: async (typeFilter?: string): Promise<{ total: number; documents: DocumentItem[] }> => {
    const params = typeFilter ? { document_type: typeFilter } : {};
    const res = await api.get<{ total: number; documents: DocumentItem[] }>('/documents', { params });
    return res.data;
  },
  getDocument: async (id: string): Promise<DocumentItem> => {
    const res = await api.get<DocumentItem>(`/documents/${id}`);
    return res.data;
  },
  uploadDocument: async (formData: FormData): Promise<DocumentItem> => {
    const res = await api.post<DocumentItem>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
  getClauses: async (documentId: string): Promise<ClauseItem[]> => {
    const res = await api.get<ClauseItem[]>(`/documents/${documentId}/clauses`);
    return res.data;
  },
  getAllClauses: async (limit: number = 50): Promise<ClauseItem[]> => {
    const res = await api.get<ClauseItem[]>('/documents/clauses/all', { params: { limit } });
    return res.data;
  },
  getClauseDetail: async (clauseId: string): Promise<any> => {
    const res = await api.get(`/documents/clause/${clauseId}`);
    return res.data;
  },
  processDocument: async (id: string): Promise<any> => {
    const res = await api.post(`/documents/${id}/process`);
    return res.data;
  },
};

export const pdfService = {
  getPdfInfo: async (
    docNameOrId: string
  ): Promise<{
    page_count: number;
    pages: Array<{ page_number: number; width: number; height: number }>;
  }> => {
    const res = await api.get(`/pdf/${encodeURIComponent(docNameOrId)}/info`);
    return res.data;
  },
};

export const askService = {
  ask: async (query: string, documentIds?: string[], asOfDate?: string): Promise<AskResponse> => {
    const res = await api.post<AskResponse>('/ask', {
      query,
      document_ids: documentIds,
      as_of_date: asOfDate,
    });
    return res.data;
  },
};

export const conflictService = {
  listConflicts: async (status?: string): Promise<{ total: number; conflicts: ConflictItem[] }> => {
    const params = status ? { resolution_status: status } : {};
    const res = await api.get<{ total: number; conflicts: ConflictItem[] }>('/conflicts', { params });
    return res.data;
  },
  reviewConflict: async (id: string, resolutionStatus: string, notes: string): Promise<ConflictItem> => {
    const res = await api.post<ConflictItem>(`/conflicts/${id}/review`, {
      resolution_status: resolutionStatus,
      resolution_notes: notes,
    });
    return res.data;
  },
};

export const amendmentService = {
  getGraph: async (): Promise<AmendmentGraph> => {
    const res = await api.get<AmendmentGraph>('/amendments/graph');
    return res.data;
  },
  getTimeline: async (): Promise<TimelineItem[]> => {
    const res = await api.get<TimelineItem[]>('/amendments/timeline');
    return res.data;
  },
};

export const evalService = {
  runEvaluation: async (): Promise<EvalBenchmarkResponse> => {
    const res = await api.get<EvalBenchmarkResponse>('/eval/run');
    return res.data;
  },
};

export default api;

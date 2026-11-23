import axios from 'axios';
import {
  DocumentItem,
  Conflict,
  ConflictItem,
  AmendmentGraph,
  TimelineItem,
  AnalyticsStats,
  SystemHealth,
  ClauseItem,
  AskResponse,
  EvalBenchmarkResponse,
  ConflictSummaryStats,
  ConflictScanResponse,
  AmendmentResolutionResponse
} from '../types';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  processDocument: async (id: string): Promise<any> => {
    const res = await api.post(`/documents/${id}/process`);
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
  listConflicts: async (filters?: {
    status?: string;
    subject?: string;
    document?: string;
    conflict_type?: string;
    resolution_status?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ total: number; conflicts: ConflictItem[]; summary?: ConflictSummaryStats }> => {
    const params: Record<string, any> = {};
    if (filters) {
      if (filters.resolution_status || filters.status) {
        params.resolution_status = filters.resolution_status || filters.status;
      }
      if (filters.subject) params.subject = filters.subject;
      if (filters.document) params.document = filters.document;
      if (filters.conflict_type) params.conflict_type = filters.conflict_type;
      if (filters.skip !== undefined) params.skip = filters.skip;
      if (filters.limit !== undefined) params.limit = filters.limit;
    }
    const res = await api.get<{ total: number; conflicts: ConflictItem[]; summary?: ConflictSummaryStats }>('/conflicts', { params });
    return res.data;
  },
  patchConflict: async (
    id: string,
    data: {
      resolution_status: string;
      resolution_notes: string;
      linked_document_id?: string;
      linked_document_name?: string;
    }
  ): Promise<Conflict> => {
    const res = await api.patch<Conflict>(`/conflicts/${id}`, data);
    return res.data;
  },
  reviewConflict: async (
    id: string,
    resolutionStatus: string,
    notes: string,
    linkedDocName?: string
  ): Promise<Conflict> => {
    const res = await api.patch<Conflict>(`/conflicts/${id}`, {
      resolution_status: resolutionStatus,
      resolution_notes: notes,
      linked_document_name: linkedDocName,
    });
    return res.data;
  },
  scanConflicts: async (): Promise<ConflictScanResponse> => {
    const res = await api.post<ConflictScanResponse>('/conflicts/scan');
    return res.data;
  },
};

export const amendmentService = {
  resolveAmendments: async (
    rule?: string,
    asOf?: string,
    lenderType?: string,
    sanctionDate?: string
  ): Promise<AmendmentResolutionResponse> => {
    const params: Record<string, string> = {};
    if (rule) params.rule = rule;
    if (asOf) params.as_of = asOf;
    if (lenderType) params.lender_type = lenderType;
    if (sanctionDate) params.sanction_date = sanctionDate;
    const res = await api.get<AmendmentResolutionResponse>('/amendments', { params });
    return res.data;
  },
  getGraph: async (rule?: string, asOf?: string): Promise<AmendmentGraph> => {
    const params: Record<string, string> = {};
    if (rule) params.rule = rule;
    if (asOf) params.as_of = asOf;
    const res = await api.get<AmendmentGraph>('/amendments/graph', { params });
    return res.data;
  },
  getTimeline: async (rule?: string, asOf?: string): Promise<TimelineItem[]> => {
    const params: Record<string, string> = {};
    if (rule) params.rule = rule;
    if (asOf) params.as_of = asOf;
    const res = await api.get<TimelineItem[]>('/amendments/timeline', { params });
    return res.data;
  },
};

export const evalService = {
  runEvaluation: async (): Promise<EvalBenchmarkResponse> => {
    const res = await api.get<EvalBenchmarkResponse>('/eval/run');
    return res.data;
  },
};

// Re-export shared types for callers that import from api
export type { AskResponse, EvalBenchmarkResponse } from '../types';

export default api;

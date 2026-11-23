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
  EvalBenchmarkResponse
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
  listConflicts: async (status?: string): Promise<{ total: number; conflicts: ConflictItem[] }> => {
    const params = status ? { resolution_status: status } : {};
    const res = await api.get<{ total: number; conflicts: ConflictItem[] }>('/conflicts', { params });
    return res.data;
  },
  reviewConflict: async (id: string, resolutionStatus: string, notes: string): Promise<Conflict> => {
    const res = await api.post<Conflict>(`/conflicts/${id}/review`, {
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

// Re-export shared types for callers that import from api
export type { AskResponse, EvalBenchmarkResponse } from '../types';

export default api;

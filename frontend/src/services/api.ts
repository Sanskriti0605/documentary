import axios from 'axios';
import {
  DocumentItem,
  QuerySession,
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

export const queryService = {
  submitQuery: async (query: string, documentIds?: string[], asOfDate?: string): Promise<QuerySession> => {
    const res = await api.post<QuerySession>('/query', {
      query,
      document_ids: documentIds,
      as_of_date: asOfDate,
    });
    return res.data;
  },
  getQuery: async (id: string): Promise<QuerySession> => {
    const res = await api.get<QuerySession>(`/query/${id}`);
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

export default api;

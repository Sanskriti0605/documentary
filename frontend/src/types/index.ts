export type DocumentType =
  | 'RBI_MASTER_DIRECTION'
  | 'RBI_CIRCULAR'
  | 'BANK_LOAN_POLICY'
  | 'PERSONAL_LOAN_AGREEMENT'
  | 'HOME_LOAN_AGREEMENT'
  | 'KEY_FACTS_STATEMENT'
  | 'SANCTION_LETTER'
  | 'INTEREST_REVISION_NOTICE'
  | 'REPAYMENT_SCHEDULE'
  | 'PENAL_CHARGES_POLICY'
  | 'RESTRUCTURING_LETTER'
  | 'FORECLOSURE_POLICY'
  | 'SCHEDULE_OF_CHARGES'
  | 'ACCOUNT_STATEMENT'
  | 'OTHER';

export type IngestionStatus = 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface DocumentItem {
  id: string;
  name: string;
  file_hash: string;
  document_type: string;
  domain: string;
  issuer?: string;
  publication_date?: string;
  effective_from?: string;
  effective_to?: string;
  version?: string;
  status: IngestionStatus;
  page_count: number;
  clause_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageItem {
  id: string;
  page_number: number;
  extracted_text: string;
  rendered_image_path?: string;
  extraction_confidence: number;
}

export interface ClauseItem {
  id: string;
  document_id: string;
  page_id: string;
  parent_clause_id?: string;
  clause_number?: string;
  section_title?: string;
  clause_text: string;
  subject?: string;
  attribute?: string;
  scope?: string;
  effective_from?: string;
  effective_to?: string;
  bounding_box?: number[];
}

export interface CitationItem {
  id: string;
  claim_id: string;
  clause_id: string;
  page_number: number;
  document_id?: string;
  document_name?: string;
  clause_number?: string;
  section_title?: string;
  exact_quote: string;
  quote_hash: string;
  bounding_box?: number[];
  support_status: 'FULL_SUPPORT' | 'PARTIAL_SUPPORT' | 'UNSUPPORTED';
}

export interface ClaimItem {
  id: string;
  session_id: string;
  claim_text: string;
  verification_status: 'VERIFIED' | 'UNSUPPORTED' | 'CONTRADICTED';
  verification_score: number;
  citations: CitationItem[];
}

export interface QuerySession {
  id: string;
  query: string;
  answer: string;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'CONFLICTED' | 'INSUFFICIENT_EVIDENCE';
  faithfulness_score: number;
  as_of_date?: string;
  claims: ClaimItem[];
  created_at: string;
}

export interface ConflictItem {
  id: string;
  clause_a_id: string;
  clause_b_id: string;
  clause_a?: ClauseItem;
  clause_b?: ClauseItem;
  conflict_type:
    | 'CONFIRMED_CONFLICT'
    | 'POSSIBLE_CONFLICT'
    | 'SUPERSEDED'
    | 'TEMPORAL_DIFFERENCE'
    | 'CONDITIONAL_DIFFERENCE'
    | 'NO_CONFLICT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scope_overlap: boolean;
  temporal_overlap: boolean;
  resolution_status: 'PENDING_REVIEW' | 'RESOLVED_AMENDMENT' | 'RESOLVED_SCOPE' | 'DISMISSED';
  resolution_notes?: string;
  created_at: string;
}

export interface AmendmentNode {
  id: string;
  label: string;
  document_name: string;
  document_type: string;
  clause_number?: string;
  section_title?: string;
  clause_text: string;
  effective_from?: string;
  effective_to?: string;
}

export interface AmendmentEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  old_value?: string;
  new_value?: string;
  effective_date?: string;
}

export interface AmendmentGraph {
  nodes: AmendmentNode[];
  edges: AmendmentEdge[];
}

export interface TimelineItem {
  date?: string;
  event_type: string;
  document_name: string;
  clause_number?: string;
  description: string;
  clause_id: string;
}

export interface AnalyticsStats {
  total_documents: number;
  processed_documents: number;
  extracted_clauses: number;
  active_amendments: number;
  detected_conflicts: number;
  pending_reviews: number;
  recent_activity: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    timestamp: string;
  }>;
}

export interface SystemHealth {
  status: string;
  version: string;
  environment: string;
  database: string;
  vector_store: string;
  storage_writable: boolean;
}

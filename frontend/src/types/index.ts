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

export type DocStatus =
  | 'IN_FORCE'
  | 'SUPERSEDED'
  | 'WITHDRAWN'
  | 'DRAFT'
  | 'in force'
  | 'superseded'
  | 'withdrawn'
  | 'draft';

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
  doc_status?: DocStatus;
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
  page_id?: string;
  page_number?: number;
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

export interface Citation {
  id: string;
  claim_id?: string;
  clause_id?: string;
  page_number: number;
  exact_quote?: string;
  quote?: string; // alias for exact_quote
  quote_hash?: string;
  bounding_box?: number[] | null;
  support_status?: 'FULL_SUPPORT' | 'PARTIAL_SUPPORT' | 'UNSUPPORTED';
  created_at?: string;
  // Enriched metadata from API joins
  document_id?: string;
  document_name: string;
  clause_number?: string;
  section_title?: string;
}

export type CitationItem = Citation;

export interface Claim {
  id: string;
  session_id?: string;
  claim_text: string;
  text?: string; // generator alias
  verification_status: 'VERIFIED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'BLOCKED';
  status?: string;
  verdict?: string;
  verification_score: number;
  verifier?: string;
  generator?: string;
  is_fallback?: boolean;
  searched_for?: string;
  missing?: string;
  nli_score?: number;
  nli_label?: string;
  citations: Citation[];
  created_at?: string;
}

export type ClaimItem = Claim;

export interface ConflictHistoryItem {
  timestamp: string;
  action: string;
  previous_status: string;
  new_status: string;
  notes: string;
  linked_document_id?: string | null;
  linked_document_name?: string | null;
}

export interface ConflictSummaryStats {
  total: number;
  pending_review: number;
  confirmed_conflicts: number;
  auto_resolved: number;
  resolved_by_reviewer: number;
}

export interface ConflictScanResponse {
  scanned_clauses: number;
  new_conflicts: number;
  auto_resolved: number;
  existing_conflicts: number;
  total_conflicts: number;
  message: string;
}

export interface Conflict {
  id: string;
  clause_a_id: string;
  clause_b_id: string;
  conflict_type:
    | 'CONFIRMED_CONFLICT'
    | 'POSSIBLE_CONFLICT'
    | 'SUPERSEDED'
    | 'TEMPORAL_DIFFERENCE'
    | 'CONDITIONAL_DIFFERENCE'
    | 'NO_CONFLICT'
    | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  scope_overlap: boolean;
  temporal_overlap: boolean;
  resolution_status:
    | 'PENDING_REVIEW'
    | 'RESOLVED_AMENDMENT'
    | 'RESOLVED_SCOPE'
    | 'DISMISSED'
    | 'AUTO_RESOLVED'
    | string;
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Enriched fields from API joins
  subject?: string;
  doc_a_name?: string;
  doc_b_name?: string;
  clause_a_number?: string;
  clause_b_number?: string;
  value_a?: string;
  value_b?: string;
  quote_a?: string;
  quote_b?: string;
  linked_document_id?: string | null;
  linked_document_name?: string | null;
  history?: ConflictHistoryItem[];
  clause_a?: ClauseItem;
  clause_b?: ClauseItem;
}

export type ConflictItem = Conflict;

export interface AmendmentEdge {
  id: string;
  source_clause_id?: string;
  target_clause_id?: string;
  relationship_type?: 'AMENDS' | 'SUPERSEDES' | 'MODIFIES' | 'REPLACES' | 'REPEALS';
  old_value?: string | null;
  new_value?: string | null;
  effective_date?: string | null;
  verification_status?: 'UNVERIFIED' | 'VERIFIED' | 'CONTESTED';
  created_at?: string;
  // React Flow graph compatibility aliases
  source: string;
  target: string;
  relationship: string;
  source_document_name?: string;
  target_document_name?: string;
}

export interface ApplicabilityConditions {
  sanction_date?: string | null;
  lender_type?: string | null;
  scope?: string | null;
  notes?: string | null;
}

export interface VersionInForceItem {
  document_id: string;
  document_name: string;
  document_type: string;
  clause_id?: string | null;
  clause_number?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status: string;
  value?: string | null;
  quote: string;
  amending_quote?: string | null;
  is_partial_amendment?: boolean;
  inherited_from_document?: string | null;
  applicability_conditions?: ApplicabilityConditions | null;
}

export interface ChainVersionItem {
  id: string;
  document_id: string;
  document_name: string;
  document_type: string;
  clause_id?: string | null;
  clause_number?: string | null;
  publication_date?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status: string;
  relationship_to_prior?: string | null;
  quote: string;
  amending_quote?: string | null;
  is_partial_amendment?: boolean;
  applicability_conditions?: ApplicabilityConditions | null;
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
  status?: string;
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
  status?: string;
  quote?: string;
}

export interface AmendmentResolutionResponse {
  rule: string;
  as_of: string;
  version_in_force?: VersionInForceItem | null;
  chain: ChainVersionItem[];
  nodes: AmendmentNode[];
  edges: AmendmentEdge[];
  timeline: TimelineItem[];
  available_rules: Array<{ id: string; name: string; subject?: string }>;
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
  llm?: {
    provider: string;
    model: string;
    base_url: string;
    api_key_configured: boolean;
    api_key_status: string;
    status: string;
    details: string;
    reachable?: boolean;
  };
}

export interface LLMHealth {
  provider: string;
  model: string;
  base_url: string;
  api_key_configured: boolean;
  api_key_status: string;
  status: string;
  details: string;
  reachable?: boolean;
}

export interface AskResponse {
  session_id: string;
  query: string;
  answer: string;
  status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'CONFLICTED' | 'INSUFFICIENT_EVIDENCE';
  faithfulness_score: number;
  generated_count: number;
  verified_count: number;
  blocked_count: number;
  generation_provider?: string;
  is_fallback?: boolean;
  model_name?: string;
  conflict_found?: boolean;
  conflict_subject?: string | null;
  has_version_chain?: boolean;
  verified_claims: Array<{
    text: string;
    verdict?: string;
    status: string;
    verifier?: string;
    generator?: string;
    is_fallback?: boolean;
    nli_score?: number;
    nli_label?: string;
    citations: Citation[];
  }>;
  blocked_claims: Array<{
    original_claim: string;
    verdict?: string;
    reason: string;
    searched_for?: string;
    missing?: string;
    verifier?: string;
    generator?: string;
    is_fallback?: boolean;
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

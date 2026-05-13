/**
 * Types métier de l'action GitHub scan-access (miroir des DTO Pydantic côté back).
 *
 * Les structures suivent fidèlement les schémas exposés par les endpoints :
 *   GET /api/v1/scans/{id}/result.json
 *   GET /api/v1/scans/{id}/sarif
 *   POST /api/v1/scans
 */

export type Region = "us_ada" | "eu_eaa";

export type ScanStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export type Impact = "critical" | "serious" | "moderate" | "minor";

export type FailOnLevel = "never" | "minor" | "moderate" | "serious" | "critical" | "any";

export type AiFixStatus = "not_requested" | "pending" | "generated" | "failed";

export interface ScanConfigPayload {
  max_pages: number;
  max_depth: number;
}

export interface ScanCreatePayload {
  store_id: string;
  region: Region;
  scan_config?: ScanConfigPayload;
}

export interface ScanResponse {
  id: string;
  store_id: string;
  url: string;
  status: ScanStatus;
  region: Region;
  score: number | null;
  issue_count: number;
  axe_version: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  scan_config: Record<string, unknown>;
  pages_total: number | null;
  pages_done: number;
  current_page_url: string | null;
}

export interface ScanResultSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  incomplete: number;
}

export interface ScanResultScanInfo extends ScanResponse {
  scan_url: string;
  pdf_url: string | null;
}

export interface ScanResultLinks {
  scan_url: string;
  sarif_url: string;
  pdf_url: string | null;
}

export interface DetectedStack {
  id: string;
  scan_id: string;
  tech_name: string;
  category: string | null;
  version: string | null;
  confidence: number;
  source: "auto" | "manual";
  detected_at: string;
}

export interface ScanResultIssue {
  id: string;
  rule_id: string;
  impact: Impact;
  description: string;
  target_url: string;
  wcag_criteria: string;
  lawsuit_risk_score: number;
  attribution_app: string | null;
  dom_selector: string | null;
  fix_instruction: string | null;
  created_at: string;
  wcag_tags: string[];
  node_html_snippets: Array<Record<string, string>>;
  node_selectors: string[];
  help_url: string | null;
  failure_summary: string | null;
  is_incomplete: boolean;
  nodes_count: number;
  ai_fix_problem: string | null;
  ai_fix_user_impact: string | null;
  ai_fix_steps: string[] | null;
  ai_fix_html: string | null;
  ai_fix_effort_minutes: number | null;
  ai_fix_generated_at: string | null;
  ai_fix_model: string | null;
  ai_fix_status: AiFixStatus;
}

export interface ScanResultView {
  scan: ScanResultScanInfo;
  summary: ScanResultSummary;
  detected_stacks: DetectedStack[];
  issues: ScanResultIssue[];
  links: ScanResultLinks;
}

export type SarifDocument = Record<string, unknown>;

export interface WhiteCirclePolicy {
  id: string;
  name: string;
  flagged: boolean;
}

export interface WhiteCircleFlaggedPolicy {
  id: string;
  name: string;
  flagged_source: string[];
}

export interface WhiteCircleSafety {
  flagged: boolean;
  session_id: string;
  flagged_policies: WhiteCircleFlaggedPolicy[];
  all_policies: WhiteCirclePolicy[];
}

export interface AgentStatusResponse {
  agent_name: string;
  status: string;
  project: string;
  entity: string;
  total_runs: number;
  last_check: string;
  issues_found: number;
}

export interface RunIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  detail: string;
}

export interface ConfigSummary {
  base_model: string;
  lora_r: number;
  lr: number;
  epochs: number;
  kl_coef?: number;
}

export interface MetricsSummary {
  final_reward_mean?: number;
  final_f_score?: number;
  final_kl?: number;
  final_gradient_norm?: number;
}

export interface Run {
  name: string;
  id: string;
  state: string;
  status: "critical" | "warning" | "healthy";
  runtime_seconds: number;
  created_at: string;
  issues: RunIssue[];
  config_summary: ConfigSummary;
  metrics_summary: MetricsSummary;
  safety?: WhiteCircleSafety | null;
}

export interface DiagnosisResponse {
  run_name: string;
  diagnosis: string;
  heuristic_alerts: RunIssue[];
  status: "critical" | "warning" | "healthy";
  safety?: WhiteCircleSafety | null;
}

export interface ScientistResponse {
  run_name: string;
  diagnosis_summary: string;
  proposed_changes: string;
  rationale: string;
  verification_test: string;
}

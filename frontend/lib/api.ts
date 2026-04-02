import type {
  AgentStatusResponse,
  Run,
  DiagnosisResponse,
  ScientistResponse,
} from "@/types";

const API_BASE = "http://localhost:8000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getStatus(): Promise<AgentStatusResponse> {
  return fetchJSON<AgentStatusResponse>("/api/status");
}

export async function getRuns(): Promise<Run[]> {
  return fetchJSON<Run[]>("/api/runs");
}

export async function getDiagnosis(
  runName: string
): Promise<DiagnosisResponse> {
  return fetchJSON<DiagnosisResponse>(
    `/api/runs/${encodeURIComponent(runName)}/diagnosis`
  );
}

export async function getScientistRecommendation(
  runName: string
): Promise<ScientistResponse> {
  return fetchJSON<ScientistResponse>(
    `/api/runs/${encodeURIComponent(runName)}/scientist`
  );
}

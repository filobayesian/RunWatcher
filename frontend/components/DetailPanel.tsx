"use client";

import { useState } from "react";
import type { Run, DiagnosisResponse, ScientistResponse } from "@/types";
import { getDiagnosis, getScientistRecommendation } from "@/lib/api";
import CodeBlock from "./CodeBlock";

interface DetailPanelProps {
  run: Run | null;
}

function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m}m`;
}

function formatIssueType(type: string): string {
  return type.replace(/_/g, " ").toUpperCase();
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      <div
        className={`text-lg font-mono font-semibold ${color || "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
      </div>
    </div>
  );
}

function renderMarkdown(text: string) {
  // Very simple markdown rendering: handle bold, inline code, and line breaks
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={j}
            className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono text-blue-300 text-sm"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
    return (
      <p key={i} className={`${line === "" ? "h-3" : ""}`}>
        {parts}
      </p>
    );
  });
}

export default function DetailPanel({ run }: DetailPanelProps) {
  const [diagnosis, setDiagnosis] = useState<DiagnosisResponse | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState(false);

  const [scientist, setScientist] = useState<ScientistResponse | null>(null);
  const [scientistLoading, setScientistLoading] = useState(false);
  const [scientistError, setScientistError] = useState(false);

  const [lastRunName, setLastRunName] = useState<string | null>(null);

  // Reset state when run changes
  if (run && run.name !== lastRunName) {
    setLastRunName(run.name);
    setDiagnosis(null);
    setDiagnosisLoading(false);
    setDiagnosisError(false);
    setScientist(null);
    setScientistLoading(false);
    setScientistError(false);
  }

  const handleAnalyze = async () => {
    if (!run) return;
    setDiagnosisLoading(true);
    setDiagnosisError(false);
    try {
      const d = await getDiagnosis(run.name);
      setDiagnosis(d);
    } catch {
      setDiagnosisError(true);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const handleGetRecommendation = async () => {
    if (!run) return;
    setScientistLoading(true);
    setScientistError(false);
    try {
      const s = await getScientistRecommendation(run.name);
      setScientist(s);
    } catch {
      setScientistError(true);
    } finally {
      setScientistLoading(false);
    }
  };

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-zinc-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </div>
        <p className="text-zinc-500 text-sm">Select a run to view diagnosis</p>
        <p className="text-zinc-600 text-xs mt-1">
          Click on a run card from the list
        </p>
      </div>
    );
  }

  const wandbUrl = `https://wandb.ai/filobayesian-bocconi-university/gemma-lora-training/runs/${run.id}`;

  const statusColor =
    run.status === "critical"
      ? "text-red-400"
      : run.status === "warning"
        ? "text-amber-400"
        : "text-emerald-400";
  const statusBg =
    run.status === "critical"
      ? "bg-red-500/10 border-red-500/20"
      : run.status === "warning"
        ? "bg-amber-500/10 border-amber-500/20"
        : "bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 scrollbar-thin">
      {/* Section 1: Run Overview */}
      <section className="space-y-4 animate-in fade-in duration-300">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white font-mono">
              {run.name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${statusBg} ${statusColor}`}
              >
                {run.status}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {run.state} &middot; {formatRuntime(run.runtime_seconds)}
              </span>
            </div>
          </div>
          <a
            href={wandbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors shrink-0"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
            View on W&B
          </a>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCard
            label="Reward"
            value={run.metrics_summary.final_reward_mean != null ? run.metrics_summary.final_reward_mean.toFixed(3) : "N/A"}
            color={
              run.metrics_summary.final_reward_mean != null && run.metrics_summary.final_reward_mean > 0.7
                ? "text-emerald-400"
                : "text-zinc-300"
            }
          />
          <MetricCard
            label="Faithfulness"
            value={run.metrics_summary.final_f_score != null ? run.metrics_summary.final_f_score.toFixed(3) : "N/A"}
            color={
              run.metrics_summary.final_f_score == null
                ? "text-zinc-500"
                : run.metrics_summary.final_f_score < 0.6
                  ? "text-red-400"
                  : run.metrics_summary.final_f_score < 0.75
                    ? "text-amber-400"
                    : "text-emerald-400"
            }
          />
          <MetricCard
            label="KL Div"
            value={run.metrics_summary.final_kl != null ? run.metrics_summary.final_kl.toFixed(4) : "N/A"}
            color={
              run.metrics_summary.final_kl != null && run.metrics_summary.final_kl > 5
                ? "text-amber-400"
                : "text-zinc-300"
            }
          />
          <MetricCard
            label="Grad Norm"
            value={run.metrics_summary.final_gradient_norm != null ? run.metrics_summary.final_gradient_norm.toFixed(4) : "N/A"}
            color={
              run.metrics_summary.final_gradient_norm == null
                ? "text-zinc-500"
                : run.metrics_summary.final_gradient_norm === 0
                  ? "text-zinc-500"
                  : run.metrics_summary.final_gradient_norm > 10
                    ? "text-red-400"
                    : "text-zinc-300"
            }
          />
        </div>

        {/* Config */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.01]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Configuration
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-3 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">model</span>
              <span className="text-zinc-300 truncate ml-2 max-w-[200px]">
                {run.config_summary.base_model}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">lora_r</span>
              <span className="text-zinc-300">
                {run.config_summary.lora_r}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">lr</span>
              <span className="text-zinc-300">{run.config_summary.lr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">epochs</span>
              <span className="text-zinc-300">
                {run.config_summary.epochs}
              </span>
            </div>
            {run.config_summary.kl_coef !== undefined && (
              <div className="flex justify-between">
                <span className="text-zinc-500">kl_coef</span>
                <span className="text-zinc-300">
                  {run.config_summary.kl_coef}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Section 2: WhiteCircle Safety */}
      {run.safety != null && (
        <section className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
              run.safety.flagged
                ? "bg-orange-500/10 border-orange-500/20"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}>
              <svg
                className={`w-4 h-4 ${run.safety.flagged ? "text-orange-400" : "text-emerald-400"}`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide">
              WHITECIRCLE SAFETY
            </h3>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
              run.safety.flagged
                ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {run.safety.flagged ? "violation detected" : "all clear"}
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.01]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                Policy Checks — Run Summary
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {run.safety.all_policies.map((policy) => (
                <div key={policy.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-mono text-zinc-400">{policy.name}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    policy.flagged
                      ? "bg-orange-500/15 text-orange-400"
                      : "bg-emerald-500/10 text-emerald-500"
                  }`}>
                    {policy.flagged ? "flagged" : "pass"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnosis-level safety (shown after diagnosis is fetched) */}
          {diagnosis?.safety != null && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-white/[0.06] bg-white/[0.01]">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  Policy Checks — Agent Diagnosis
                </span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {diagnosis.safety.all_policies.map((policy) => (
                  <div key={policy.id} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-mono text-zinc-400">{policy.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      policy.flagged
                        ? "bg-orange-500/15 text-orange-400"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {policy.flagged ? "flagged" : "pass"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Section 3: Monitor Agent Diagnosis */}
      <section className="space-y-3 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide">
              MONITOR AGENT
            </h3>
          </div>
          {!diagnosis && !diagnosisLoading && (
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 hover:border-blue-500/30 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              Analyze
            </button>
          )}
        </div>

        {/* Quick alerts from run data */}
        {run.issues.length > 0 && !diagnosis && (
          <div className="flex flex-wrap gap-1.5">
            {run.issues.map((issue, idx) => (
              <span
                key={idx}
                className={`text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded ${
                  issue.severity === "critical"
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                }`}
              >
                {formatIssueType(issue.type)}
              </span>
            ))}
          </div>
        )}

        {diagnosisLoading && <Spinner />}

        {diagnosisError && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">
            Failed to load diagnosis. Please try again.
          </div>
        )}

        {diagnosis && (
          <div className="space-y-3 animate-in fade-in duration-500">
            {/* Status + alerts */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
                  diagnosis.status === "critical"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : diagnosis.status === "warning"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
              >
                {diagnosis.status}
              </span>
              {diagnosis.heuristic_alerts.map((alert, idx) => (
                <span
                  key={idx}
                  className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                    alert.severity === "critical"
                      ? "bg-red-500/15 text-red-400 border border-red-500/20"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {formatIssueType(alert.type)}
                </span>
              ))}
            </div>

            {/* Diagnosis text */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 text-sm text-zinc-300 leading-relaxed space-y-1">
              {renderMarkdown(diagnosis.diagnosis)}
            </div>
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.04]" />

      {/* Section 4: Scientist Agent */}
      <section className="space-y-3 animate-in fade-in duration-300 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide">
              SCIENTIST AGENT
            </h3>
          </div>
          {!scientist && !scientistLoading && (
            <button
              onClick={handleGetRecommendation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 hover:border-purple-500/30 transition-all"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              Get Recommendation
            </button>
          )}
        </div>

        {scientistLoading && <Spinner />}

        {scientistError && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 text-sm text-red-400">
            Failed to load recommendation. Please try again.
          </div>
        )}

        {scientist && (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* Summary */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 text-sm text-zinc-300 leading-relaxed">
              {renderMarkdown(scientist.diagnosis_summary)}
            </div>

            {/* Proposed Changes */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Proposed Changes
              </h4>
              <CodeBlock
                code={scientist.proposed_changes}
                language="yaml"
                title="Config Diff"
              />
            </div>

            {/* Rationale */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Rationale
              </h4>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 text-sm text-zinc-300 leading-relaxed">
                {renderMarkdown(scientist.rationale)}
              </div>
            </div>

            {/* Verification Test */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Verification Test
              </h4>
              <CodeBlock
                code={scientist.verification_test}
                language="python"
                title="Test"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

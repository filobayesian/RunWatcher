"use client";

import type { Run } from "@/types";
import RunCard from "./RunCard";

interface RunListProps {
  runs: Run[];
  selectedRun: Run | null;
  onSelectRun: (run: Run) => void;
  loading: boolean;
  error: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  healthy: 2,
};

export default function RunList({
  runs,
  selectedRun,
  onSelectRun,
  loading,
  error,
}: RunListProps) {
  const sortedRuns = [...runs].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.status] ?? 3) - (SEVERITY_ORDER[b.status] ?? 3)
  );

  const criticalCount = runs.filter((r) => r.status === "critical").length;
  const warningCount = runs.filter((r) => r.status === "warning").length;
  const healthyCount = runs.filter((r) => r.status === "healthy").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            EXPERIMENT RUNS
          </h2>
          <span className="text-xs font-mono text-zinc-500">
            {runs.length} total
          </span>
        </div>
        {runs.length > 0 && (
          <div className="flex items-center gap-3 mt-2">
            {criticalCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-mono text-red-400">
                  {criticalCount}
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[11px] font-mono text-amber-400">
                  {warningCount}
                </span>
              </div>
            )}
            {healthyCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-mono text-emerald-400">
                  {healthyCount}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-white/[0.03] border border-white/[0.04] p-3 space-y-2"
            >
              <div className="h-3.5 w-3/4 bg-white/[0.06] rounded" />
              <div className="flex gap-2">
                <div className="h-3 w-16 bg-white/[0.04] rounded" />
                <div className="h-3 w-12 bg-white/[0.04] rounded" />
              </div>
            </div>
          ))
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-10 h-10 text-zinc-700 mb-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm text-zinc-500">Failed to load runs</p>
            <p className="text-xs text-zinc-600 mt-1">
              Is the backend running on :8000?
            </p>
          </div>
        ) : sortedRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-zinc-500">No runs found</p>
          </div>
        ) : (
          sortedRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              selected={selectedRun?.id === run.id}
              onClick={() => onSelectRun(run)}
            />
          ))
        )}
      </div>
    </div>
  );
}

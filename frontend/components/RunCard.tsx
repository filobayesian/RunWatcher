"use client";

import type { Run } from "@/types";

interface RunCardProps {
  run: Run;
  selected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  critical: {
    bg: "bg-red-500/5",
    border: "border-red-500/30",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
  healthy: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
};

const STATE_STYLES: Record<string, string> = {
  finished: "bg-zinc-700/50 text-zinc-300",
  failed: "bg-red-900/40 text-red-300",
  crashed: "bg-red-900/60 text-red-200",
  killed: "bg-amber-900/40 text-amber-300",
  running: "bg-blue-900/40 text-blue-300",
};

function formatRuntime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function getShortName(name: string): string {
  const parts = name.split("-");
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return name;
}

function formatIssueType(type: string): string {
  return type.replace(/_/g, " ").toUpperCase();
}

export default function RunCard({ run, selected, onClick }: RunCardProps) {
  const colors = STATUS_COLORS[run.status] || STATUS_COLORS.healthy;
  const stateStyle = STATE_STYLES[run.state] || STATE_STYLES.finished;

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-lg border transition-all duration-200 overflow-hidden
        ${selected
          ? `${colors.bg} ${colors.border} ring-1 ring-${run.status === "critical" ? "red" : run.status === "warning" ? "amber" : "emerald"}-500/20`
          : "bg-[#12121a] border-white/[0.06] hover:border-white/[0.12] hover:bg-[#16161f]"
        }
      `}
    >
      {/* Left severity bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${colors.dot} ${
          selected ? "opacity-100" : "opacity-40 group-hover:opacity-70"
        } transition-opacity`}
      />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Run name */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-white/90 truncate">
                {run.name.length > 30
                  ? `...${run.name.slice(-24)}`
                  : run.name}
              </span>
            </div>

            {/* ID suffix badge */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500">
                {getShortName(run.name)}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${stateStyle}`}
              >
                {run.state}
              </span>
              <span className="font-mono text-[11px] text-zinc-600">
                {formatRuntime(run.runtime_seconds)}
              </span>
            </div>
          </div>

          {/* Issue count */}
          {run.issues.length > 0 && (
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <span
                className={`font-mono text-xs font-bold ${
                  run.status === "critical"
                    ? "text-red-400"
                    : "text-amber-400"
                }`}
              >
                {run.issues.length}
              </span>
              <svg
                className={`w-3.5 h-3.5 ${
                  run.status === "critical"
                    ? "text-red-500/60"
                    : "text-amber-500/60"
                }`}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Issue tags */}
        {run.issues.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {run.issues.slice(0, 2).map((issue, idx) => (
              <span
                key={idx}
                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  issue.severity === "critical"
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                }`}
              >
                {formatIssueType(issue.type)}
              </span>
            ))}
            {run.issues.length > 2 && (
              <span className="text-[10px] text-zinc-600">
                +{run.issues.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

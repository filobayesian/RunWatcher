"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/types";
import { getRuns } from "@/lib/api";
import AgentStatus from "@/components/AgentStatus";
import RunList from "@/components/RunList";
import DetailPanel from "@/components/DetailPanel";

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getRuns()
      .then((data) => {
        setRuns(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Build activity feed from run issues
  const activityItems = runs
    .flatMap((run) =>
      run.issues.map((issue) => ({
        time: run.created_at,
        message: `${issue.type.replace(/_/g, " ")} detected in run ${run.name.split("-").pop()}`,
        severity: issue.severity,
        runName: run.name,
      }))
    )
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 20);

  const formatActivityTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "--:--";
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top Bar */}
      <AgentStatus />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Run List */}
        <div className="w-[40%] min-w-[340px] max-w-[500px] border-r border-white/[0.06] bg-[#0c0c14]/50">
          <RunList
            runs={runs}
            selectedRun={selectedRun}
            onSelectRun={setSelectedRun}
            loading={loading}
            error={error}
          />
        </div>

        {/* Right Column: Detail Panel */}
        <div className="flex-1 bg-[#0a0a0f]">
          <DetailPanel run={selectedRun} />
        </div>
      </div>

      {/* Bottom: Activity Feed */}
      {activityItems.length > 0 && (
        <div className="border-t border-white/[0.06] bg-[#0c0c14]/80 backdrop-blur-sm">
          <div className="px-4 py-2 overflow-x-auto scrollbar-thin">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <svg
                  className="w-3.5 h-3.5 text-zinc-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                  />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Activity
                </span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto">
                {activityItems.slice(0, 8).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const run = runs.find((r) => r.name === item.runName);
                      if (run) setSelectedRun(run);
                    }}
                    className="flex items-center gap-2 shrink-0 px-2 py-1 rounded hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[11px] font-mono text-zinc-600">
                      {formatActivityTime(item.time)}
                    </span>
                    <span className="text-[11px] text-zinc-500">—</span>
                    <span
                      className={`text-[11px] capitalize ${
                        item.severity === "critical"
                          ? "text-red-400/80"
                          : item.severity === "warning"
                            ? "text-amber-400/80"
                            : "text-zinc-400"
                      }`}
                    >
                      {item.message}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { AgentStatusResponse } from "@/types";
import { getStatus } from "@/lib/api";

export default function AgentStatus() {
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch(() => setError(true));

    const interval = setInterval(() => {
      getStatus()
        .then((s) => {
          setStatus(s);
          setError(false);
        })
        .catch(() => setError(true));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-[#0c0c14]/80 backdrop-blur-md sticky top-0 z-50">
      {/* Left: Logo */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-8 h-8">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-6 h-6 text-blue-500"
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
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-ping opacity-50" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-white">
          RunWatcher
        </h1>
      </div>

      {/* Center: Status */}
      <div className="flex items-center gap-3">
        {error ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-red-400 font-medium">
              Backend not connected
            </span>
          </div>
        ) : status ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-emerald-400" />
            </div>
            <span className="text-sm text-emerald-300 font-medium font-mono">
              Monitoring {status.total_runs} runs in{" "}
              <span className="text-white">{status.project}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
            <span className="text-sm text-zinc-500">Connecting...</span>
          </div>
        )}
      </div>

      {/* Right: Last check + issues */}
      <div className="flex items-center gap-4 text-sm">
        {status && status.issues_found > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <svg
              className="w-3.5 h-3.5 text-amber-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-amber-400 font-mono font-medium">
              {status.issues_found} issues
            </span>
          </div>
        )}
        {status?.last_check && (
          <span className="text-zinc-500 font-mono text-xs">
            Last check: {formatTime(status.last_check)}
          </span>
        )}
      </div>
    </header>
  );
}

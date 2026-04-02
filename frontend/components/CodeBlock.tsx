"use client";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export default function CodeBlock({ code, language, title }: CodeBlockProps) {
  // Clean markdown fences if present
  let cleanCode = code;
  const fenceMatch = cleanCode.match(/^```[\w]*\n?([\s\S]*?)```$/);
  if (fenceMatch) {
    cleanCode = fenceMatch[1];
  }
  cleanCode = cleanCode.trim();

  // Detect if it looks like a diff
  const isDiff =
    cleanCode.includes("# Before") ||
    cleanCode.includes("# After") ||
    cleanCode.split("\n").some((l) => l.startsWith("+") || l.startsWith("-"));

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden bg-[#0a0a12]">
      {(title || language) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            {title || language}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(cleanCode)}
            className="text-[11px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Copy
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono">
          {cleanCode.split("\n").map((line, i) => {
            let lineClass = "text-zinc-300";
            if (isDiff) {
              if (line.startsWith("# Before") || line.startsWith("# After")) {
                lineClass = "text-blue-400 font-semibold";
              } else if (line.startsWith("+")) {
                lineClass = "text-emerald-400 bg-emerald-500/5";
              } else if (line.startsWith("-")) {
                lineClass = "text-red-400 bg-red-500/5";
              } else if (line.startsWith("#")) {
                lineClass = "text-zinc-500";
              }
            }
            return (
              <div key={i} className={`${lineClass} px-1 -mx-1`}>
                {line || "\u00A0"}
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

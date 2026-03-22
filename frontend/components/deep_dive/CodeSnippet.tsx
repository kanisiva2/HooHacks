"use client";

import type { DeepDiveResult } from "@/types/api";
import { Badge } from "@/components/ui/badge";

type CodeSnippetProps = {
  result: DeepDiveResult;
  fileContent?: string;
};

export function CodeSnippet({ result, fileContent }: CodeSnippetProps) {
  const start = result.suspect_lines_start ?? 1;
  const end = result.suspect_lines_end ?? Math.min(start + 14, start + 20);
  const snippetLines = (fileContent ?? "")
    .split("\n")
    .slice(Math.max(0, start - 1), Math.max(start, end));

  return (
    <div className="space-y-3 rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-900">{result.suspect_file}</p>
        <Badge variant="secondary">{Math.round(result.confidence * 100)}%</Badge>
      </div>

      {snippetLines.length > 0 ? (
        <div className="max-h-44 overflow-auto rounded-xl border border-slate-200/70 bg-slate-950 p-3 font-mono text-xs text-slate-100">
          {snippetLines.map((line, idx) => {
            const lineNo = start + idx;
            const isSuspect =
              result.suspect_lines_start !== null &&
              result.suspect_lines_end !== null &&
              lineNo >= result.suspect_lines_start &&
              lineNo <= result.suspect_lines_end;
            return (
              <div key={`${lineNo}-${idx}`} className={isSuspect ? "bg-red-500/10" : ""}>
                <span className="mr-2 text-slate-500">{lineNo}:</span>
                {line || " "}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No file snippet available yet.</p>
      )}

      <p className="text-xs text-slate-500">
        Use desktop for full code analysis and complete context.
      </p>
    </div>
  );
}

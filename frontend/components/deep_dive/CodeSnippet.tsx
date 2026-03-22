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
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium">{result.suspect_file}</p>
        <Badge variant="secondary">{Math.round(result.confidence * 100)}%</Badge>
      </div>

      {snippetLines.length > 0 ? (
        <div className="max-h-44 overflow-auto rounded-md border bg-muted/20 p-2 font-mono text-xs">
          {snippetLines.map((line, idx) => {
            const lineNo = start + idx;
            const isSuspect =
              result.suspect_lines_start !== null &&
              result.suspect_lines_end !== null &&
              lineNo >= result.suspect_lines_start &&
              lineNo <= result.suspect_lines_end;
            return (
              <div key={`${lineNo}-${idx}`} className={isSuspect ? "bg-red-500/10" : ""}>
                <span className="mr-2 text-muted-foreground">{lineNo}:</span>
                {line || " "}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No file snippet available yet.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Use desktop for full code analysis and complete context.
      </p>
    </div>
  );
}


"use client";

import type { DeepDiveResult } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SuspectFileListProps = {
  results: DeepDiveResult[];
  selectedResultId?: string;
  onSelectResult: (resultId: string) => void;
};

function confidenceInfo(confidence: number) {
  const percentage = Math.round(confidence * 100);
  if (percentage > 80) {
    return { percentage, className: "bg-red-100 text-red-700" };
  }
  if (percentage > 50) {
    return { percentage, className: "bg-amber-100 text-amber-700" };
  }
  return { percentage, className: "bg-yellow-100 text-yellow-700" };
}

export function SuspectFileList({
  results,
  selectedResultId,
  onSelectResult,
}: SuspectFileListProps) {
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No deep dive results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No deep dive results yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((result) => {
        const info = confidenceInfo(result.confidence);
        const lines =
          result.suspect_lines_start !== null && result.suspect_lines_end !== null
            ? `${result.suspect_lines_start}-${result.suspect_lines_end}`
            : "unknown";

        return (
          <button
            type="button"
            key={result.id}
            onClick={() => onSelectResult(result.id)}
            className={cn(
              "w-full rounded-lg border bg-card text-left transition hover:bg-muted/40",
              selectedResultId === result.id ? "ring-2 ring-primary/40" : "",
            )}
          >
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{result.suspect_file}</p>
                <Badge variant="outline">#{result.rank}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={info.className} variant="secondary">
                  {info.percentage}%
                </Badge>
                <span className="text-xs text-muted-foreground">Lines {lines}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}


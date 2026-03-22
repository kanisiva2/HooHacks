"use client";

import type { DeepDiveResult } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SuspectFileListProps = {
  results: DeepDiveResult[];
  selectedResultId?: string;
  onSelectResult: (resultId: string) => void;
  isLoading?: boolean;
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
  isLoading,
}: SuspectFileListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SuspectRowSkeleton />
        <SuspectRowSkeleton />
        <SuspectRowSkeleton />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="rounded-2xl border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Deep dive not started</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Deep dive not started. Trigger analysis or wait for automatic investigation.
          </p>
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
              "w-full rounded-2xl border border-white/70 bg-white/72 text-left backdrop-blur-sm transition-all duration-150 hover:bg-white hover:shadow-md",
              selectedResultId === result.id
                ? "border-slate-950/10 ring-2 ring-slate-950/10 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                : "",
            )}
          >
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{result.suspect_file}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    Suspect #{result.rank}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 text-slate-600">
                  #{result.rank}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={info.className} variant="secondary">
                  {info.percentage}%
                </Badge>
                <span className="text-xs text-slate-500">Lines {lines}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SuspectRowSkeleton() {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

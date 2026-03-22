"use client";

import type { DeepDiveResult } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type EvidenceCardProps = {
  result?: DeepDiveResult;
  defaultRepo?: string | null;
  isLoading?: boolean;
};

function confidenceClass(confidence: number) {
  const value = Math.round(confidence * 100);
  if (value > 80) return "bg-red-100 text-red-700";
  if (value > 50) return "bg-amber-100 text-amber-700";
  return "bg-yellow-100 text-yellow-700";
}

function extractString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export function EvidenceCard({ result, defaultRepo, isLoading }: EvidenceCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Select a suspect file to view evidence and commit context.
          </p>
        </CardContent>
      </Card>
    );
  }

  const confidence = Math.round(result.confidence * 100);
  const evidence = result.evidence_json;
  const reasoning =
    extractString(evidence, ["reasoning", "reason", "evidence", "explanation"]) ??
    "No reasoning provided.";
  const commitSha = extractString(evidence, ["commit_sha", "commitSha"]);
  const commitMessage = extractString(evidence, ["commit_message", "commitMessage"]);
  const commitHref =
    defaultRepo && commitSha ? `https://github.com/${defaultRepo}/commit/${commitSha}` : null;

  return (
    <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base text-slate-950">Evidence</CardTitle>
        <Badge className={confidenceClass(result.confidence)} variant="secondary">
          {confidence}%
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-7 text-slate-600">{reasoning}</p>
        {commitSha ? (
          <div className="space-y-1 rounded-xl border border-slate-200/70 bg-white/70 p-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Commit</p>
            {commitHref ? (
              <a
                href={commitHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-900 hover:text-slate-950 hover:underline"
              >
                {commitSha}
              </a>
            ) : (
              <p className="text-sm font-medium text-slate-900">{commitSha}</p>
            )}
            {commitMessage ? <p className="text-sm text-slate-500">{commitMessage}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

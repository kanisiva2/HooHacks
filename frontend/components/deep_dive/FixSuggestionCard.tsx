"use client";

import { useState } from "react";
import type { DeepDiveResult, FixSuggestion } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApplyFixSuggestion,
  useGenerateFixSuggestion,
} from "@/hooks/useDeepDive";

type FixSuggestionCardProps = {
  incidentId: string;
  result?: DeepDiveResult | null;
  isLoading?: boolean;
};

function canGenerateSuggestion(result?: DeepDiveResult | null) {
  return Boolean(
    result &&
      result.suspect_lines_start &&
      result.suspect_lines_end &&
      result.suspect_lines_start > 0 &&
      result.suspect_lines_end >= result.suspect_lines_start,
  );
}

export function FixSuggestionCard({
  incidentId,
  result,
  isLoading,
}: FixSuggestionCardProps) {
  const generateMutation = useGenerateFixSuggestion(incidentId, result?.id);
  const applyMutation = useApplyFixSuggestion(incidentId, result?.id);
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [replacementCode, setReplacementCode] = useState("");
  const [lastApplyResponse, setLastApplyResponse] = useState<{
    branch_name: string;
    commit_sha: string | null;
    pull_request_url: string | null;
    pull_request_number: number | null;
  } | null>(null);

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Fix Suggestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Fix Suggestion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Select a suspect file to generate a suggested code change.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canGenerateSuggestion(result)) {
    return (
      <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Fix Suggestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            This result does not include a precise line range yet, so Sprynt cannot
            propose a targeted replacement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isApplyingBranch = applyMutation.isPending && applyMutation.variables?.open_pr !== true;
  const isApplyingPr = applyMutation.isPending && applyMutation.variables?.open_pr === true;

  const handleGenerate = async () => {
    const data = await generateMutation.mutateAsync();
    setSuggestion(data);
    setReplacementCode(data.replacement_code);
    setLastApplyResponse(null);
  };

  const handleApply = async (openPr: boolean) => {
    if (!suggestion) {
      return;
    }
    const response = await applyMutation.mutateAsync({
      replacement_code: replacementCode,
      summary: suggestion.summary,
      rationale: suggestion.rationale,
      risk_notes: suggestion.risk_notes,
      file_sha: suggestion.file_sha,
      open_pr: openPr,
    });
    setLastApplyResponse(response);
  };

  return (
    <Card className="rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base text-slate-950">Fix Suggestion</CardTitle>
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="rounded-2xl border-slate-200 bg-white/85 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
        >
          {generateMutation.isPending ? "Generating..." : suggestion ? "Regenerate" : "Generate Fix Suggestion"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!suggestion ? (
          <p className="text-sm text-slate-500">
            Generate a localized patch for the highlighted suspect lines, then review
            the diff before creating a branch or pull request in GitHub.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Summary</p>
              <p className="text-sm font-medium text-slate-900">{suggestion.summary}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Rationale</p>
              <p className="text-sm text-slate-600">{suggestion.rationale}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Risk Notes</p>
              <p className="text-sm text-slate-600">{suggestion.risk_notes}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Suggested Replacement
              </p>
              <textarea
                value={replacementCode}
                onChange={(event) => setReplacementCode(event.target.value)}
                className="min-h-40 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs outline-none focus:border-ring"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Unified Diff</p>
              {replacementCode !== suggestion.replacement_code ? (
                <p className="text-xs text-slate-500">
                  Regenerate to refresh the diff after editing the replacement code.
                </p>
              ) : null}
              <pre className="max-h-96 overflow-auto rounded-xl border border-slate-200/70 bg-slate-950 p-3 font-mono text-xs whitespace-pre-wrap text-slate-100">
                {suggestion.diff}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => handleApply(false)}
                disabled={applyMutation.isPending || replacementCode.trim().length === 0}
                className="rounded-2xl bg-slate-950 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
              >
                {isApplyingBranch ? "Creating Branch..." : "Apply to Branch"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApply(true)}
                disabled={applyMutation.isPending || replacementCode.trim().length === 0}
                className="rounded-2xl border-slate-200 bg-white/85 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              >
                {isApplyingPr ? "Opening PR..." : "Apply and Open PR"}
              </Button>
            </div>

            {lastApplyResponse ? (
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm">
                <p>
                  Created branch <span className="font-mono">{lastApplyResponse.branch_name}</span>
                  {lastApplyResponse.commit_sha ? (
                    <>
                      {" "}
                      with commit{" "}
                      <span className="font-mono">{lastApplyResponse.commit_sha.slice(0, 8)}</span>.
                    </>
                  ) : (
                    "."
                  )}
                </p>
                {lastApplyResponse.pull_request_url ? (
                  <a
                    href={lastApplyResponse.pull_request_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-medium text-slate-900 hover:text-slate-950 hover:underline"
                  >
                    Open pull request #{lastApplyResponse.pull_request_number}
                  </a>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
      <Card>
        <CardHeader>
          <CardTitle>Fix Suggestion</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>Fix Suggestion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a suspect file to generate a suggested code change.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canGenerateSuggestion(result)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fix Suggestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Fix Suggestion</CardTitle>
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? "Generating..." : suggestion ? "Regenerate" : "Generate Fix Suggestion"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!suggestion ? (
          <p className="text-sm text-muted-foreground">
            Generate a localized patch for the highlighted suspect lines, then review
            the diff before creating a branch or pull request in GitHub.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
              <p className="text-sm">{suggestion.summary}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Rationale</p>
              <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk Notes</p>
              <p className="text-sm text-muted-foreground">{suggestion.risk_notes}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Suggested Replacement
              </p>
              <textarea
                value={replacementCode}
                onChange={(event) => setReplacementCode(event.target.value)}
                className="min-h-40 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus:border-ring"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Unified Diff</p>
              {replacementCode !== suggestion.replacement_code ? (
                <p className="text-xs text-muted-foreground">
                  Regenerate to refresh the diff after editing the replacement code.
                </p>
              ) : null}
              <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
                {suggestion.diff}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => handleApply(false)}
                disabled={applyMutation.isPending || replacementCode.trim().length === 0}
              >
                {isApplyingBranch ? "Creating Branch..." : "Apply to Branch"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApply(true)}
                disabled={applyMutation.isPending || replacementCode.trim().length === 0}
              >
                {isApplyingPr ? "Opening PR..." : "Apply and Open PR"}
              </Button>
            </div>

            {lastApplyResponse ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
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
                    className="mt-2 inline-block text-blue-600 hover:underline"
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

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { DeepDiveResult, FixSuggestion } from "@/types/api";
import { useApplyFixSuggestion, useGenerateFixSuggestion } from "@/hooks/useDeepDive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CodePanel } from "@/components/deep_dive/CodePanel";

const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false },
);

type FixReviewWorkspaceProps = {
  incidentId: string;
  result?: DeepDiveResult | null;
  fileContent?: string;
  isLoading?: boolean;
  onReviewModeChange?: (active: boolean) => void;
};

function languageFromPath(path?: string) {
  if (!path) return "plaintext";
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "java":
      return "java";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "sh":
      return "shell";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
}

function canGenerateSuggestion(result?: DeepDiveResult | null) {
  return Boolean(
    result &&
      result.suspect_lines_start &&
      result.suspect_lines_end &&
      result.suspect_lines_start > 0 &&
      result.suspect_lines_end >= result.suspect_lines_start,
  );
}

export function FixReviewWorkspace({
  incidentId,
  result,
  fileContent,
  isLoading,
  onReviewModeChange,
}: FixReviewWorkspaceProps) {
  const generateMutation = useGenerateFixSuggestion(incidentId, result?.id);
  const applyMutation = useApplyFixSuggestion(incidentId, result?.id);
  const [suggestion, setSuggestion] = useState<FixSuggestion | null>(null);
  const [lastApplyResponse, setLastApplyResponse] = useState<{
    branch_name: string;
    commit_sha: string | null;
    pull_request_url: string | null;
    pull_request_number: number | null;
  } | null>(null);

  const isApplyingBranch = applyMutation.isPending && applyMutation.variables?.open_pr !== true;
  const isApplyingPr = applyMutation.isPending && applyMutation.variables?.open_pr === true;

  const handleGenerate = async () => {
    const data = await generateMutation.mutateAsync();
    setSuggestion(data);
    setLastApplyResponse(null);
    onReviewModeChange?.(true);
  };

  const handleApply = async (openPr: boolean) => {
    if (!suggestion) {
      return;
    }
    const response = await applyMutation.mutateAsync({
      replacement_code: suggestion.replacement_code,
      summary: suggestion.summary,
      rationale: suggestion.rationale,
      risk_notes: suggestion.risk_notes,
      file_sha: suggestion.file_sha,
      open_pr: openPr,
    });
    setLastApplyResponse(response);
  };

  const handleCloseReview = () => {
    setSuggestion(null);
    setLastApplyResponse(null);
    onReviewModeChange?.(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>{suggestion ? "Fix Review" : "Code Panel"}</CardTitle>
        <div className="flex flex-wrap justify-end gap-2">
          {suggestion ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseReview}
                disabled={generateMutation.isPending || applyMutation.isPending}
              >
                Close Review
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || applyMutation.isPending}
              >
                {generateMutation.isPending ? "Generating..." : "Regenerate"}
              </Button>
              <Button
                type="button"
                onClick={() => handleApply(false)}
                disabled={applyMutation.isPending}
              >
                {isApplyingBranch ? "Creating Branch..." : "Apply to Branch"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApply(true)}
                disabled={applyMutation.isPending}
              >
                {isApplyingPr ? "Opening PR..." : "Open PR"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              disabled={
                generateMutation.isPending ||
                !result ||
                !fileContent ||
                !canGenerateSuggestion(result)
              }
            >
              {generateMutation.isPending ? "Generating..." : "Generate Fix"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-[560px] w-full" />
          </div>
        ) : suggestion ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="overflow-hidden border-border/80 bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b">
                <div>
                  <CardTitle>Fix Review</CardTitle>
                  <p className="text-sm text-muted-foreground">{result?.suspect_file}</p>
                </div>
                <Badge variant="secondary">
                  {result?.suspect_lines_start}-{result?.suspect_lines_end}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[calc(100vh-240px)] min-h-[620px] overflow-hidden">
                  <MonacoDiffEditor
                    height="100%"
                    language={languageFromPath(result?.suspect_file)}
                    theme="vs-dark"
                    original={fileContent ?? ""}
                    modified={suggestion.updated_code}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      renderSideBySide: true,
                      automaticLayout: true,
                      lineNumbers: "on",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Why This Change</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-base font-medium">{suggestion.summary}</p>
                  <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{suggestion.risk_notes}</p>
                  {lastApplyResponse ? (
                    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                      <p>
                        Created{" "}
                        <span className="font-mono">{lastApplyResponse.branch_name}</span>
                        {lastApplyResponse.commit_sha ? (
                          <>
                            {" "}
                            with commit{" "}
                            <span className="font-mono">
                              {lastApplyResponse.commit_sha.slice(0, 8)}
                            </span>.
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
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <>
            <div className="h-[400px] md:h-[560px] lg:h-[calc(100vh-300px)]">
              <CodePanel
                filePath={result?.suspect_file}
                fileContent={fileContent}
                lineStart={result?.suspect_lines_start}
                lineEnd={result?.suspect_lines_end}
                isLoading={false}
              />
            </div>
            {!result ? (
              <p className="text-sm text-muted-foreground">
                Select a suspect file to inspect full source.
              </p>
            ) : !canGenerateSuggestion(result) ? (
              <p className="text-sm text-muted-foreground">
                This result needs a valid suspect line range before Sprynt can generate a fix.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate a fix to expand this panel into a side-by-side review workspace.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FileSearch, Sparkles } from "lucide-react";
import { CodeSnippet } from "@/components/deep_dive/CodeSnippet";
import { EvidenceCard } from "@/components/deep_dive/EvidenceCard";
import { FixSuggestionCard } from "@/components/deep_dive/FixSuggestionCard";
import { FixReviewWorkspace } from "@/components/deep_dive/FixReviewWorkspace";
import { SuspectFileList } from "@/components/deep_dive/SuspectFileList";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeepDiveFileContent,
  useDeepDiveResults,
  useTriggerDeepDive,
} from "@/hooks/useDeepDive";
import { useWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";

export default function DeepDivePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;

  const [selectedResultId, setSelectedResultId] = useState<string | undefined>();
  const [isReviewMode, setIsReviewMode] = useState(false);
  const resultsQuery = useDeepDiveResults(incidentId);
  const triggerMutation = useTriggerDeepDive();
  const defaults = useWorkspaceDefaults();
  const effectiveSelectedResultId = selectedResultId ?? resultsQuery.data?.[0]?.id;
  const fileQuery = useDeepDiveFileContent(incidentId, effectiveSelectedResultId);

  const results = useMemo(
    () => [...(resultsQuery.data ?? [])].sort((a, b) => a.rank - b.rank),
    [resultsQuery.data],
  );
  const selectedResult = useMemo(
    () => results.find((result) => result.id === effectiveSelectedResultId) ?? null,
    [results, effectiveSelectedResultId],
  );

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">
                    Deep Dive Results
                  </h1>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Inspect ranked suspect files, review evidence, and turn findings into safe code changes.
                </p>
              </div>
              <Button
                onClick={() => triggerMutation.mutate(incidentId)}
                disabled={triggerMutation.isPending}
                size="lg"
                className="rounded-2xl bg-slate-950 px-5 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
              >
                {triggerMutation.isPending ? "Triggering..." : "Re-run Deep Dive"}
              </Button>
            </div>

            <div className="mb-6 flex items-center gap-2 rounded-xl border border-sky-200/80 bg-white/72 px-4 py-3 text-sm text-slate-600 backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                {isReviewMode ? <Sparkles className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
              </div>
              <span>
                {isReviewMode
                  ? "Fix review mode is open. Compare the generated patch and push it safely to GitHub."
                  : "Deep Dive ranks likely suspect files from your incident context and recent repository activity."}
              </span>
            </div>

            <div
              className={`hidden gap-4 lg:grid ${
                isReviewMode ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_1.2fr]"
              }`}
            >
              {!isReviewMode ? (
                <div className="space-y-3">
                  <SuspectFileList
                    results={results}
                    selectedResultId={effectiveSelectedResultId}
                    onSelectResult={setSelectedResultId}
                    isLoading={resultsQuery.isLoading}
                  />
                </div>
              ) : null}

              <PanelErrorBoundary panelName="Code panel">
                <FixReviewWorkspace
                  key={selectedResult?.id ?? "empty-desktop"}
                  incidentId={incidentId}
                  result={selectedResult}
                  fileContent={fileQuery.data}
                  isLoading={fileQuery.isLoading}
                  onReviewModeChange={setIsReviewMode}
                />
              </PanelErrorBoundary>
            </div>

            {!isReviewMode ? (
              <div className="mt-4 hidden lg:block">
                <PanelErrorBoundary panelName="Evidence panel">
                  <EvidenceCard
                    result={selectedResult ?? undefined}
                    defaultRepo={defaults.data?.default_repo}
                    isLoading={resultsQuery.isLoading}
                  />
                </PanelErrorBoundary>
              </div>
            ) : null}

            <div className="lg:hidden">
              <Tabs defaultValue="suspects">
                <TabsList className="mb-3">
                  <TabsTrigger value="suspects">Suspects</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="fix">Fix</TabsTrigger>
                </TabsList>
                <TabsContent value="suspects">
                  <PanelErrorBoundary panelName="Suspect file list">
                    <SuspectFileList
                      results={results}
                      selectedResultId={effectiveSelectedResultId}
                      onSelectResult={setSelectedResultId}
                      isLoading={resultsQuery.isLoading}
                    />
                  </PanelErrorBoundary>
                </TabsContent>
                <TabsContent value="code">
                  <PanelErrorBoundary panelName="Code snippet">
                    {selectedResult ? (
                      <CodeSnippet result={selectedResult} fileContent={fileQuery.data} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a suspect file first.</p>
                    )}
                  </PanelErrorBoundary>
                </TabsContent>
                <TabsContent value="evidence">
                  <PanelErrorBoundary panelName="Evidence panel">
                    <EvidenceCard
                      result={selectedResult ?? undefined}
                      defaultRepo={defaults.data?.default_repo}
                      isLoading={resultsQuery.isLoading}
                    />
                  </PanelErrorBoundary>
                </TabsContent>
                <TabsContent value="fix">
                  <PanelErrorBoundary panelName="Fix suggestion panel">
                    <FixSuggestionCard
                      key={selectedResult?.id ?? "empty-mobile"}
                      incidentId={incidentId}
                      result={selectedResult}
                      isLoading={resultsQuery.isLoading}
                    />
                  </PanelErrorBoundary>
                </TabsContent>
              </Tabs>
            </div>
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-4 pb-20 md:p-6 md:pb-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold">Deep Dive Results</h1>
              <Button
                onClick={() => triggerMutation.mutate(incidentId)}
                disabled={triggerMutation.isPending}
              >
                {triggerMutation.isPending ? "Triggering..." : "Re-run Deep Dive"}
              </Button>
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

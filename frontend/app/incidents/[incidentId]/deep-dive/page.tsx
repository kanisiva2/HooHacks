"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CodePanel } from "@/components/deep_dive/CodePanel";
import { CodeSnippet } from "@/components/deep_dive/CodeSnippet";
import { EvidenceCard } from "@/components/deep_dive/EvidenceCard";
import { SuspectFileList } from "@/components/deep_dive/SuspectFileList";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

            <div className="hidden gap-4 lg:grid lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <SuspectFileList
                  results={results}
                  selectedResultId={effectiveSelectedResultId}
                  onSelectResult={setSelectedResultId}
                />
              </div>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Code Panel</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px] md:h-[560px] lg:h-[calc(100vh-300px)]">
                  <CodePanel
                    filePath={selectedResult?.suspect_file}
                    fileContent={fileQuery.data}
                    lineStart={selectedResult?.suspect_lines_start}
                    lineEnd={selectedResult?.suspect_lines_end}
                    isLoading={fileQuery.isLoading}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 hidden lg:block">
              <EvidenceCard result={selectedResult ?? undefined} defaultRepo={defaults.data?.default_repo} />
            </div>

            <div className="lg:hidden">
              <Tabs defaultValue="suspects">
                <TabsList className="mb-3">
                  <TabsTrigger value="suspects">Suspects</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                </TabsList>
                <TabsContent value="suspects">
                  <SuspectFileList
                    results={results}
                    selectedResultId={effectiveSelectedResultId}
                    onSelectResult={setSelectedResultId}
                  />
                </TabsContent>
                <TabsContent value="code">
                  {selectedResult ? (
                    <CodeSnippet result={selectedResult} fileContent={fileQuery.data} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a suspect file first.</p>
                  )}
                </TabsContent>
                <TabsContent value="evidence">
                  <EvidenceCard
                    result={selectedResult ?? undefined}
                    defaultRepo={defaults.data?.default_repo}
                  />
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

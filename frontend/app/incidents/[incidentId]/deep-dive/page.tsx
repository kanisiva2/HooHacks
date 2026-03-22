"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDeepDiveFileContent,
  useDeepDiveResults,
  useTriggerDeepDive,
} from "@/hooks/useDeepDive";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function DeepDivePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;

  const [selectedResultId, setSelectedResultId] = useState<string | undefined>();
  const resultsQuery = useDeepDiveResults(incidentId);
  const triggerMutation = useTriggerDeepDive();
  const fileContent = useDeepDiveFileContent(incidentId, selectedResultId);

  const results = useMemo(
    () => [...(resultsQuery.data ?? [])].sort((a, b) => a.rank - b.rank),
    [resultsQuery.data],
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

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                {results.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>No deep dive results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Trigger analysis to populate suspect files.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  results.map((result) => (
                    <Card
                      key={result.id}
                      className={selectedResultId === result.id ? "ring-2 ring-primary/40" : ""}
                    >
                      <CardHeader>
                        <CardTitle className="text-base">{result.suspect_file}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Badge variant="secondary">
                          Confidence {(result.confidence * 100).toFixed(0)}%
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Rank #{result.rank} • Lines {result.suspect_lines_start ?? "?"}-
                          {result.suspect_lines_end ?? "?"}
                        </p>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setSelectedResultId(result.id)}
                        >
                          View File
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Code Panel</CardTitle>
                </CardHeader>
                <CardContent className="h-[560px]">
                  {selectedResultId ? (
                    <MonacoEditor
                      height="100%"
                      language="typescript"
                      value={fileContent.data ?? "Loading file..."}
                      options={{ readOnly: true, minimap: { enabled: false } }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a suspect file to inspect full source.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}

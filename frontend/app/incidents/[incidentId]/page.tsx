"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBadge } from "@/components/incident/AgentStatusBadge";
import { TaskBoard } from "@/components/incident/TaskBoard";
import { TranscriptFeed } from "@/components/incident/TranscriptFeed";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeepDiveResults } from "@/hooks/useDeepDive";
import { useIncident, useIncidents } from "@/hooks/useIncident";
import { useIncidentSocket } from "@/hooks/useIncidentSocket";
import { useTasks } from "@/hooks/useTasks";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { api } from "@/lib/api";
import { severityToBadgeVariant } from "@/lib/utils";
import { useIncidentStore } from "@/stores/incidentStore";
import { useUIStore } from "@/stores/uiStore";

export default function IncidentRoomPage() {
  const params = useParams<{ incidentId: string }>();
  const router = useRouter();
  const incidentId = params.incidentId;

  const { workspace } = usePrimaryWorkspace();
  const incident = useIncident(incidentId);
  const incidents = useIncidents(workspace?.id);
  const tasksQuery = useTasks(incidentId);
  const deepDiveQuery = useDeepDiveResults(incidentId);
  const suspectFiles = useIncidentStore((store) => store.suspectFiles);
  const upsertActionItem = useIncidentStore((store) => store.upsertActionItem);
  const setSuspectFiles = useIncidentStore((store) => store.setSuspectFiles);
  const activePanel = useUIStore((store) => store.activePanel);
  const setActivePanel = useUIStore((store) => store.setActivePanel);

  useIncidentSocket(incidentId);

  useEffect(() => {
    if (!tasksQuery.data) {
      return;
    }
    tasksQuery.data.forEach((item) => upsertActionItem(item));
  }, [tasksQuery.data, upsertActionItem]);

  useEffect(() => {
    if (deepDiveQuery.data && deepDiveQuery.data.length > 0 && suspectFiles.length === 0) {
      setSuspectFiles(deepDiveQuery.data);
    }
  }, [deepDiveQuery.data, suspectFiles.length, setSuspectFiles]);

  const topSuspects = useMemo(
    () => [...suspectFiles].sort((a, b) => a.rank - b.rank).slice(0, 3),
    [suspectFiles],
  );

  const handleResolveIncident = async () => {
    try {
      await api.patch(`/api/incidents/${incidentId}`, { status: "resolved" });
      await Promise.all([
        incident.refetch(),
        incidents.refetch(),
      ]);
      router.push("/incidents");
    } catch (error) {
      console.error("Failed to resolve incident", error);
    }
  };

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-4 pb-20 md:p-6 md:pb-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">
                  {incident.data?.title ?? "Incident Room"}
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  {incident.data ? (
                    <Badge variant={severityToBadgeVariant(incident.data.severity)}>
                      {incident.data.severity}
                    </Badge>
                  ) : null}
                  {incident.data ? <Badge variant="outline">{incident.data.status}</Badge> : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AgentStatusBadge />
                <Button variant="outline" onClick={handleResolveIncident}>
                  Resolve Incident
                </Button>
              </div>
            </div>

            <div className="hidden h-[calc(100vh-180px)] gap-4 lg:grid lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
              <TranscriptFeed />
              <TaskBoard incidentId={incidentId} />
              <Card>
                <CardHeader>
                  <CardTitle>Deep Dive Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topSuspects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No suspect files yet. Trigger or wait for analysis.
                    </p>
                  ) : (
                    topSuspects.map((result) => (
                      <Link
                        key={result.id}
                        href={`/incidents/${incidentId}/deep-dive`}
                        className="block rounded-md border p-2 hover:bg-muted/40"
                      >
                        <p className="text-sm font-medium">{result.suspect_file}</p>
                        <p className="text-xs text-muted-foreground">
                          Confidence {(result.confidence * 100).toFixed(0)}%
                        </p>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:hidden">
              <Tabs
                value={activePanel}
                onValueChange={(value) =>
                  setActivePanel((value as "transcript" | "tasks" | "deep-dive") ?? "transcript")
                }
              >
                <TabsList className="mb-3">
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="deep-dive">Deep Dive</TabsTrigger>
                </TabsList>
                <TabsContent value="transcript" className="h-[calc(100vh-250px)]">
                  <TranscriptFeed />
                </TabsContent>
                <TabsContent value="tasks" className="h-[calc(100vh-250px)]">
                  <TaskBoard incidentId={incidentId} />
                </TabsContent>
                <TabsContent value="deep-dive" className="h-[calc(100vh-250px)]">
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Deep Dive Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {topSuspects.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No suspect files yet.</p>
                      ) : (
                        topSuspects.map((result) => (
                          <Link
                            key={result.id}
                            href={`/incidents/${incidentId}/deep-dive`}
                            className="block rounded-md border p-2"
                          >
                            <p className="text-sm font-medium">{result.suspect_file}</p>
                          </Link>
                        ))
                      )}
                    </CardContent>
                  </Card>
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

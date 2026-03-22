"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBadge } from "@/components/incident/AgentStatusBadge";
import { ReconnectionBanner } from "@/components/incident/ReconnectionBanner";
import { VoiceActivityIndicator } from "@/components/incident/VoiceActivityIndicator";
import { TaskBoard } from "@/components/incident/TaskBoard";
import { TranscriptFeed } from "@/components/incident/TranscriptFeed";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useDeepDiveResults } from "@/hooks/useDeepDive";
import { useIncident, useIncidents } from "@/hooks/useIncident";
import { useIncidentSocket } from "@/hooks/useIncidentSocket";
import { useTasks } from "@/hooks/useTasks";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { api } from "@/lib/api";
import { toastDeepDiveComplete, toastError } from "@/lib/toast";
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
  const hasShownDeepDiveToastRef = useRef(false);
  const previousDeepDiveCountRef = useRef(0);

  useIncidentSocket(incidentId);
  useAudioPlayer();

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

  useEffect(() => {
    const currentCount = deepDiveQuery.data?.length ?? 0;
    const previousCount = previousDeepDiveCountRef.current;
    if (previousCount === 0 && currentCount > 0 && !hasShownDeepDiveToastRef.current) {
      toastDeepDiveComplete();
      hasShownDeepDiveToastRef.current = true;
    }
    previousDeepDiveCountRef.current = currentCount;
  }, [deepDiveQuery.data]);

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
      toastError("Failed to resolve incident");
    }
  };

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-4 pb-20 md:p-6 md:pb-6">
            <ReconnectionBanner />
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
                <VoiceActivityIndicator />
                <AgentStatusBadge />
                <Button variant="outline" onClick={handleResolveIncident}>
                  Resolve Incident
                </Button>
              </div>
            </div>

            <div className="hidden h-[calc(100vh-180px)] gap-4 lg:grid lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
              <PanelErrorBoundary panelName="Transcript panel" className="h-full">
                <TranscriptFeed />
              </PanelErrorBoundary>
              <PanelErrorBoundary panelName="Task board" className="h-full">
                <TaskBoard incidentId={incidentId} isLoading={tasksQuery.isLoading} />
              </PanelErrorBoundary>
              <PanelErrorBoundary panelName="Deep dive preview" className="h-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Deep Dive Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {deepDiveQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading deep dive results...</p>
                    ) : topSuspects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Deep dive not started.</p>
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
              </PanelErrorBoundary>
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
                  <PanelErrorBoundary panelName="Transcript panel" className="h-full">
                    <TranscriptFeed />
                  </PanelErrorBoundary>
                </TabsContent>
                <TabsContent value="tasks" className="h-[calc(100vh-250px)]">
                  <PanelErrorBoundary panelName="Task board" className="h-full">
                    <TaskBoard incidentId={incidentId} isLoading={tasksQuery.isLoading} />
                  </PanelErrorBoundary>
                </TabsContent>
                <TabsContent value="deep-dive" className="h-[calc(100vh-250px)]">
                  <PanelErrorBoundary panelName="Deep dive preview" className="h-full">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle>Deep Dive Preview</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {deepDiveQuery.isLoading ? (
                          <p className="text-sm text-muted-foreground">
                            Loading deep dive results...
                          </p>
                        ) : topSuspects.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Deep dive not started.</p>
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

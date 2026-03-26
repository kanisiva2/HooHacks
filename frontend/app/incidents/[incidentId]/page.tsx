"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowLeft, FileCode2, Search } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { AgentStatusBadge } from "@/components/incident/AgentStatusBadge";
import { ReconnectionBanner } from "@/components/incident/ReconnectionBanner";
import { TaskBoard } from "@/components/incident/TaskBoard";
import { TranscriptFeed } from "@/components/incident/TranscriptFeed";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { PanelErrorBoundary } from "@/components/shared/PanelErrorBoundary";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeepDiveResults } from "@/hooks/useDeepDive";
import { useIncident, useIncidentTranscript, useIncidents } from "@/hooks/useIncident";
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
  const transcriptQuery = useIncidentTranscript(incidentId);
  const incidents = useIncidents(workspace?.id);
  const tasksQuery = useTasks(incidentId);
  const deepDiveQuery = useDeepDiveResults(incidentId);
  const suspectFiles = useIncidentStore((store) => store.suspectFiles);
  const setTranscript = useIncidentStore((store) => store.setTranscript);
  const upsertActionItem = useIncidentStore((store) => store.upsertActionItem);
  const setSuspectFiles = useIncidentStore((store) => store.setSuspectFiles);
  const activePanel = useUIStore((store) => store.activePanel);
  const setActivePanel = useUIStore((store) => store.setActivePanel);
  const [isDownloadingTranscript, setIsDownloadingTranscript] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const hasShownDeepDiveToastRef = useRef(false);
  const previousDeepDiveCountRef = useRef(0);

  useIncidentSocket(incidentId);

  useEffect(() => {
    if (!transcriptQuery.data) {
      return;
    }
    setTranscript(transcriptQuery.data);
  }, [transcriptQuery.data, setTranscript]);

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

  const handleDownloadTranscript = async () => {
    if (!incident.data?.transcript_s3_key) {
      toastError("No persisted transcript is available yet");
      return;
    }

    setIsDownloadingTranscript(true);
    try {
      const { data } = await api.get<{
        transcript_url: string | null;
        report_url: string | null;
      }>(`/api/incidents/${incidentId}/artifacts`);
      if (!data.transcript_url) {
        toastError("Transcript download is not available");
        return;
      }
      window.open(data.transcript_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to download transcript", error);
      toastError("Failed to download transcript");
    } finally {
      setIsDownloadingTranscript(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!incident.data?.report_s3_key) {
      toastError("No incident report is available yet");
      return;
    }

    setIsDownloadingReport(true);
    try {
      const { data } = await api.get<{
        transcript_url: string | null;
        report_url: string | null;
      }>(`/api/incidents/${incidentId}/artifacts`);
      if (!data.report_url) {
        toastError("Report download is not available");
        return;
      }
      window.open(data.report_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to download report", error);
      toastError("Failed to download report");
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex h-screen w-full flex-col overflow-hidden p-4 pb-20 md:p-5 md:pb-5">
            <ReconnectionBanner />

            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/incidents"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                  <h1 className="text-lg font-semibold tracking-[-0.02em] text-slate-950 md:text-xl">
                    {incident.data?.title ?? "Incident Room"}
                  </h1>
                  <div className="mt-1 flex items-center gap-2">
                    {incident.data ? (
                      <Badge variant={severityToBadgeVariant(incident.data.severity)}>
                        {incident.data.severity}
                      </Badge>
                    ) : null}
                    {incident.data ? (
                      <span className="text-xs text-slate-500 capitalize">{incident.data.status}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AgentStatusBadge />
                {incident.data?.transcript_s3_key ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTranscript}
                    disabled={isDownloadingTranscript}
                    className="rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
                  >
                    <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                    {isDownloadingTranscript ? "Preparing..." : "Transcript"}
                  </Button>
                ) : null}
                {incident.data?.report_s3_key ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadReport}
                    disabled={isDownloadingReport}
                    className="rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
                  >
                    <ArrowDownToLine className="mr-1.5 h-4 w-4" />
                    {isDownloadingReport ? "Preparing..." : "Report"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResolveIncident}
                  className="rounded-xl border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
                >
                  Resolve Incident
                </Button>
              </div>
            </div>

            {/* Desktop three-column layout */}
            <div className="hidden min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid lg:grid-cols-[0.7fr_1.4fr_0.9fr]">
              <PanelErrorBoundary panelName="Transcript panel" className="h-full min-h-0">
                <TranscriptFeed />
              </PanelErrorBoundary>
              <PanelErrorBoundary panelName="Task board" className="h-full min-h-0">
                <TaskBoard incidentId={incidentId} isLoading={tasksQuery.isLoading} />
              </PanelErrorBoundary>
              <PanelErrorBoundary panelName="Deep dive preview" className="h-full min-h-0">
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
                        <Search className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900">Deep Dive</h2>
                    </div>
                    {topSuspects.length > 0 && (
                      <Link
                        href={`/incidents/${incidentId}/deep-dive`}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-900"
                      >
                        View all
                      </Link>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {deepDiveQuery.isLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
                        <p className="mt-3 text-xs text-slate-500">Analyzing repository...</p>
                      </div>
                    ) : topSuspects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                          <FileCode2 className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-600">Deep dive not started</p>
                        <p className="mt-1 text-[11px] text-slate-400">Results will appear once investigation begins.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {topSuspects.map((result, index) => (
                          <Link
                            key={result.id}
                            href={`/incidents/${incidentId}/deep-dive`}
                            className="group block rounded-xl border border-slate-200/70 bg-white/60 p-3 transition-all hover:bg-white hover:shadow-sm"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-50 text-[10px] font-bold text-violet-500">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-800 group-hover:text-slate-950">
                                  {result.suspect_file}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <div className="h-1 flex-1 rounded-full bg-slate-100">
                                    <div
                                      className="h-1 rounded-full bg-gradient-to-r from-violet-400 to-violet-500"
                                      style={{ width: `${result.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium tabular-nums text-slate-500">
                                    {(result.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </PanelErrorBoundary>
            </div>

            {/* Mobile tabs */}
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
                    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
                      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
                          <Search className="h-3.5 w-3.5 text-violet-500" />
                        </div>
                        <h2 className="text-sm font-semibold text-slate-900">Deep Dive</h2>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        {deepDiveQuery.isLoading ? (
                          <p className="text-sm text-slate-500">Loading deep dive results...</p>
                        ) : topSuspects.length === 0 ? (
                          <p className="text-sm text-slate-500">Deep dive not started.</p>
                        ) : (
                          <div className="space-y-2">
                            {topSuspects.map((result) => (
                              <Link
                                key={result.id}
                                href={`/incidents/${incidentId}/deep-dive`}
                                className="block rounded-xl border border-slate-200/70 bg-white/60 p-3"
                              >
                                <p className="text-sm font-medium text-slate-800">{result.suspect_file}</p>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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

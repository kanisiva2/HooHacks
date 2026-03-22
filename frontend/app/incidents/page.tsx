"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Plus,
  Search,
  Siren,
} from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { StartIncidentModal } from "@/components/incident/StartIncidentModal";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIncidents } from "@/hooks/useIncident";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { cn, formatRelativeTime, severityToBadgeVariant } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

function statusColor(status: string) {
  if (status === "active") return "bg-emerald-500";
  if (status === "resolved") return "bg-blue-400";
  return "bg-slate-300";
}

function severityAccent(severity: string) {
  if (severity === "P1") return "border-l-red-500";
  if (severity === "P2") return "border-l-amber-400";
  if (severity === "P3") return "border-l-blue-400";
  return "border-l-slate-300";
}

export default function IncidentsPage() {
  const { workspace, isLoading: workspaceLoading } = usePrimaryWorkspace();
  const incidents = useIncidents(workspace?.id);
  const modals = useUIStore((state) => state.modals);
  const setModalOpen = useUIStore((state) => state.setModalOpen);

  const sortedIncidents = useMemo(
    () =>
      [...(incidents.data ?? [])].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      ),
    [incidents.data],
  );

  const activeCount = useMemo(
    () => sortedIncidents.filter((i) => i.status === "active").length,
    [sortedIncidents],
  );

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">
                    Incidents
                  </h1>
                  {!workspaceLoading && sortedIncidents.length > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                      {sortedIncidents.length} total
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  View all incident rooms and their current status.
                </p>
              </div>
              <Button
                disabled={!workspace}
                onClick={() => setModalOpen("startIncident", true)}
                size="lg"
                className="rounded-2xl bg-slate-950 px-5 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Start Incident
              </Button>
            </div>

            {/* Active indicator */}
            {activeCount > 0 && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-medium">
                  {activeCount} active incident{activeCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Content */}
            {workspaceLoading || incidents.isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm"
                  >
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : sortedIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/72 py-16 text-center backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Search className="h-7 w-7 text-slate-400" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">
                  No incidents yet
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  Start your first incident room to begin live transcript
                  streaming, task extraction, and AI-powered deep dive
                  analysis.
                </p>
                <Button
                  className="mt-6 rounded-2xl bg-slate-950 px-5 shadow-[0_8px_20px_rgba(15,23,42,0.14)] hover:bg-slate-800"
                  onClick={() => setModalOpen("startIncident", true)}
                  disabled={!workspace}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Start First Incident
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {sortedIncidents.map((incident) => (
                  <Link
                    href={`/incidents/${incident.id}`}
                    key={incident.id}
                    className="group block"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-4 rounded-2xl border border-l-4 border-white/70 bg-white/72 p-4 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md md:p-5",
                        severityAccent(incident.severity),
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <Siren
                          className={cn(
                            "h-5 w-5",
                            incident.status === "active"
                              ? "text-red-500"
                              : "text-slate-400",
                          )}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-950">
                          {incident.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                statusColor(incident.status),
                              )}
                            />
                            <span className="capitalize">
                              {incident.status}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(incident.created_at)}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={severityToBadgeVariant(incident.severity)}
                        className="shrink-0"
                      >
                        {incident.severity}
                      </Badge>

                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {workspace ? (
              <StartIncidentModal
                open={modals.startIncident}
                onOpenChange={(open) => setModalOpen("startIncident", open)}
                workspaceId={workspace.id}
              />
            ) : null}
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Plus,
  Settings,
  Siren,
  Zap,
} from "lucide-react";
import { StartIncidentModal } from "@/components/incident/StartIncidentModal";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { useIncidents } from "@/hooks/useIncident";
import { useTasks } from "@/hooks/useTasks";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { formatRelativeTime, severityToBadgeVariant } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

export default function DashboardPage() {
  const { workspace } = usePrimaryWorkspace();
  const incidentsQuery = useIncidents(workspace?.id);
  const latestIncidentId = incidentsQuery.data?.[0]?.id;
  const tasksQuery = useTasks(latestIncidentId);
  const modals = useUIStore((state) => state.modals);
  const setModalOpen = useUIStore((state) => state.setModalOpen);

  const allActiveIncidents = useMemo(
    () =>
      (incidentsQuery.data ?? []).filter(
        (incident) => incident.status === "active",
      ),
    [incidentsQuery.data],
  );
  const activeIncidentPreview = useMemo(
    () => allActiveIncidents.slice(0, 5),
    [allActiveIncidents],
  );
  const syncedTasks = useMemo(
    () =>
      (tasksQuery.data ?? [])
        .filter((task) => task.status === "synced")
        .slice(0, 5),
    [tasksQuery.data],
  );

  const resolvedCount = useMemo(
    () =>
      (incidentsQuery.data ?? []).filter((i) => i.status === "resolved").length,
    [incidentsQuery.data],
  );

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Monitor active incidents, track tasks, and launch new rooms.
              </p>
            </div>

            {/* Stat Cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      Active
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-slate-950">
                      {allActiveIncidents.length}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <Siren className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Live incidents right now
                </p>
                {allActiveIncidents.length > 0 && (
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-400" />
                )}
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      Resolved
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-slate-950">
                      {resolvedCount}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Total resolved incidents
                </p>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      Tasks Synced
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-slate-950">
                      {syncedTasks.length}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  From latest incident
                </p>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      Total
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-slate-950">
                      {incidentsQuery.data?.length ?? 0}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <CircleDot className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  All-time incidents
                </p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="mb-8 grid gap-6 lg:grid-cols-5">
              {/* Active Incidents */}
              <div className="rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      Active Incidents
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Currently ongoing incident rooms
                    </p>
                  </div>
                  {allActiveIncidents.length > 5 && (
                    <Link
                      href="/incidents"
                      className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      View all
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                {activeIncidentPreview.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                      <Zap className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No active incidents
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      When you start a new incident room, it will appear here
                      with live status.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeIncidentPreview.map((incident) => (
                      <Link
                        key={incident.id}
                        href={`/incidents/${incident.id}`}
                        className="group flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 p-3 transition-all hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 group-hover:text-slate-950">
                              {incident.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              <Clock className="mr-1 inline-block h-3 w-3" />
                              Started{" "}
                              {formatRelativeTime(incident.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={severityToBadgeVariant(incident.severity)}
                        >
                          {incident.severity}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Tasks */}
              <div className="rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm lg:col-span-2">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-950">
                    Recent Tasks
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Latest synced action items
                  </p>
                </div>
                {syncedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                      <CheckCircle2 className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      No tasks yet
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      Tasks extracted from meetings will appear here once
                      synced.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {task.normalized_task}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {task.owner ?? "Unassigned"}
                          </p>
                        </div>
                        {task.jira_issue_key ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 font-mono text-[11px]"
                          >
                            {task.jira_issue_key}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0">
                            synced
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Quick Actions
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => setModalOpen("startIncident", true)}
                  className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white/72 p-4 text-left backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-transform group-hover:scale-105">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Launch Incident
                    </p>
                    <p className="text-xs text-slate-500">
                      Start a new incident room
                    </p>
                  </div>
                </button>

                <Link
                  href="/settings"
                  className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 transition-transform group-hover:scale-105">
                    <Settings className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Manage Settings
                    </p>
                    <p className="text-xs text-slate-500">
                      Integrations & preferences
                    </p>
                  </div>
                </Link>

                {incidentsQuery.data?.[0] && (
                  <Link
                    href={`/incidents/${incidentsQuery.data[0].id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-white/70 bg-white/72 p-4 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 transition-transform group-hover:scale-105">
                      <ArrowRight className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Rejoin Latest Room
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatRelativeTime(incidentsQuery.data[0].created_at)}
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </div>

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

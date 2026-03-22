"use client";

import { useMemo } from "react";
import Link from "next/link";
import { StartIncidentModal } from "@/components/incident/StartIncidentModal";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    () => (incidentsQuery.data ?? []).filter((incident) => incident.status === "active"),
    [incidentsQuery.data],
  );
  const activeIncidentPreview = useMemo(() => allActiveIncidents.slice(0, 5), [allActiveIncidents]);
  const syncedTasks = useMemo(
    () => (tasksQuery.data ?? []).filter((task) => task.status === "synced").slice(0, 5),
    [tasksQuery.data],
  );

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-6 pb-20 md:pb-6">
            <h1 className="mb-6 text-2xl font-semibold">Sprynt Dashboard</h1>

            <section className="mb-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Incidents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-3xl font-semibold">{allActiveIncidents.length}</p>
                  <p className="text-sm text-muted-foreground">Live incidents right now</p>
                  <div className="space-y-2">
                    {activeIncidentPreview.map((incident) => (
                      <Link
                        key={incident.id}
                        href={`/incidents/${incident.id}`}
                        className="block rounded-md border p-2 hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{incident.title}</p>
                          <Badge variant={severityToBadgeVariant(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Started {formatRelativeTime(incident.created_at)}
                        </p>
                      </Link>
                    ))}
                    {activeIncidentPreview.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active incidents.</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {syncedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm">{task.normalized_task}</p>
                        <p className="text-xs text-muted-foreground">{task.owner ?? "Unassigned"}</p>
                      </div>
                      {task.jira_issue_key ? (
                        <Badge variant="outline">{task.jira_issue_key}</Badge>
                      ) : (
                        <Badge variant="outline">synced</Badge>
                      )}
                    </div>
                  ))}
                  {!syncedTasks.length ? (
                    <p className="text-sm text-muted-foreground">No synced tasks yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <Button onClick={() => setModalOpen("startIncident", true)}>Quick Launch Incident</Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/integrations" />}>
                Manage integrations
              </Button>
              {incidentsQuery.data?.[0] ? (
                <Button nativeButton={false} variant="outline" render={<Link href={`/incidents/${incidentsQuery.data[0].id}`} />}>
                  Rejoin latest room ({formatRelativeTime(incidentsQuery.data[0].created_at)})
                </Button>
              ) : null}
            </section>

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

"use client";

import Link from "next/link";
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
import { formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { workspace } = usePrimaryWorkspace();
  const incidentsQuery = useIncidents(workspace?.id);
  const latestIncidentId = incidentsQuery.data?.[0]?.id;
  const tasksQuery = useTasks(latestIncidentId);

  const activeCount = (incidentsQuery.data ?? []).filter(
    (incident) => incident.status === "active",
  ).length;

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
                <CardContent>
                  <p className="text-3xl font-semibold">{activeCount}</p>
                  <p className="text-sm text-muted-foreground">Live incidents right now</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(tasksQuery.data ?? []).slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-2">
                      <p className="text-sm">{task.normalized_task}</p>
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                  ))}
                  {!tasksQuery.data?.length ? (
                    <p className="text-sm text-muted-foreground">No recent tasks yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <Button nativeButton={false} render={<Link href="/incidents" />}>Start or view incidents</Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/integrations" />}>
                Manage integrations
              </Button>
              {incidentsQuery.data?.[0] ? (
                <Button nativeButton={false} variant="outline" render={<Link href={`/incidents/${incidentsQuery.data[0].id}`} />}>
                  Rejoin latest room ({formatRelativeTime(incidentsQuery.data[0].created_at)})
                </Button>
              ) : null}
            </section>
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}

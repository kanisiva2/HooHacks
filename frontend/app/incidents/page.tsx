"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { StartIncidentModal } from "@/components/incident/StartIncidentModal";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncidents } from "@/hooks/useIncident";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import { formatRelativeTime, severityToBadgeVariant } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

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

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-6 pb-20 md:pb-6">
            <div className="mb-6 flex items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold">Incidents</h1>
              <Button
                disabled={!workspace}
                onClick={() => setModalOpen("startIncident", true)}
              >
                Start Incident
              </Button>
            </div>

            {workspaceLoading || incidents.isLoading ? (
              <div className="grid gap-3">
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : sortedIncidents.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No incidents yet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Start your first incident room to begin live transcript and task tracking.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {sortedIncidents.map((incident) => (
                  <Link href={`/incidents/${incident.id}`} key={incident.id}>
                    <Card className="transition hover:ring-2 hover:ring-primary/30">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span>{incident.title}</span>
                          <Badge variant={severityToBadgeVariant(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{incident.status}</Badge>
                        <span>Created {formatRelativeTime(incident.created_at)}</span>
                      </CardContent>
                    </Card>
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

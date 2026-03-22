"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Link2, Unplug } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDisconnectIntegration,
  useIntegrationStatus,
} from "@/hooks/useIntegrations";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";

function IntegrationCard({
  provider,
  connected,
  connectHref,
  onDisconnect,
  disconnecting,
}: {
  provider: "GitHub" | "Jira";
  connected: boolean;
  connectHref: string;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {provider}
          </span>
          <Badge variant={connected ? "secondary" : "outline"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        {connected ? (
          <Button variant="outline" onClick={onDisconnect} disabled={disconnecting}>
            <Unplug className="h-4 w-4" />
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={() => {
              window.location.href = connectHref;
            }}
          >
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationsPageContent() {
  const searchParams = useSearchParams();
  const statusQuery = useIntegrationStatus();
  const disconnectMutation = useDisconnectIntegration();
  const { workspace } = usePrimaryWorkspace();

  const successLabel = useMemo(() => {
    if (searchParams.get("github") === "connected") {
      return "GitHub connected successfully";
    }
    if (searchParams.get("jira") === "connected") {
      return "Jira connected successfully";
    }
    return null;
  }, [searchParams]);

  const githubHref = workspace
    ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/integrations/github/connect?workspace_id=${workspace.id}`
    : "#";
  const jiraHref = workspace
    ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/integrations/jira/connect?workspace_id=${workspace.id}`
    : "#";

  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>

          {successLabel ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {successLabel}
            </div>
          ) : null}

          {statusQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-36 animate-pulse rounded-xl bg-muted" />
              <div className="h-36 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <IntegrationCard
                provider="GitHub"
                connected={statusQuery.data?.has_github ?? false}
                connectHref={githubHref}
                onDisconnect={() => disconnectMutation.mutate("github")}
                disconnecting={disconnectMutation.isPending}
              />
              <IntegrationCard
                provider="Jira"
                connected={statusQuery.data?.has_jira ?? false}
                connectHref={jiraHref}
                onDisconnect={() => disconnectMutation.mutate("jira")}
                disconnecting={disconnectMutation.isPending}
              />
            </div>
          )}
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedPage>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="w-full p-6 pb-20 md:pb-6">
              <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-36 animate-pulse rounded-xl bg-muted" />
                <div className="h-36 animate-pulse rounded-xl bg-muted" />
              </div>
            </main>
            <MobileNav />
          </div>
        </ProtectedPage>
      }
    >
      <IntegrationsPageContent />
    </Suspense>
  );
}

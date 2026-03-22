"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface IntegrationStatus {
  has_github: boolean;
  has_jira: boolean;
  github_default_repo: string | null;
  jira_default_project_key: string | null;
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const wsResp = await api.get("/api/workspaces");
      const workspaces = wsResp.data;
      if (workspaces.length > 0) {
        setWorkspaceId(workspaces[0].id);
      }

      const resp = await api.get("/api/integrations/status");
      setStatus(resp.data);
    } catch {
      setStatus({ has_github: false, has_jira: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (searchParams.get("github") === "connected") {
      setToast("GitHub connected successfully!");
      setTimeout(() => setToast(null), 4000);
    }
    if (searchParams.get("jira") === "connected") {
      setToast("Jira connected successfully!");
      setTimeout(() => setToast(null), 4000);
    }
  }, [searchParams]);

  const handleConnect = async (provider: "github" | "jira") => {
    if (!workspaceId) return;
    try {
      const resp = await api.get(
        `/api/integrations/${provider}/connect?workspace_id=${workspaceId}`
      );
      window.location.href = resp.data.url;
    } catch {
      setToast("Failed to start OAuth flow. Please try again.");
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDisconnect = async (provider: "github" | "jira") => {
    setDisconnecting(provider);
    try {
      await api.delete(`/api/integrations/${provider}`);
      await fetchStatus();
      setToast(`${provider === "github" ? "GitHub" : "Jira"} disconnected.`);
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast("Failed to disconnect. Please try again.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>

          {toast && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              {toast}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* GitHub Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">GitHub</CardTitle>
                  <Badge variant={status?.has_github ? "default" : "secondary"}>
                    {status?.has_github ? "Connected" : "Not Connected"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Connect GitHub to enable repository analysis and deep dive
                    investigations during incidents.
                  </p>
                  {status?.has_github ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect("github")}
                      disabled={disconnecting === "github"}
                    >
                      {disconnecting === "github"
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect("github")}
                      disabled={!workspaceId}
                    >
                      Connect GitHub
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Jira Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">Jira</CardTitle>
                  <Badge variant={status?.has_jira ? "default" : "secondary"}>
                    {status?.has_jira ? "Connected" : "Not Connected"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Connect Jira to automatically sync action items extracted
                    from incident calls as Jira issues.
                  </p>
                  {status?.has_jira ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect("jira")}
                      disabled={disconnecting === "jira"}
                    >
                      {disconnecting === "jira"
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect("jira")}
                      disabled={!workspaceId}
                    >
                      Connect Jira
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}

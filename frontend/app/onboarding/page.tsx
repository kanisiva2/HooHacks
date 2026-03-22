"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useIntegrationStatus,
} from "@/hooks/useIntegrations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/api";
import { toastError } from "@/lib/toast";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [isConnectingJira, setIsConnectingJira] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const autoCreateStartedRef = useRef(false);

  const workspaces = useWorkspaces();
  const integrations = useIntegrationStatus();
  const workspace = workspaces.data?.[0] ?? null;
  const effectiveWorkspaceId = workspaceId ?? workspace?.id ?? null;

  const completion = useMemo(() => {
    return {
      workspace: Boolean(effectiveWorkspaceId),
      github: integrations.data?.has_github ?? false,
      jira: integrations.data?.has_jira ?? false,
      complete:
        Boolean(effectiveWorkspaceId) &&
        (integrations.data?.has_github ?? false) &&
        (integrations.data?.has_jira ?? false),
    };
  }, [effectiveWorkspaceId, integrations.data]);

  useEffect(() => {
    if (workspaces.isLoading || effectiveWorkspaceId || autoCreateStartedRef.current) {
      return;
    }

    autoCreateStartedRef.current = true;
    setIsCreatingWorkspace(true);

    const createWorkspace = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const emailName = user?.email?.split("@")[0]?.trim();
      const fallbackName = emailName
        ? `${emailName}'s Workspace`
        : "My Workspace";

      try {
        const { data } = await api.post<Workspace>("/api/workspaces", {
          name: fallbackName,
        });
        setWorkspaceId(data.id);
        await workspaces.refetch();
      } catch {
        autoCreateStartedRef.current = false;
        toastError("Failed to create your workspace");
      } finally {
        setIsCreatingWorkspace(false);
      }
    };

    void createWorkspace();
  }, [effectiveWorkspaceId, supabase, workspaces, workspaces.isLoading]);

  const handleFinish = () => {
    router.push("/dashboard");
  };

  const beginOAuthFlow = async (provider: "github" | "jira") => {
    if (!effectiveWorkspaceId) {
      return;
    }

    if (provider === "github") {
      setIsConnectingGithub(true);
    } else {
      setIsConnectingJira(true);
    }

    try {
      const { data } = await api.get<{ url: string }>(
        `/api/integrations/${provider}/connect`,
        {
          params: {
            workspace_id: effectiveWorkspaceId,
            next: "/onboarding",
          },
        },
      );
      window.location.href = data.url;
    } catch {
      toastError(`Failed to start ${provider === "github" ? "GitHub" : "Jira"} connection`);
      if (provider === "github") {
        setIsConnectingGithub(false);
      } else {
        setIsConnectingJira(false);
      }
    }
  };

  return (
    <ProtectedPage>
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="max-w-2xl space-y-2">
            <Badge variant="outline">Setup</Badge>
            <h1 className="text-3xl font-semibold">Finish onboarding before entering Sprynt</h1>
            <p className="text-sm text-muted-foreground">
              Connect GitHub plus Jira first. Once setup is complete, we&apos;ll send you straight
              to the dashboard.
            </p>
            {isCreatingWorkspace ? (
              <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
            ) : null}
            {searchParams.get("github") === "connected" ? (
              <p className="text-sm text-emerald-700">GitHub connected successfully.</p>
            ) : null}
            {searchParams.get("jira") === "connected" ? (
              <p className="text-sm text-emerald-700">Jira connected successfully.</p>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Connect GitHub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={completion.github ? "secondary" : "outline"}>
                  {completion.github ? "Connected" : "Not connected"}
                </Badge>
                <Button
                  type="button"
                  disabled={!completion.workspace}
                  onClick={() => void beginOAuthFlow("github")}
                >
                  {isConnectingGithub ? "Connecting..." : "Connect GitHub"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 2: Connect Jira</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={completion.jira ? "secondary" : "outline"}>
                  {completion.jira ? "Connected" : "Not connected"}
                </Badge>
                <Button
                  type="button"
                  disabled={!completion.workspace}
                  onClick={() => void beginOAuthFlow("jira")}
                >
                  {isConnectingJira ? "Connecting..." : "Connect Jira"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Button
              type="button"
              onClick={handleFinish}
              disabled={!completion.complete}
            >
              Continue to dashboard
            </Button>
          </div>
        </div>
      </main>
    </ProtectedPage>
  );
}

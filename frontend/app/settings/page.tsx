"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookText, CheckCircle2, FileText, Link2, MessageSquareText, Settings2, Unplug } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useDisconnectIntegration,
  useGithubRepos,
  useIntegrationStatus,
  useJiraProjects,
} from "@/hooks/useIntegrations";
import { usePrimaryWorkspace } from "@/hooks/useWorkspaces";
import {
  useUpdateWorkspaceDefaults,
  useWorkspaceDefaults,
} from "@/hooks/useWorkspaceDefaults";
import { api } from "@/lib/api";
import { toastError } from "@/lib/toast";

type ConnectedProvider = "github" | "jira";
type PlaceholderProvider = "Notion" | "Slack" | "Microsoft Teams";

function PlaceholderCard({
  title,
  description,
  icon: Icon,
}: {
  title: PlaceholderProvider;
  description: string;
  icon: typeof BookText;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </span>
          <Badge variant="outline">Coming later</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button type="button" variant="outline" disabled>
          Not available yet
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const supabase = useSupabase();
  const { workspace } = usePrimaryWorkspace();
  const statusQuery = useIntegrationStatus();
  const githubRepos = useGithubRepos(statusQuery.data?.has_github ?? false);
  const jiraProjects = useJiraProjects(statusQuery.data?.has_jira ?? false);
  const defaults = useWorkspaceDefaults();
  const disconnectMutation = useDisconnectIntegration();
  const saveDefaults = useUpdateWorkspaceDefaults();

  const [defaultRepo, setDefaultRepo] = useState<string>("");
  const [defaultProject, setDefaultProject] = useState<string>("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeSaveTarget, setActiveSaveTarget] = useState<ConnectedProvider | null>(null);

  const effectiveRepo = defaultRepo || defaults.data?.default_repo || "";
  const effectiveProject =
    defaultProject || defaults.data?.default_jira_project_key || "";

  const successLabel = useMemo(() => {
    if (searchParams.get("github") === "connected") {
      return "GitHub connected successfully";
    }
    if (searchParams.get("jira") === "connected") {
      return "Jira connected successfully";
    }
    return null;
  }, [searchParams]);

  const beginOAuthFlow = async (provider: ConnectedProvider) => {
    if (!workspace?.id) {
      toastError("Workspace not ready yet");
      return;
    }

    try {
      const { data } = await api.get<{ url: string }>(
        `/api/integrations/${provider}/connect`,
        {
          params: {
            workspace_id: workspace.id,
            next: "/settings",
          },
        },
      );
      window.location.href = data.url;
    } catch {
      toastError(`Failed to start ${provider === "github" ? "GitHub" : "Jira"} connection`);
    }
  };

  const handleSaveRepo = async () => {
    setActiveSaveTarget("github");
    try {
      await saveDefaults.mutateAsync({
        default_repo: effectiveRepo || undefined,
      });
    } finally {
      setActiveSaveTarget(null);
    }
  };

  const handleSaveProject = async () => {
    setActiveSaveTarget("jira");
    try {
      await saveDefaults.mutateAsync({
        default_jira_project_key: effectiveProject || undefined,
      });
    } finally {
      setActiveSaveTarget(null);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setIsSigningOut(false);
      toastError("Failed to sign out");
      return;
    }

    window.location.replace("/login");
  };

  return (
    <ProtectedPage>
      <OnboardingGate>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="w-full p-6 pb-20 md:pb-6">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold">Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage integrations, defaults, and account access from one place.
              </p>
            </div>

            {successLabel ? (
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {successLabel}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      GitHub
                    </span>
                    <Badge variant={statusQuery.data?.has_github ? "secondary" : "outline"}>
                      {statusQuery.data?.has_github ? "Connected" : "Disconnected"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect GitHub for deep-dive analysis and repository context during incidents.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Default repository</label>
                    <Select
                      value={effectiveRepo}
                      onValueChange={(value) => setDefaultRepo(value ?? "")}
                      disabled={!statusQuery.data?.has_github}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {(githubRepos.data ?? []).map((repo) => (
                          <SelectItem key={repo.full_name} value={repo.full_name}>
                            {repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {statusQuery.data?.has_github ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => void handleSaveRepo()}
                          disabled={activeSaveTarget === "jira" || activeSaveTarget === "github"}
                        >
                          {activeSaveTarget === "github" ? "Saving..." : "Save repository"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => disconnectMutation.mutate("github")}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unplug className="mr-1 h-4 w-4" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button type="button" onClick={() => void beginOAuthFlow("github")}>
                        Connect GitHub
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Jira
                    </span>
                    <Badge variant={statusQuery.data?.has_jira ? "secondary" : "outline"}>
                      {statusQuery.data?.has_jira ? "Connected" : "Disconnected"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect Jira to push approved action items directly into the team workflow.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Default Jira project</label>
                    <Select
                      value={effectiveProject}
                      onValueChange={(value) => setDefaultProject(value ?? "")}
                      disabled={!statusQuery.data?.has_jira}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {(jiraProjects.data ?? []).map((project) => (
                          <SelectItem key={project.key} value={project.key}>
                            {project.key} — {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {statusQuery.data?.has_jira ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => void handleSaveProject()}
                          disabled={activeSaveTarget === "github" || activeSaveTarget === "jira"}
                        >
                          {activeSaveTarget === "jira" ? "Saving..." : "Save project"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => disconnectMutation.mutate("jira")}
                          disabled={disconnectMutation.isPending}
                        >
                          <Unplug className="mr-1 h-4 w-4" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button type="button" onClick={() => void beginOAuthFlow("jira")}>
                        Connect Jira
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <PlaceholderCard
                title="Notion"
                description="Reserve space for docs sync, postmortems, and incident note capture."
                icon={BookText}
              />

              <PlaceholderCard
                title="Slack"
                description="Reserve space for incident channel mirroring, alerts, and AI updates."
                icon={MessageSquareText}
              />

              <PlaceholderCard
                title="Microsoft Teams"
                description="Reserve space for future chat integration and meeting coordination."
                icon={FileText}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign out of Sprynt to test authentication and onboarding flows.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
          <MobileNav />
        </div>
      </OnboardingGate>
    </ProtectedPage>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <ProtectedPage>
          <OnboardingGate>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="w-full p-6 pb-20 md:pb-6">
                <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="h-44 animate-pulse rounded-xl bg-muted" />
                  <div className="h-44 animate-pulse rounded-xl bg-muted" />
                  <div className="h-40 animate-pulse rounded-xl bg-muted" />
                  <div className="h-40 animate-pulse rounded-xl bg-muted" />
                </div>
              </main>
              <MobileNav />
            </div>
          </OnboardingGate>
        </ProtectedPage>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookText,
  CheckCircle2,
  ExternalLink,
  FileText,
  LogOut,
  MessageSquareText,
  Settings2,
  Shield,
  Unplug,
} from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}


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
    <div className="rounded-2xl border border-white/70 bg-white/50 p-5 opacity-70 backdrop-blur-sm transition-opacity hover:opacity-85">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </span>
        <span className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          Coming soon
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
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
  const [activeSaveTarget, setActiveSaveTarget] =
    useState<ConnectedProvider | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const effectiveRepo = defaultRepo || defaults.data?.default_repo || "";
  const effectiveProject =
    defaultProject || defaults.data?.default_jira_project_key || "";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, [supabase]);

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
      toastError(
        `Failed to start ${provider === "github" ? "GitHub" : "Jira"} connection`,
      );
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
        <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">
                Settings
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage integrations, defaults, and account access.
              </p>
            </div>

            {/* Success Banner */}
            {successLabel && (
              <div className="mb-6 inline-flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {successLabel}
              </div>
            )}

            {/* Connected Integrations Section */}
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950/10">
                  <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Connected Services
                </h2>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {/* GitHub Card */}
                <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                  {statusQuery.data?.has_github && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500" />
                  )}
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#24292f] text-white shadow-sm">
                        <GitHubIcon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        GitHub
                      </span>
                    </span>
                    <Badge
                      variant={
                        statusQuery.data?.has_github ? "secondary" : "outline"
                      }
                      className={
                        statusQuery.data?.has_github
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : ""
                      }
                    >
                      {statusQuery.data?.has_github ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                      ) : (
                        "Disconnected"
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Deep-dive analysis, repository context, and code
                    investigation during incidents.
                  </p>

                  <div className="mt-4 space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Default repository
                    </label>
                    <Select
                      value={effectiveRepo}
                      onValueChange={(value) => setDefaultRepo(value ?? "")}
                      disabled={!statusQuery.data?.has_github}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white/85">
                        <SelectValue placeholder="Select repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {(githubRepos.data ?? []).map((repo) => (
                          <SelectItem
                            key={repo.full_name}
                            value={repo.full_name}
                          >
                            {repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-4">
                    {statusQuery.data?.has_github ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl bg-slate-950 shadow-sm hover:bg-slate-800"
                          onClick={() => void handleSaveRepo()}
                          disabled={
                            activeSaveTarget === "jira" ||
                            activeSaveTarget === "github"
                          }
                        >
                          {activeSaveTarget === "github"
                            ? "Saving..."
                            : "Save repository"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectMutation.mutate("github")}
                          disabled={disconnectMutation.isPending}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Unplug className="mr-1 h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        className="rounded-xl bg-slate-950 shadow-sm hover:bg-slate-800"
                        onClick={() => void beginOAuthFlow("github")}
                      >
                        <GitHubIcon className="mr-1.5 h-4 w-4" />
                        Connect GitHub
                      </Button>
                    )}
                  </div>
                </div>

                {/* Jira Card */}
                <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                  {statusQuery.data?.has_jira && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-400" />
                  )}
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0052CC] text-white shadow-sm">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">
                        Jira
                      </span>
                    </span>
                    <Badge
                      variant={
                        statusQuery.data?.has_jira ? "secondary" : "outline"
                      }
                      className={
                        statusQuery.data?.has_jira
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : ""
                      }
                    >
                      {statusQuery.data?.has_jira ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Connected
                        </span>
                      ) : (
                        "Disconnected"
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    Push approved action items directly into your team&apos;s
                    Jira workflow during incidents.
                  </p>

                  <div className="mt-4 space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Default Jira project
                    </label>
                    <Select
                      value={effectiveProject}
                      onValueChange={(value) =>
                        setDefaultProject(value ?? "")
                      }
                      disabled={!statusQuery.data?.has_jira}
                    >
                      <SelectTrigger className="w-full rounded-xl border-slate-200 bg-white/85">
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

                  <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-4">
                    {statusQuery.data?.has_jira ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl bg-slate-950 shadow-sm hover:bg-slate-800"
                          onClick={() => void handleSaveProject()}
                          disabled={
                            activeSaveTarget === "github" ||
                            activeSaveTarget === "jira"
                          }
                        >
                          {activeSaveTarget === "jira"
                            ? "Saving..."
                            : "Save project"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectMutation.mutate("jira")}
                          disabled={disconnectMutation.isPending}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Unplug className="mr-1 h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        className="rounded-xl bg-slate-950 shadow-sm hover:bg-slate-800"
                        onClick={() => void beginOAuthFlow("jira")}
                      >
                        <Settings2 className="mr-1.5 h-4 w-4" />
                        Connect Jira
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon Section */}
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Coming Soon
                </h2>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <PlaceholderCard
                  title="Notion"
                  description="Docs sync, postmortems, and note capture."
                  icon={BookText}
                />
                <PlaceholderCard
                  title="Slack"
                  description="Incident channel mirroring, alerts, and updates."
                  icon={MessageSquareText}
                />
                <PlaceholderCard
                  title="Microsoft Teams"
                  description="Chat integration and meeting coordination."
                  icon={FileText}
                />
              </div>
            </div>

            {/* Account Section */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                  <Shield className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Account
                </h2>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/72 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold uppercase text-white">
                    {userEmail ? userEmail[0] : "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {userEmail ?? "Loading..."}
                    </p>
                    <p className="text-xs text-slate-500">Signed in</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="shrink-0 rounded-xl border-slate-200"
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </Button>
              </div>
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
            <div className="flex min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#f5f2ec_100%)]">
              <Sidebar />
              <main className="flex-1 overflow-y-auto px-4 pb-20 pt-6 md:px-8 md:pb-8">
                <div className="mb-8">
                  <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
                  <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="mb-4">
                  <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="h-56 animate-pulse rounded-2xl bg-white/50" />
                  <div className="h-56 animate-pulse rounded-2xl bg-white/50" />
                </div>
                <div className="mt-10 mb-4">
                  <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="h-32 animate-pulse rounded-2xl bg-white/50" />
                  <div className="h-32 animate-pulse rounded-2xl bg-white/50" />
                  <div className="h-32 animate-pulse rounded-2xl bg-white/50" />
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

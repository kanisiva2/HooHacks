"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

interface Repo {
  full_name: string;
  description: string;
  default_branch: string;
}

interface JiraProject {
  key: string;
  name: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasGithub, setHasGithub] = useState(false);
  const [hasJira, setHasJira] = useState(false);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);

  const refreshState = useCallback(async () => {
    try {
      const wsResp = await api.get("/api/workspaces");
      if (wsResp.data.length > 0) {
        const ws = wsResp.data[0];
        setWorkspaceId(ws.id);
        if (step === 1) setStep(2);
      }

      const statusResp = await api.get("/api/integrations/status");
      setHasGithub(statusResp.data.has_github);
      setHasJira(statusResp.data.has_jira);
    } catch {
      /* ignore on first load */
    }
  }, [step]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (searchParams.get("github") === "connected") {
      setHasGithub(true);
      if (step === 2) setStep(3);
    }
    if (searchParams.get("jira") === "connected") {
      setHasJira(true);
      if (step <= 3) setStep(4);
    }
  }, [searchParams, step]);

  useEffect(() => {
    if (step === 4) {
      if (hasGithub) {
        api
          .get("/api/integrations/github/repos")
          .then((r) => setRepos(r.data))
          .catch(() => {});
      }
      if (hasJira) {
        api
          .get("/api/integrations/jira/projects")
          .then((r) => setProjects(r.data))
          .catch(() => {});
      }
    }
  }, [step, hasGithub, hasJira]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await api.post("/api/workspaces", {
        name: workspaceName.trim(),
        slug: workspaceName.trim().toLowerCase().replace(/\s+/g, "-"),
      });
      setWorkspaceId(resp.data.id);
      setStep(2);
    } catch {
      setError("Failed to create workspace. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnectGithub = async () => {
    if (!workspaceId) return;
    try {
      const resp = await api.get(
        `/api/integrations/github/connect?workspace_id=${workspaceId}`
      );
      window.location.href = resp.data.url;
    } catch {
      setError("Failed to start GitHub OAuth. Please try again.");
    }
  };

  const handleConnectJira = async () => {
    if (!workspaceId) return;
    try {
      const resp = await api.get(
        `/api/integrations/jira/connect?workspace_id=${workspaceId}`
      );
      window.location.href = resp.data.url;
    } catch {
      setError("Failed to start Jira OAuth. Please try again.");
    }
  };

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      if (selectedRepo) {
        await api.patch("/api/integrations/github/settings", {
          default_repo: selectedRepo,
        });
      }
      if (selectedProject) {
        await api.patch("/api/integrations/jira/settings", {
          default_project_key: selectedProject,
        });
      }
      router.push("/dashboard");
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSavingDefaults(false);
    }
  };

  const stepDone = (s: number) => {
    if (s === 1) return !!workspaceId;
    if (s === 2) return hasGithub;
    if (s === 3) return hasJira;
    return false;
  };

  return (
    <ProtectedPage>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Welcome to Sprynt</h1>
            <p className="text-sm text-muted-foreground">
              Let&apos;s get your workspace set up.
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step
                    ? stepDone(s)
                      ? "bg-green-500"
                      : "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Create workspace */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1 — Create Workspace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="ws-name">
                    Workspace Name
                  </label>
                  <Input
                    id="ws-name"
                    placeholder="My Team"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateWorkspace()
                    }
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  onClick={handleCreateWorkspace}
                  disabled={submitting || !workspaceName.trim()}
                  className="w-full"
                >
                  {submitting ? "Creating..." : "Create Workspace"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Connect GitHub */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2 — Connect GitHub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your GitHub account to enable repository analysis
                  during incidents.
                </p>
                {hasGithub ? (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    GitHub connected
                  </div>
                ) : (
                  <Button onClick={handleConnectGithub} className="w-full">
                    Connect GitHub
                  </Button>
                )}
                <div className="flex gap-2">
                  {hasGithub && (
                    <Button onClick={() => setStep(3)} className="flex-1">
                      Continue
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setStep(3)}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Connect Jira */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3 — Connect Jira</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect Jira to automatically sync action items from incident
                  calls.
                </p>
                {hasJira ? (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    Jira connected
                  </div>
                ) : (
                  <Button onClick={handleConnectJira} className="w-full">
                    Connect Jira
                  </Button>
                )}
                <div className="flex gap-2">
                  {hasJira && (
                    <Button onClick={() => setStep(4)} className="flex-1">
                      Continue
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setStep(4)}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Select defaults */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4 — Select Defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasGithub && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="repo">
                      Default Repository
                    </label>
                    <select
                      id="repo"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                    >
                      <option value="">Select a repository...</option>
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {hasJira && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="project">
                      Default Jira Project
                    </label>
                    <select
                      id="project"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                    >
                      <option value="">Select a project...</option>
                      {projects.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name} ({p.key})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!hasGithub && !hasJira && (
                  <p className="text-sm text-muted-foreground">
                    No integrations connected. You can configure defaults later
                    in Settings.
                  </p>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveDefaults}
                    disabled={savingDefaults}
                    className="flex-1"
                  >
                    {savingDefaults ? "Saving..." : "Finish Setup"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard")}
                    className="flex-1"
                  >
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}

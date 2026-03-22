"use client";

import { useEffect, useState } from "react";
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

interface IntegrationStatus {
  has_github: boolean;
  has_jira: boolean;
  github_default_repo: string | null;
  jira_default_project_key: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const statusResp = await api.get("/api/integrations/status");
        const s: IntegrationStatus = statusResp.data;
        setStatus(s);

        if (s.github_default_repo) setSelectedRepo(s.github_default_repo);
        if (s.jira_default_project_key) setSelectedProject(s.jira_default_project_key);

        if (s.has_github) {
          const repoResp = await api.get("/api/integrations/github/repos");
          setRepos(repoResp.data);
        }
        if (s.has_jira) {
          const projResp = await api.get("/api/integrations/jira/projects");
          setProjects(projResp.data);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
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
      setToast("Settings saved.");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast("Failed to save. Please try again.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

          {toast && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              {toast}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Default Repository */}
              <Card>
                <CardHeader>
                  <CardTitle>Default Repository</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {status?.has_github ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        The repository Sprynt will investigate during incidents.
                      </p>
                      <select
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
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Connect GitHub on the{" "}
                      <a
                        href="/integrations"
                        className="underline hover:text-foreground"
                      >
                        Integrations
                      </a>{" "}
                      page to configure a default repository.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Default Jira Project */}
              <Card>
                <CardHeader>
                  <CardTitle>Default Jira Project</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {status?.has_jira ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        The Jira project where extracted tasks will be synced.
                      </p>
                      <select
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
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Connect Jira on the{" "}
                      <a
                        href="/integrations"
                        className="underline hover:text-foreground"
                      >
                        Integrations
                      </a>{" "}
                      page to configure a default project.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Voice Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Voice Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Voice interaction settings will be available in a future
                    update.
                  </p>
                </CardContent>
              </Card>

              {(status?.has_github || status?.has_jira) && (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              )}
            </div>
          )}
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}

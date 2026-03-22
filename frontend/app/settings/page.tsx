"use client";

import { useState } from "react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGithubRepos, useJiraProjects } from "@/hooks/useIntegrations";
import {
  useUpdateWorkspaceDefaults,
  useWorkspaceDefaults,
} from "@/hooks/useWorkspaceDefaults";

export default function SettingsPage() {
  const [defaultRepo, setDefaultRepo] = useState<string>("");
  const [defaultProject, setDefaultProject] = useState<string>("");
  const githubRepos = useGithubRepos();
  const jiraProjects = useJiraProjects();
  const defaults = useWorkspaceDefaults();
  const saveDefaults = useUpdateWorkspaceDefaults();

  const effectiveRepo = defaultRepo || defaults.data?.default_repo || "";
  const effectiveProject =
    defaultProject || defaults.data?.default_jira_project_key || "";

  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Workspace defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default repository</label>
                  <Select
                    value={effectiveRepo}
                    onValueChange={(value) => setDefaultRepo(value ?? "")}
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

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default Jira project</label>
                  <Select
                    value={effectiveProject}
                    onValueChange={(value) => setDefaultProject(value ?? "")}
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

                <Button
                  onClick={() =>
                    saveDefaults.mutate({
                      default_repo: effectiveRepo || undefined,
                      default_jira_project_key: effectiveProject || undefined,
                    })
                  }
                  disabled={saveDefaults.isPending}
                >
                  {saveDefaults.isPending ? "Saving..." : "Save settings"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voice preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline">Coming in Sprint 3</Badge>
                <p className="text-sm text-muted-foreground">
                  Voice synthesis and playback controls will be enabled in the next sprint.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGithubRepos,
  useIntegrationStatus,
  useJiraProjects,
} from "@/hooks/useIntegrations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useUpdateWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/api";

const workspaceSchema = z.object({
  name: z.string().min(2, "Workspace name is required"),
});

type WorkspaceForm = z.infer<typeof workspaceSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");

  const workspaces = useWorkspaces();
  const integrations = useIntegrationStatus();
  const githubRepos = useGithubRepos(integrations.data?.has_github ?? false);
  const jiraProjects = useJiraProjects(integrations.data?.has_jira ?? false);
  const updateDefaults = useUpdateWorkspaceDefaults();

  const workspace = workspaces.data?.[0] ?? null;
  const effectiveWorkspaceId = workspaceId ?? workspace?.id ?? null;

  const form = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: "" },
  });

  const githubHref = effectiveWorkspaceId
    ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/integrations/github/connect?workspace_id=${effectiveWorkspaceId}`
    : "#";
  const jiraHref = effectiveWorkspaceId
    ? `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/integrations/jira/connect?workspace_id=${effectiveWorkspaceId}`
    : "#";

  const completion = useMemo(() => {
    return {
      workspace: Boolean(effectiveWorkspaceId),
      github: integrations.data?.has_github ?? false,
      jira: integrations.data?.has_jira ?? false,
      defaults: Boolean(selectedRepo || selectedProject),
    };
  }, [effectiveWorkspaceId, integrations.data, selectedRepo, selectedProject]);

  const createWorkspace = async (values: WorkspaceForm) => {
    const { data } = await api.post<Workspace>("/api/workspaces", values);
    setWorkspaceId(data.id);
    await workspaces.refetch();
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  const handleSaveDefaults = async () => {
    await updateDefaults.mutateAsync({
      default_repo: selectedRepo || undefined,
      default_jira_project_key: selectedProject || undefined,
    });
    handleFinish();
  };

  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Onboarding</h1>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Create workspace</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={form.handleSubmit(createWorkspace)}>
                  <Input placeholder="Platform Team" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                  <Button type="submit" disabled={form.formState.isSubmitting || completion.workspace}>
                    {completion.workspace ? "Workspace ready" : "Create workspace"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 2: Connect GitHub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={completion.github ? "secondary" : "outline"}>
                  {completion.github ? "Connected" : "Not connected"}
                </Badge>
                <Button
                  disabled={!completion.workspace}
                  onClick={() => {
                    window.location.href = githubHref;
                  }}
                >
                  Connect GitHub
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 3: Connect Jira</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={completion.jira ? "secondary" : "outline"}>
                  {completion.jira ? "Connected" : "Not connected"}
                </Badge>
                <Button
                  disabled={!completion.workspace}
                  onClick={() => {
                    window.location.href = jiraHref;
                  }}
                >
                  Connect Jira
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 4: Select defaults</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default repository</label>
                  <Select
                    value={selectedRepo}
                    onValueChange={(value) => setSelectedRepo(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose repo" />
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
                    value={selectedProject}
                    onValueChange={(value) => setSelectedProject(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose project" />
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
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Button
              onClick={handleSaveDefaults}
              disabled={updateDefaults.isPending}
            >
              {updateDefaults.isPending ? "Saving..." : "Finish onboarding"}
            </Button>
            <Button variant="outline" onClick={handleFinish}>
              Skip for now
            </Button>
          </div>
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}

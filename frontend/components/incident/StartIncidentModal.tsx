"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGithubRepos } from "@/hooks/useIntegrations";
import { useWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";
import { api } from "@/lib/api";
import type { Incident } from "@/types/api";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  severity: z.enum(["P1", "P2", "P3", "P4"]),
  repo_full_name: z.string().min(1, "Repository is required"),
  meeting_link: z.url("Meeting link must be a valid URL"),
});

type FormValues = z.infer<typeof schema>;

type StartIncidentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function StartIncidentModal({ open, onOpenChange, workspaceId }: StartIncidentModalProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const githubRepos = useGithubRepos(open);
  const defaults = useWorkspaceDefaults(open);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      severity: "P2",
      repo_full_name: "",
      meeting_link: "",
    },
  });

  const meetingLinkValue = useWatch({ control: form.control, name: "meeting_link" }) ?? "";
  const titleValue = useWatch({ control: form.control, name: "title" }) ?? "";
  const severityValue = useWatch({ control: form.control, name: "severity" }) ?? "P2";
  const repoFullNameValue = useWatch({ control: form.control, name: "repo_full_name" }) ?? "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const defaultRepo = defaults.data?.default_repo ?? "";
    if (!defaultRepo) {
      return;
    }
    if (form.getValues("repo_full_name")) {
      return;
    }
    form.setValue("repo_full_name", defaultRepo, {
      shouldValidate: true,
      shouldDirty: false,
    });
  }, [defaults.data?.default_repo, form, open]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      const { data } = await api.post<Incident>("/api/incidents", {
        workspace_id: workspaceId,
        title: values.title,
        severity: values.severity,
        repo_full_name: values.repo_full_name,
        meeting_link: values.meeting_link,
      });
      onOpenChange(false);
      router.push(`/incidents/${data.id}`);
    } catch (error) {
      console.error(error);
      setSubmitError("Unable to start incident. Please try again.");
    }
  };

  const isStartDisabled =
    form.formState.isSubmitting ||
    !meetingLinkValue.trim() ||
    !titleValue.trim() ||
    !repoFullNameValue.trim();

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset({
        title: "",
        severity: "P2",
        repo_full_name: "",
        meeting_link: "",
      });
      setSubmitError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Incident</DialogTitle>
          <DialogDescription>
            Create a new incident room and start live collaboration.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="title">
              Title
            </label>
            <Input id="title" placeholder="API error rate spike" {...form.register("title")} />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Severity</label>
            <Select
              value={severityValue}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                const nextSeverity = value as FormValues["severity"];
                form.setValue("severity", nextSeverity, {
                  shouldValidate: true,
                });
              }}
            >
              <SelectTrigger className="w-full" aria-label="Incident severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P1">P1</SelectItem>
                <SelectItem value="P2">P2</SelectItem>
                <SelectItem value="P3">P3</SelectItem>
                <SelectItem value="P4">P4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Repository</label>
            <Select
              value={repoFullNameValue}
              onValueChange={(value) => {
                const nextRepo = value ?? "";
                form.setValue("repo_full_name", nextRepo, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
            >
              <SelectTrigger className="w-full" aria-label="Incident repository">
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
            {form.formState.errors.repo_full_name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.repo_full_name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="meeting_link">
              Meeting link
            </label>
            <Input
              id="meeting_link"
              placeholder="https://meet.google.com/..."
              {...form.register("meeting_link")}
            />
            {form.formState.errors.meeting_link ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.meeting_link.message}
              </p>
            ) : null}
          </div>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={isStartDisabled}>
              {form.formState.isSubmitting ? "Starting..." : "Start Incident"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

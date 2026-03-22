"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Incident } from "@/types/api";

const schema = z.object({
  title: z.string().min(2, "Title is required"),
  severity: z.enum(["P1", "P2", "P3", "P4"]),
  meeting_link: z.union([z.literal(""), z.url("Meeting link must be a valid URL")]),
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
  const [severity, setSeverity] = useState<FormValues["severity"]>("P2");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      severity: "P2",
      meeting_link: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      const { data } = await api.post<Incident>("/api/incidents", {
        workspace_id: workspaceId,
        title: values.title,
        severity: values.severity,
        meeting_link: values.meeting_link || null,
      });
      onOpenChange(false);
      form.reset();
      setSeverity("P2");
      router.push(`/incidents/${data.id}`);
    } catch (error) {
      console.error(error);
      setSubmitError("Unable to start incident. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              value={severity}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                const nextSeverity = value as FormValues["severity"];
                setSeverity(nextSeverity);
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
            <label className="text-sm font-medium" htmlFor="meeting_link">
              Meeting link (optional)
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

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Starting..." : "Start Incident"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

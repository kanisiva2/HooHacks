"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";
import { useIncidentStore } from "@/stores/incidentStore";
import { confidenceToPercentage, statusToColorClass } from "@/lib/utils";
import { useApproveTask, useDismissTask } from "@/hooks/useTasks";
import type { ActionItem, TaskStatus } from "@/types/api";

type TaskBoardProps = {
  incidentId: string;
  isLoading?: boolean;
};

const columns: { status: TaskStatus; label: string }[] = [
  { status: "proposed", label: "Proposed" },
  { status: "synced", label: "Synced" },
];

export function TaskBoard({ incidentId, isLoading }: TaskBoardProps) {
  const actionItems = useIncidentStore((store) => store.actionItems);
  const approveTask = useApproveTask();
  const dismissTask = useDismissTask();
  const defaults = useWorkspaceDefaults();
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});

  const visibleItems = actionItems.filter(
    (item) => item.status !== "dismissed" && item.status !== "closed",
  );
  const showSkeletons = Boolean(isLoading) && visibleItems.length === 0;

  const handleApprove = (taskId: string) => {
    approveTask.mutate(
      { incidentId, taskId },
      {
        onSuccess: (data) => {
          if (data.sync_error) {
            setSyncErrors((prev) => ({ ...prev, [taskId]: data.sync_error! }));
          } else {
            setSyncErrors((prev) => {
              const next = { ...prev };
              delete next[taskId];
              return next;
            });
          }
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Task Board</h2>
      </div>
      {!showSkeletons && visibleItems.length === 0 ? (
        <div className="px-4 pt-3">
          <p className="text-xs text-muted-foreground">No tasks extracted yet.</p>
        </div>
      ) : null}
      <div className="grid flex-1 gap-3 overflow-x-auto p-4 md:grid-cols-2">
        {columns.map((column) => {
          const items = visibleItems
            .filter((item) => item.status === column.status)
            .sort((a, b) => +new Date(a.proposed_at) - +new Date(b.proposed_at));

          return (
            <section
              key={column.status}
              className="min-h-[260px] rounded-lg border bg-muted/30 p-3"
            >
              <header className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.label}</h3>
                <Badge variant="outline" aria-label={`${column.label} task count`}>
                  {showSkeletons ? 0 : items.length}
                </Badge>
              </header>
              <div className="space-y-2">
                {showSkeletons ? (
                  <>
                    <TaskSkeleton />
                    <TaskSkeleton />
                  </>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items yet.</p>
                ) : (
                  items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      defaults={defaults.data}
                      syncError={syncErrors[item.id] ?? item.sync_error}
                      onApprove={() => handleApprove(item.id)}
                      onDismiss={() =>
                        dismissTask.mutate({ incidentId, taskId: item.id })
                      }
                      isApproving={approveTask.isPending}
                      isDismissing={dismissTask.isPending}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

type TaskCardProps = {
  item: ActionItem;
  defaults:
    | {
        jira_site_url: string | null;
      }
    | undefined;
  syncError?: string | null;
  onApprove: () => void;
  onDismiss: () => void;
  isApproving: boolean;
  isDismissing: boolean;
};

function TaskCard({
  item,
  defaults,
  syncError,
  onApprove,
  onDismiss,
  isApproving,
  isDismissing,
}: TaskCardProps) {
  return (
    <article className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">{item.normalized_task}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" aria-label={`Owner ${item.owner ?? "Unassigned"}`}>
          {item.owner ?? "Unassigned"}
        </Badge>
        {item.priority ? (
          <Badge
            className={statusToColorClass(item.priority)}
            variant="secondary"
            aria-label={`Priority ${item.priority}`}
          >
            {item.priority}
          </Badge>
        ) : null}
        {item.confidence !== null ? (
          <Badge variant="secondary" aria-label={`Confidence ${confidenceToPercentage(item.confidence)}`}>
            {confidenceToPercentage(item.confidence)}
          </Badge>
        ) : null}
      </div>
      {syncError && item.status === "proposed" && (
        <div className="rounded bg-red-50 px-2 py-1 dark:bg-red-950/30">
          <Badge variant="destructive" className="text-[10px]">
            Sync failed
          </Badge>
          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
            {syncError}
          </p>
        </div>
      )}
      {item.jira_issue_key && defaults?.jira_site_url ? (
        <a
          className="text-xs text-blue-600 hover:underline"
          href={`${defaults.jira_site_url}/browse/${item.jira_issue_key}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.jira_issue_key}
        </a>
      ) : item.jira_issue_key ? (
        <span className="text-xs text-muted-foreground">
          {item.jira_issue_key}
        </span>
      ) : null}
      {item.status === "proposed" && (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="default"
            disabled={isApproving || isDismissing}
            onClick={onApprove}
            aria-label={`Approve task ${item.normalized_task}`}
          >
            {syncError ? "Retry" : "Approve"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={isApproving || isDismissing}
            onClick={onDismiss}
            aria-label={`Dismiss task ${item.normalized_task}`}
          >
            Dismiss
          </Button>
        </div>
      )}
    </article>
  );
}

function TaskSkeleton() {
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

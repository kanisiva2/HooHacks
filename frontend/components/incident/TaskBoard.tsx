"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
          <ListChecks className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Task Board</h2>
        {visibleItems.length > 0 && (
          <span className="ml-auto text-[10px] font-medium tabular-nums text-slate-400">
            {visibleItems.length} task{visibleItems.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {!showSkeletons && visibleItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
            <ListChecks className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-600">No tasks extracted yet</p>
          <p className="mt-1 text-[11px] text-slate-400">Action items from the call will appear here.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 md:grid-cols-2">
          {columns.map((column) => {
            const items = visibleItems
              .filter((item) => item.status === column.status)
              .sort((a, b) => +new Date(a.proposed_at) - +new Date(b.proposed_at));

            return (
              <section
                key={column.status}
                className="flex min-h-0 flex-col rounded-xl border border-slate-200/70 bg-slate-50/50 p-3"
              >
                <header className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">{column.label}</h3>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/80 px-1.5 text-[10px] font-bold tabular-nums text-slate-500">
                    {showSkeletons ? 0 : items.length}
                  </span>
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {showSkeletons ? (
                    <>
                      <TaskSkeleton />
                      <TaskSkeleton />
                    </>
                  ) : items.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-slate-400">No items yet.</p>
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
      )}
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
    <article className="space-y-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm">
      <p className="text-[13px] font-medium leading-snug text-slate-800">{item.normalized_task}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-slate-200 text-[10px]" aria-label={`Owner ${item.owner ?? "Unassigned"}`}>
          {item.owner ?? "Unassigned"}
        </Badge>
        {item.priority ? (
          <Badge
            className={statusToColorClass(item.priority) + " text-[10px]"}
            variant="secondary"
            aria-label={`Priority ${item.priority}`}
          >
            {item.priority}
          </Badge>
        ) : null}
        {item.confidence !== null ? (
          <Badge variant="secondary" className="text-[10px]" aria-label={`Confidence ${confidenceToPercentage(item.confidence)}`}>
            {confidenceToPercentage(item.confidence)}
          </Badge>
        ) : null}
      </div>
      {syncError && item.status === "proposed" && (
        <div className="rounded-lg bg-red-50 px-2 py-1.5 dark:bg-red-950/30">
          <Badge variant="destructive" className="text-[10px]">
            Sync failed
          </Badge>
          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
            {syncError}
          </p>
        </div>
      )}
      {item.jira_issue_key ? (
        defaults?.jira_site_url ? (
          <a
            className="text-xs font-medium text-blue-600 hover:underline"
            href={`${defaults.jira_site_url}/browse/${item.jira_issue_key}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.jira_issue_key}
          </a>
        ) : (
          <p className="text-xs font-medium text-blue-600">
            {item.jira_issue_key}
          </p>
        )
      ) : null}
      {item.status === "proposed" && (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="default"
            disabled={isApproving || isDismissing}
            onClick={onApprove}
            className="rounded-lg bg-slate-950 text-[11px] hover:bg-slate-800"
            aria-label={`Approve task ${item.normalized_task}`}
          >
            {syncError ? "Retry" : "Approve"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={isApproving || isDismissing}
            onClick={onDismiss}
            className="rounded-lg text-[11px] text-slate-500"
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
    <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white p-3">
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

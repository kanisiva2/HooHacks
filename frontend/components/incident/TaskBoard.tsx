"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";
import { useIncidentStore } from "@/stores/incidentStore";
import { confidenceToPercentage, statusToColorClass } from "@/lib/utils";
import { useApproveTask, useDismissTask } from "@/hooks/useTasks";
import type { ActionItem, TaskStatus } from "@/types/api";

type TaskBoardProps = {
  incidentId: string;
};

const columns: { status: TaskStatus; label: string }[] = [
  { status: "proposed", label: "Proposed" },
  { status: "synced", label: "Synced" },
];

export function TaskBoard({ incidentId }: TaskBoardProps) {
  const actionItems = useIncidentStore((store) => store.actionItems);
  const approveTask = useApproveTask();
  const dismissTask = useDismissTask();
  const defaults = useWorkspaceDefaults();

  const visibleItems = actionItems.filter(
    (item) => item.status !== "dismissed" && item.status !== "closed",
  );

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Task Board</h2>
      </div>
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
                <Badge variant="outline">{items.length}</Badge>
              </header>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No items yet.</p>
                ) : (
                  items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      incidentId={incidentId}
                      defaults={defaults.data}
                      onApprove={() =>
                        approveTask.mutate({ incidentId, taskId: item.id })
                      }
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
  incidentId: string;
  defaults: { jira_site_url?: string } | undefined;
  onApprove: () => void;
  onDismiss: () => void;
  isApproving: boolean;
  isDismissing: boolean;
};

function TaskCard({
  item,
  defaults,
  onApprove,
  onDismiss,
  isApproving,
  isDismissing,
}: TaskCardProps) {
  return (
    <article className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">{item.normalized_task}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{item.owner ?? "Unassigned"}</Badge>
        {item.priority ? (
          <Badge
            className={statusToColorClass(item.priority)}
            variant="secondary"
          >
            {item.priority}
          </Badge>
        ) : null}
        {item.confidence !== null ? (
          <Badge variant="secondary">
            {confidenceToPercentage(item.confidence)}
          </Badge>
        ) : null}
      </div>
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
          >
            Approve
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={isApproving || isDismissing}
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </div>
      )}
    </article>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceDefaults } from "@/hooks/useWorkspaceDefaults";
import { useIncidentStore } from "@/stores/incidentStore";
import { confidenceToPercentage, statusToColorClass } from "@/lib/utils";
import { useUpdateTask } from "@/hooks/useTasks";
import type { ActionItem, TaskStatus } from "@/types/api";

type TaskBoardProps = {
  incidentId: string;
};

const columns: { status: TaskStatus; label: string }[] = [
  { status: "proposed", label: "Proposed" },
  { status: "active", label: "Active" },
  { status: "synced", label: "Synced" },
];

export function TaskBoard({ incidentId }: TaskBoardProps) {
  const actionItems = useIncidentStore((store) => store.actionItems);
  const updateTask = useUpdateTask();
  const defaults = useWorkspaceDefaults();

  const moveTask = (task: ActionItem, direction: "left" | "right") => {
    const index = columns.findIndex((column) => column.status === task.status);
    if (index === -1) {
      return;
    }

    const nextIndex = direction === "left" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= columns.length) {
      return;
    }

    const nextStatus = columns[nextIndex].status;
    updateTask.mutate({
      incidentId,
      taskId: task.id,
      status: nextStatus,
    });
  };

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Task Board</h2>
      </div>
      <div className="grid flex-1 gap-3 overflow-x-auto p-4 md:grid-cols-3">
        {columns.map((column) => {
          const items = actionItems
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
                    <article
                      key={item.id}
                      className="space-y-2 rounded-md border bg-background p-3"
                    >
                      <p className="text-sm font-medium">{item.normalized_task}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{item.owner ?? "Unassigned"}</Badge>
                        {item.priority ? (
                          <Badge className={statusToColorClass(item.priority)} variant="secondary">
                            {item.priority}
                          </Badge>
                        ) : null}
                        {item.confidence !== null ? (
                          <Badge variant="secondary">
                            {confidenceToPercentage(item.confidence)}
                          </Badge>
                        ) : null}
                      </div>
                      {item.jira_issue_key && defaults.data?.jira_site_url ? (
                        <a
                          className="text-xs text-blue-600 hover:underline"
                          href={`${defaults.data.jira_site_url}/browse/${item.jira_issue_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.jira_issue_key}
                        </a>
                      ) : item.jira_issue_key ? (
                        <span className="text-xs text-muted-foreground">{item.jira_issue_key}</span>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={column.status === "proposed" || updateTask.isPending}
                          onClick={() => moveTask(item, "left")}
                        >
                          Back
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={column.status === "synced" || updateTask.isPending}
                          onClick={() => moveTask(item, "right")}
                        >
                          Forward
                        </Button>
                      </div>
                    </article>
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

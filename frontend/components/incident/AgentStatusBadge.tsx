"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIncidentStore } from "@/stores/incidentStore";
import type { AgentState } from "@/types/api";
import { toastBotJoined } from "@/lib/toast";

const statusConfig: Record<
  AgentState,
  { label: string; dotClassName: string; badgeVariant: "secondary" | "outline" }
> = {
  idle: {
    label: "Idle",
    dotClassName: "bg-slate-400",
    badgeVariant: "outline",
  },
  joining: {
    label: "Joining",
    dotClassName: "bg-amber-500 animate-pulse",
    badgeVariant: "secondary",
  },
  listening: {
    label: "Listening",
    dotClassName: "bg-emerald-500 animate-pulse",
    badgeVariant: "secondary",
  },
  speaking: {
    label: "Speaking",
    dotClassName: "bg-blue-500 animate-pulse",
    badgeVariant: "secondary",
  },
  investigating: {
    label: "Investigating",
    dotClassName: "bg-violet-500 animate-pulse",
    badgeVariant: "secondary",
  },
  error: {
    label: "Error",
    dotClassName: "bg-red-500 animate-pulse",
    badgeVariant: "secondary",
  },
};

export function AgentStatusBadge() {
  const { state, lastMessage } = useIncidentStore((store) => store.agentStatus);
  const config = statusConfig[state];
  const previousStateRef = useRef<AgentState | null>(null);

  useEffect(() => {
    if (previousStateRef.current === "joining" && state === "listening") {
      toastBotJoined();
    }
    previousStateRef.current = state;
  }, [state]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Badge
        variant={config.badgeVariant}
        className="gap-2"
        aria-label={`Agent status ${config.label}`}
      >
        <span className={cn("h-2 w-2 rounded-full", config.dotClassName)} />
        {config.label}
      </Badge>
      {lastMessage ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground">{lastMessage}</p>
      ) : null}
    </div>
  );
}

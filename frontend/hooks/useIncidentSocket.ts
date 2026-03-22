"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/stores/incidentStore";
import type {
  ActionItem,
  IncidentSocketMessage,
  ActionItemUpdateMessage,
} from "@/types/api";

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 15000;

function toEpochMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = +new Date(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toActionItem(message: ActionItemUpdateMessage): ActionItem {
  return {
    id: message.id ?? message.task_id ?? crypto.randomUUID(),
    incident_id: message.incident_id,
    normalized_task: message.normalized_task,
    owner: message.owner,
    status: message.status,
    priority: message.priority,
    confidence: message.confidence,
    jira_issue_key: message.jira_issue_key,
    proposed_at: message.proposed_at ?? new Date().toISOString(),
  };
}

export function useIncidentSocket(incidentId: string) {
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addTranscriptLine = useIncidentStore((state) => state.addTranscriptLine);
  const upsertActionItem = useIncidentStore((state) => state.upsertActionItem);
  const setSuspectFiles = useIncidentStore((state) => state.setSuspectFiles);
  const setAgentStatus = useIncidentStore((state) => state.setAgentStatus);
  const setIncidentId = useIncidentStore((state) => state.setIncidentId);
  const reset = useIncidentStore((state) => state.reset);

  useEffect(() => {
    if (!incidentId) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
      const socket = new WebSocket(`${wsBase}/ws/${incidentId}`);
      websocketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as IncidentSocketMessage;

          switch (message.type) {
            case "transcript_chunk":
              const timestamp =
                message.timestamp ??
                toEpochMs(message.start_ts ?? message.startTs) ??
                toEpochMs(message.end_ts ?? message.endTs) ??
                toEpochMs(message.received_at ?? message.receivedAt) ??
                Date.now();
              addTranscriptLine({
                id: `${incidentId}-${message.speaker}-${timestamp}-${message.text.slice(0, 24)}`,
                speaker: message.speaker,
                text: message.text,
                is_final: message.is_final,
                timestamp,
              });
              break;
            case "action_item_update":
              upsertActionItem(toActionItem(message));
              break;
            case "deep_dive_update":
              setSuspectFiles(message.results);
              break;
            case "agent_status":
              setAgentStatus(message.status, message.last_message);
              break;
            default:
              break;
          }
        } catch (error) {
          console.error("Failed to parse incident socket message", error);
        }
      };

      socket.onclose = () => {
        if (!isMounted) {
          return;
        }

        reconnectAttemptsRef.current += 1;
        const delay = Math.min(
          WS_RECONNECT_BASE_MS * 2 ** reconnectAttemptsRef.current,
          WS_RECONNECT_MAX_MS,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      socket.onerror = (error) => {
        console.error("Incident socket error", error);
      };
    };

    setIncidentId(incidentId);
    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      reset();
    };
  }, [
    incidentId,
    addTranscriptLine,
    upsertActionItem,
    setSuspectFiles,
    setAgentStatus,
    setIncidentId,
    reset,
  ]);
}

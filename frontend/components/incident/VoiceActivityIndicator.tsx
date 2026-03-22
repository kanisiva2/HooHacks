"use client";

import { useIncidentStore } from "@/stores/incidentStore";

/**
 * Pulses three blue dots when Sprynt is speaking (audio queue is non-empty).
 * Place alongside AgentStatusBadge in the incident room layout.
 */
export function VoiceActivityIndicator() {
  const isActive = useIncidentStore((s) => s.audioQueue.length > 0);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-blue-400">
      <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:75ms]" />
      <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
      <span className="sr-only">Sprynt is speaking</span>
    </div>
  );
}

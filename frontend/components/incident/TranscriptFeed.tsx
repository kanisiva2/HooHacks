"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/stores/incidentStore";
import { formatRelativeTime } from "@/lib/utils";

export function TranscriptFeed() {
  const transcript = useIncidentStore((store) => store.transcript);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">Transcript</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {transcript.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Transcript chunks will appear here once the agent starts listening.
          </p>
        ) : (
          transcript.map((line) => (
            <article
              key={line.id}
              className={line.is_final ? "text-sm" : "text-sm italic text-muted-foreground"}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-semibold">{line.speaker}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(line.timestamp)}
                </span>
              </div>
              <p>{line.text}</p>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

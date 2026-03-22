"use client";

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { useIncidentStore } from "@/stores/incidentStore";
import { formatRelativeTime } from "@/lib/utils";

const speakerColors = [
  "bg-blue-50 text-blue-600",
  "bg-amber-50 text-amber-600",
  "bg-emerald-50 text-emerald-600",
  "bg-rose-50 text-rose-600",
  "bg-violet-50 text-violet-600",
  "bg-cyan-50 text-cyan-600",
  "bg-orange-50 text-orange-600",
  "bg-teal-50 text-teal-600",
];

function speakerColorClass(speaker: string) {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  return speakerColors[Math.abs(hash) % speakerColors.length];
}

function speakerInitial(speaker: string) {
  return speaker.charAt(0).toUpperCase();
}

export function TranscriptFeed() {
  const transcript = useIncidentStore((store) => store.transcript);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/72 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50">
          <Mic className="h-3.5 w-3.5 text-sky-500" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">Transcript</h2>
        {transcript.length > 0 && (
          <span className="ml-auto text-[10px] font-medium tabular-nums text-slate-400">
            {transcript.length} message{transcript.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {transcript.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
              <Mic className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-600">
              Waiting for bot to join
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Transcript will stream live once the meeting starts.
            </p>
          </div>
        ) : (
          transcript.map((line) => (
            <article
              key={line.id}
              className={`rounded-xl px-3 py-2 transition-colors ${line.is_final ? "hover:bg-slate-50/80" : "opacity-60"}`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${speakerColorClass(line.speaker)}`}
                >
                  {speakerInitial(line.speaker)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      {line.speaker}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeTime(line.timestamp)}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-[13px] leading-relaxed ${line.is_final ? "text-slate-700" : "italic text-slate-400"}`}>
                    {line.text}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

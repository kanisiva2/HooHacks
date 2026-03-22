"use client";

import { useEffect, useRef } from "react";
import { useIncidentStore } from "@/stores/incidentStore";

/**
 * Plays TTS audio URLs from the incident audio queue sequentially.
 * Mount once in the incident room page. On error or rejection, the
 * failed item is dequeued so subsequent audio is never blocked.
 */
export function useAudioPlayer() {
  const audioQueue = useIncidentStore((s) => s.audioQueue);
  const dequeueAudio = useIncidentStore((s) => s.dequeueAudio);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (audioQueue.length === 0 || isPlayingRef.current) return;

    const url = audioQueue[0];
    isPlayingRef.current = true;

    const audio = new Audio(url);
    const done = () => {
      isPlayingRef.current = false;
      dequeueAudio();
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  }, [audioQueue, dequeueAudio]);
}

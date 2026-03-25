import { create } from "zustand";
import type {
  ActionItem,
  AgentState,
  DeepDiveResult,
  TranscriptLine,
} from "@/types/api";

type IncidentStore = {
  incidentId: string | null;
  transcript: TranscriptLine[];
  actionItems: ActionItem[];
  suspectFiles: DeepDiveResult[];
  agentStatus: {
    state: AgentState;
    lastMessage: string | null;
    timestamp: number;
  };
  connectionStatus: "connecting" | "connected" | "reconnecting" | "disconnected";
  setIncidentId: (incidentId: string | null) => void;
  setTranscript: (lines: TranscriptLine[]) => void;
  addTranscriptLine: (line: Omit<TranscriptLine, "id"> & { id?: string }) => void;
  upsertActionItem: (item: ActionItem) => void;
  setSuspectFiles: (files: DeepDiveResult[]) => void;
  setAgentStatus: (state: AgentState, lastMessage: string | null) => void;
  setConnectionStatus: (
    status: "connecting" | "connected" | "reconnecting" | "disconnected",
  ) => void;
  reset: () => void;
};

const initialState = {
  incidentId: null,
  transcript: [] as TranscriptLine[],
  actionItems: [] as ActionItem[],
  suspectFiles: [] as DeepDiveResult[],
  agentStatus: {
    state: "idle" as AgentState,
    lastMessage: null,
    timestamp: Date.now(),
  },
  connectionStatus: "connecting" as const,
};

export const useIncidentStore = create<IncidentStore>((set) => ({
  ...initialState,
  setIncidentId: (incidentId) => set({ incidentId }),
  setTranscript: (lines) => set({ transcript: lines }),
  addTranscriptLine: (line) =>
    set((state) => ({
      transcript: state.transcript.some(
        (existing) =>
          existing.speaker === line.speaker &&
          existing.text === line.text &&
          existing.is_final === line.is_final &&
          existing.timestamp === line.timestamp,
      )
        ? state.transcript
        : [
            ...state.transcript,
            {
              id:
                line.id ??
                `${line.timestamp}-${line.speaker}-${state.transcript.length + 1}`,
              ...line,
            },
          ],
    })),
  upsertActionItem: (item) =>
    set((state) => {
      const index = state.actionItems.findIndex((existing) => existing.id === item.id);
      if (index === -1) {
        return { actionItems: [...state.actionItems, item] };
      }

      const updated = [...state.actionItems];
      updated[index] = {
        ...updated[index],
        ...item,
      };
      return { actionItems: updated };
    }),
  setSuspectFiles: (files) => set({ suspectFiles: files }),
  setAgentStatus: (state, lastMessage) =>
    set({
      agentStatus: {
        state,
        lastMessage,
        timestamp: Date.now(),
      },
    }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  reset: () => set({ ...initialState }),
}));

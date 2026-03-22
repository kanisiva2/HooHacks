import { create } from "zustand";

type ActivePanel = "transcript" | "tasks" | "deep-dive";
type ModalName = "startIncident";

type UIStore = {
  isSidebarOpen: boolean;
  activePanel: ActivePanel;
  isDesktop: boolean;
  modals: Record<ModalName, boolean>;
  toggleSidebar: () => void;
  setActivePanel: (panel: ActivePanel) => void;
  setIsDesktop: (isDesktop: boolean) => void;
  setModalOpen: (modal: ModalName, open: boolean) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: false,
  activePanel: "transcript",
  isDesktop: false,
  modals: {
    startIncident: false,
  },
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActivePanel: (activePanel) => set({ activePanel }),
  setIsDesktop: (isDesktop) => set({ isDesktop }),
  setModalOpen: (modal, open) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [modal]: open,
      },
    })),
}));

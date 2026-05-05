import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

interface SessionState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
    }),
    { name: "ledgerbuddy:session" }
  )
);

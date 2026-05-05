import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TenantId, UserId } from "@/types/ids";

export type ThemeMode = "light" | "dark";

export interface AuthUser {
  id: UserId;
  email: string;
  role: string;
}

export interface AuthTenant {
  id: TenantId;
  name: string;
  mode?: "test" | "live";
}

export interface SessionFlags {
  mustChangePassword: boolean;
  requiresTenantSetup: boolean;
}

interface SessionState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  flags: SessionFlags;
  accessToken: string | null;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setAccessToken: (token: string | null) => void;
  setSession: (input: { user: AuthUser; tenant: AuthTenant; flags: SessionFlags }) => void;
  clearSession: () => void;
}

const DEFAULT_FLAGS: SessionFlags = {
  mustChangePassword: false,
  requiresTenantSetup: false
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      user: null,
      tenant: null,
      flags: DEFAULT_FLAGS,
      accessToken: null,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setAccessToken: (token) => set({ accessToken: token }),
      setSession: ({ user, tenant, flags }) => set({ user, tenant, flags }),
      clearSession: () =>
        set({ user: null, tenant: null, flags: DEFAULT_FLAGS, accessToken: null })
    }),
    { name: "ledgerbuddy:session" }
  )
);

export function selectIsAuthenticated(state: SessionState): boolean {
  return state.accessToken !== null && state.user !== null;
}

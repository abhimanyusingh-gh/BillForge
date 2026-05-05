import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClientOrgId, TenantId, UserId } from "@/types/ids";

export type ThemeMode = "light" | "dark" | "system";

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

const RECENT_CLIENT_ORG_CAP = 5;

interface SessionState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  flags: SessionFlags;
  accessToken: string | null;
  currentClientOrgId: ClientOrgId | null;
  recentClientOrgIds: ClientOrgId[];
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setAccessToken: (token: string | null) => void;
  setSession: (input: { user: AuthUser; tenant: AuthTenant; flags: SessionFlags }) => void;
  setCurrentClientOrg: (id: ClientOrgId) => void;
  clearSession: () => void;
}

const DEFAULT_FLAGS: SessionFlags = {
  mustChangePassword: false,
  requiresTenantSetup: false
};

function pushRecent(prev: ClientOrgId[], id: ClientOrgId): ClientOrgId[] {
  const next = [id, ...prev.filter((existing) => existing !== id)];
  return next.slice(0, RECENT_CLIENT_ORG_CAP);
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      user: null,
      tenant: null,
      flags: DEFAULT_FLAGS,
      accessToken: null,
      currentClientOrgId: null,
      recentClientOrgIds: [],
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setAccessToken: (token) => set({ accessToken: token }),
      setSession: ({ user, tenant, flags }) => set({ user, tenant, flags }),
      setCurrentClientOrg: (id) =>
        set((state) => ({
          currentClientOrgId: id,
          recentClientOrgIds: pushRecent(state.recentClientOrgIds, id)
        })),
      clearSession: () =>
        set({
          user: null,
          tenant: null,
          flags: DEFAULT_FLAGS,
          accessToken: null,
          currentClientOrgId: null,
          recentClientOrgIds: []
        })
    }),
    { name: "ledgerbuddy:session" }
  )
);

export function selectIsAuthenticated(state: SessionState): boolean {
  return state.accessToken !== null && state.user !== null;
}

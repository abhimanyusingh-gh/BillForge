import { useCallback, useEffect, useRef, useState } from "react";
import type { TenantViewTab } from "@/types";

export const TAB_HASH_PATH = {
  overview: "#/overview",
  dashboard: "#/invoices",
  exports: "#/exports",
  statements: "#/reconciliation",
  config: "#/settings",
  connections: "#/connections"
} as const;

const HASH_TO_TAB: Record<string, TenantViewTab> = {
  "#/overview": "overview",
  "#/invoices": "dashboard",
  "#/exports": "exports",
  "#/reconciliation": "statements",
  "#/settings": "config",
  "#/connections": "connections"
};

export interface HashRouteMigration {
  oldPath: string;
  newPath: string;
}

function readHashTab(): TenantViewTab | null {
  const raw = window.location.hash;
  if (!raw) {
    return null;
  }
  return HASH_TO_TAB[raw] ?? null;
}

function readLegacyQueryTab(): { tab: TenantViewTab; oldPath: string } | null {
  const params = new URLSearchParams(window.location.search);
  const legacy = params.get("tab");
  if (!legacy) {
    return null;
  }
  const tabs: TenantViewTab[] = ["overview", "dashboard", "exports", "statements", "config", "connections"];
  if ((tabs as string[]).includes(legacy)) {
    return { tab: legacy as TenantViewTab, oldPath: `?tab=${legacy}` };
  }
  return null;
}

interface UseTabHashRoutingOptions {
  activeTab: TenantViewTab;
  onTabChange: (tab: TenantViewTab) => void;
}

interface UseTabHashRoutingResult {
  migration: HashRouteMigration | null;
  dismissMigration: () => void;
}

export function useTabHashRouting({ activeTab, onTabChange }: UseTabHashRoutingOptions): UseTabHashRoutingResult {
  const [migration, setMigration] = useState<HashRouteMigration | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;

      const legacy = readLegacyQueryTab();
      if (legacy) {
        const newPath = TAB_HASH_PATH[legacy.tab];
        setMigration({ oldPath: legacy.oldPath, newPath });
        const params = new URLSearchParams(window.location.search);
        params.delete("tab");
        const search = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${search ? `?${search}` : ""}${newPath}`
        );
        if (legacy.tab !== activeTab) {
          onTabChange(legacy.tab);
        }
        return;
      }

      const fromHash = readHashTab();
      if (fromHash && fromHash !== activeTab) {
        onTabChange(fromHash);
        return;
      }
    }

    const expected = TAB_HASH_PATH[activeTab];
    if (window.location.hash !== expected) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${expected}`);
    }
  }, [activeTab, onTabChange]);

  useEffect(() => {
    const handler = () => {
      const next = readHashTab();
      if (next && next !== activeTab) {
        onTabChange(next);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [activeTab, onTabChange]);

  const dismissMigration = useCallback(() => setMigration(null), []);

  return { migration, dismissMigration };
}

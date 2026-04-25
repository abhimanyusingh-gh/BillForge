import { useEffect, useRef, useState } from "react";
import type { TenantViewTab } from "@/types";
import {
  HASH_TO_TAB,
  LEGACY_QUERY_TABS,
  TAB_HASH_PATH,
  readStandaloneHashRoute
} from "@/features/workspace/tabHashConfig";

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
  if ((LEGACY_QUERY_TABS as string[]).includes(legacy)) {
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

      if (readStandaloneHashRoute(window.location.hash)) {
        return;
      }

      const fromHash = readHashTab();
      if (fromHash && fromHash !== activeTab) {
        onTabChange(fromHash);
        return;
      }
    }

    if (readStandaloneHashRoute(window.location.hash)) {
      return;
    }

    const expected = TAB_HASH_PATH[activeTab];
    if (window.location.hash !== expected) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${expected}`);
    }
  }, [activeTab, onTabChange]);

  useEffect(() => {
    const handler = () => {
      if (readStandaloneHashRoute(window.location.hash)) {
        return;
      }
      const next = readHashTab();
      if (next && next !== activeTab) {
        onTabChange(next);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [activeTab, onTabChange]);

  return { migration };
}

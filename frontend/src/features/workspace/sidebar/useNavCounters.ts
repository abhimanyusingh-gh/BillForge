import { useEffect, useState } from "react";
import { workspaceService } from "@/api/workspaceService";
import { useSessionStore } from "@/state/sessionStore";
import type { ClientOrgId, TenantId } from "@/types/ids";

const POLL_INTERVAL_MS = 60_000;

interface NavCounters {
  action: number;
  triage: number;
  isLoading: boolean;
}

const ZERO_COUNTERS: NavCounters = { action: 0, triage: 0, isLoading: false };
const INITIAL: NavCounters = { action: 0, triage: 0, isLoading: true };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function loadActionRequired(
  tenantId: TenantId,
  clientOrgId: ClientOrgId | null,
  signal: AbortSignal
): Promise<number> {
  if (clientOrgId === null) return 0;
  return workspaceService.fetchActionRequiredCount(tenantId, clientOrgId, signal);
}

export function useNavCounters(): NavCounters {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [state, setState] = useState<NavCounters>(INITIAL);

  useEffect(() => {
    if (tenantId === null) {
      setState(ZERO_COUNTERS);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (tenantId === null) return;
      try {
        const [action, triage] = await Promise.all([
          loadActionRequired(tenantId, clientOrgId, controller.signal),
          workspaceService.fetchTriageCount(tenantId, controller.signal)
        ]);
        if (cancelled) return;
        setState({ action, triage, isLoading: false });
      } catch (caught) {
        if (cancelled || isAbortError(caught)) return;
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    load();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(load, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (typeof document !== "undefined") {
      if (document.visibilityState === "visible") startPolling();
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      controller.abort();
      stopPolling();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [tenantId, clientOrgId]);

  return state;
}

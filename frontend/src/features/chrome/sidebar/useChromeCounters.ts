import { useEffect, useState } from "react";
import { chromeService } from "@/api/chromeService";

const POLL_INTERVAL_MS = 60_000;

interface CountersState {
  action: number;
  triage: number;
  isLoading: boolean;
}

const INITIAL: CountersState = { action: 0, triage: 0, isLoading: true };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useChromeCounters(): CountersState {
  const [state, setState] = useState<CountersState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const [action, triage] = await Promise.all([
          chromeService.fetchActionRequiredCount(controller.signal),
          chromeService.fetchTriageCount(controller.signal)
        ]);
        if (cancelled) return;
        setState({ action, triage, isLoading: false });
      } catch (caught) {
        if (cancelled || isAbortError(caught)) return;
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

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
  }, []);

  return state;
}

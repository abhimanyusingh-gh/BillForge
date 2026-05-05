import { useEffect, useMemo, useState } from "react";
import { clientOrgService, type ClientOrg } from "@/api/clientOrgService";
import { useSessionStore } from "@/state/sessionStore";

interface ClientOrgsState {
  orgs: ClientOrg[];
  recent: ClientOrg[];
  isLoading: boolean;
  error: string | null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useClientOrgs(enabled: boolean): ClientOrgsState {
  const recentIds = useSessionStore((state) => state.recentClientOrgIds);
  const [orgs, setOrgs] = useState<ClientOrg[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    clientOrgService
      .listClientOrgs(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setOrgs(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled || isAbortError(caught)) return;
        const message = caught instanceof Error ? caught.message : "Failed to load client orgs.";
        setError(message);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  const recent = useMemo<ClientOrg[]>(() => {
    if (recentIds.length === 0 || orgs.length === 0) return [];
    const byId = new Map(orgs.map((org) => [org.id, org]));
    return recentIds.flatMap((id) => {
      const match = byId.get(id);
      return match ? [match] : [];
    });
  }, [orgs, recentIds]);

  return { orgs, recent, isLoading, error };
}

import { useEffect, useMemo, useState } from "react";
import { clientOrgService } from "@/api/clientOrgService";
import type { ClientOrg } from "@/domain/workspace/clientOrg";
import type { TenantId } from "@/types/ids";
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

let inFlight: { tenantId: TenantId; promise: Promise<ClientOrg[]> } | null = null;

function loadOnce(tenantId: TenantId): Promise<ClientOrg[]> {
  if (inFlight !== null && inFlight.tenantId === tenantId) return inFlight.promise;
  const promise = clientOrgService.listClientOrgs(tenantId).finally(() => {
    if (inFlight !== null && inFlight.tenantId === tenantId) inFlight = null;
  });
  inFlight = { tenantId, promise };
  return promise;
}

export function useClientOrgs(enabled: boolean): ClientOrgsState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const recentIds = useSessionStore((state) => state.recentClientOrgIds);
  const cachedOrgs = useSessionStore((state) => state.clientOrgs);
  const setClientOrgs = useSessionStore((state) => state.setClientOrgs);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (tenantId === null) return;
    if (cachedOrgs !== null) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadOnce(tenantId)
      .then((result) => {
        if (cancelled) return;
        setClientOrgs(result);
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
    };
  }, [enabled, tenantId, cachedOrgs, setClientOrgs]);

  const orgs = cachedOrgs ?? [];
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

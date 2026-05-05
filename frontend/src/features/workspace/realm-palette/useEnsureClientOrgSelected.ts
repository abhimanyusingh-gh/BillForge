import { useEffect } from "react";
import { useClientOrgs } from "@/features/workspace/realm-palette/useClientOrgs";
import { useSessionStore } from "@/state/sessionStore";

export function useEnsureClientOrgSelected(): void {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const currentClientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const setCurrentClientOrg = useSessionStore((state) => state.setCurrentClientOrg);
  const shouldFetch = tenantId !== null && currentClientOrgId === null;
  const { orgs, isLoading } = useClientOrgs(shouldFetch);

  useEffect(() => {
    if (!shouldFetch) return;
    if (isLoading) return;
    if (orgs.length === 0) return;
    setCurrentClientOrg(orgs[0].id);
  }, [shouldFetch, isLoading, orgs, setCurrentClientOrg]);
}

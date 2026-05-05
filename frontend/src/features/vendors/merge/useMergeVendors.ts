import { useCallback, useState } from "react";
import { vendorService, type MergeResponse } from "@/api/vendorService";
import type { VendorId } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface MergeVendorsState {
  isMerging: boolean;
  error: string | null;
  merge: (targetVendorId: VendorId, sourceVendorId: VendorId) => Promise<MergeResponse>;
  reset: () => void;
}

export function useMergeVendors(): MergeVendorsState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const merge = useCallback(
    async (targetVendorId: VendorId, sourceVendorId: VendorId): Promise<MergeResponse> => {
      if (tenantId === null || clientOrgId === null) {
        const message = "Cannot merge vendors without active tenant + client org.";
        setError(message);
        throw new Error(message);
      }
      setIsMerging(true);
      setError(null);
      try {
        return await vendorService.mergeVendors(tenantId, clientOrgId, targetVendorId, { sourceVendorId });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to merge vendors.";
        setError(message);
        throw caught;
      } finally {
        setIsMerging(false);
      }
    },
    [tenantId, clientOrgId]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { isMerging, error, merge, reset };
}

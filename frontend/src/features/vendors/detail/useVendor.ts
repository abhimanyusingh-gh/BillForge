import { useCallback, useEffect, useState } from "react";
import { vendorService } from "@/api/vendorService";
import type { VendorDetail, VendorId } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface VendorState {
  vendor: VendorDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useVendor(vendorId: VendorId | null): VendorState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (tenantId === null || clientOrgId === null || vendorId === null) {
      setVendor(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    vendorService
      .getVendor(tenantId, clientOrgId, vendorId, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setVendor(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled || isAbortError(caught)) return;
        const message = caught instanceof Error ? caught.message : "Failed to load vendor.";
        setError(message);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantId, clientOrgId, vendorId, reloadKey]);

  const refetch = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return { vendor, isLoading, error, refetch };
}

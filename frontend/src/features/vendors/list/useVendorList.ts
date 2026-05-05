import { useCallback, useEffect, useState } from "react";
import { vendorService } from "@/api/vendorService";
import type { VendorListFilters, VendorListPage } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface VendorListState {
  page: VendorListPage | null;
  filters: VendorListFilters;
  isLoading: boolean;
  error: string | null;
  setFilters: (next: VendorListFilters) => void;
  refetch: () => void;
}

const EMPTY_FILTERS: VendorListFilters = {};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useVendorList(): VendorListState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [page, setPage] = useState<VendorListPage | null>(null);
  const [filters, setFilters] = useState<VendorListFilters>(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    if (tenantId === null || clientOrgId === null) {
      setPage(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    vendorService
      .listVendors(tenantId, clientOrgId, filters, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setPage(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled || isAbortError(caught)) return;
        const message = caught instanceof Error ? caught.message : "Failed to load vendors.";
        setError(message);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantId, clientOrgId, filters, reloadKey]);

  const refetch = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return { page, filters, isLoading, error, setFilters, refetch };
}

import { useCallback, useEffect, useState } from "react";
import { invoiceService } from "@/api/invoiceService";
import type {
  Invoice,
  InvoiceListFilters,
  InvoiceStatus
} from "@/domain/invoice/invoice";
import { useSessionStore } from "@/state/sessionStore";

interface InvoiceListState {
  invoices: Invoice[];
  total: number;
  isLoading: boolean;
  error: string | null;
  filters: InvoiceListFilters;
  setStatus: (status: InvoiceStatus | "all") => void;
  setSearch: (search: string) => void;
  setDateRange: (from: string | undefined, to: string | undefined) => void;
  refresh: () => void;
}

const DEFAULT_FILTERS: InvoiceListFilters = {
  status: "all",
  page: 1,
  limit: 50
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function applySearchClient(invoices: Invoice[], search: string | undefined): Invoice[] {
  if (!search || search.trim().length === 0) return invoices;
  const q = search.trim().toLowerCase();
  return invoices.filter((inv) =>
    inv.vendor.toLowerCase().includes(q) ||
    inv.invoiceNumber.toLowerCase().includes(q) ||
    (inv.parsed.gstin ?? "").toLowerCase().includes(q)
  );
}

export function useInvoiceList(): InvoiceListState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [filters, setFilters] = useState<InvoiceListFilters>(DEFAULT_FILTERS);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  useEffect(() => {
    if (tenantId === null || clientOrgId === null) return;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    invoiceService
      .listInvoices(tenantId, clientOrgId, filters, controller.signal)
      .then((response) => {
        setInvoices(response.items);
        setTotal(response.total);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        const message = caught instanceof Error ? caught.message : "Failed to load invoices.";
        setError(message);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [tenantId, clientOrgId, filters, refreshNonce]);

  const setStatus = useCallback((status: InvoiceStatus | "all") => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const setDateRange = useCallback((from: string | undefined, to: string | undefined) => {
    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to, page: 1 }));
  }, []);

  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  return {
    invoices: applySearchClient(invoices, filters.search),
    total,
    isLoading,
    error,
    filters,
    setStatus,
    setSearch,
    setDateRange,
    refresh
  };
}

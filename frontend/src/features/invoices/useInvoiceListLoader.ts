import { useCallback, useRef, useState } from "react";
import { fetchInvoices } from "@/api";
import { getUserFacingErrorMessage, isAuthenticationError } from "@/lib/common/apiError";
import type { Invoice } from "@/types";

interface UseInvoiceListLoaderArgs {
  statusFilter: string;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  approvedByFilter: string;
  currentPage: number;
  pageSize: number;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  setTotalInvoices: (n: number) => void;
  reconcileWithLoaded: (items: Invoice[]) => void;
  activeId: string | null;
  popupInvoiceId: string | null;
  setActiveId: (id: string | null) => void;
  setPopupInvoiceId: (id: string | null) => void;
  refreshActiveInvoiceDetail: () => Promise<void>;
  refreshPopupInvoiceDetail: () => Promise<void>;
  onNavCountsChange: (counts: { total: number; approved: number; pending: number; failed: number }) => void;
  onSessionExpired: () => void;
}

interface UseInvoiceListLoaderResult {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  allStatusCounts: Record<string, number>;
  loadInvoices: () => Promise<void>;
}

export function useInvoiceListLoader(args: UseInvoiceListLoaderArgs): UseInvoiceListLoaderResult {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStatusCounts, setAllStatusCounts] = useState<Record<string, number>>({});

  const argsRef = useRef(args);
  argsRef.current = args;

  const loadInvoices = useCallback(async () => {
    const a = argsRef.current;
    setLoading(true);
    setError(null);
    try {
      const statusParam = a.statusFilter === "ALL" ? undefined
        : a.statusFilter === "FAILED" ? "FAILED_OCR,FAILED_PARSE"
        : a.statusFilter;
      const data = await fetchInvoices({
        status: statusParam,
        from: a.invoiceDateFrom || undefined,
        to: a.invoiceDateTo || undefined,
        page: a.currentPage,
        limit: a.pageSize,
        approvedBy: a.approvedByFilter || undefined,
        sortBy: a.sortColumn || undefined,
        sortDir: a.sortColumn ? a.sortDirection : undefined
      });
      setInvoices(data.items);
      a.setTotalInvoices(data.total);
      a.onNavCountsChange({
        total: data.totalAll ?? data.total,
        approved: data.approvedAll ?? 0,
        pending: data.pendingAll ?? 0,
        failed: data.failedAll ?? 0
      });
      if (a.statusFilter === "ALL") {
        setAllStatusCounts({
          ALL: data.totalAll ?? data.total,
          PARSED: data.parsedAll ?? 0,
          NEEDS_REVIEW: data.needsReviewAll ?? 0,
          AWAITING_APPROVAL: data.awaitingApprovalAll ?? 0,
          FAILED: (data.failedOcrAll ?? 0) + (data.failedParseAll ?? 0),
          APPROVED: data.approvedAll ?? 0,
          EXPORTED: data.exportedAll ?? 0
        });
      }
      const ids = new Set(data.items.map((item) => item._id));
      a.reconcileWithLoaded(data.items);
      if (a.activeId && !ids.has(a.activeId)) {
        a.setActiveId(data.items[0]?._id ?? null);
      }
      if (a.popupInvoiceId && !ids.has(a.popupInvoiceId)) {
        a.setPopupInvoiceId(null);
      }
      if (a.activeId && ids.has(a.activeId)) {
        void a.refreshActiveInvoiceDetail();
      }
      if (a.popupInvoiceId && ids.has(a.popupInvoiceId)) {
        void a.refreshPopupInvoiceDetail();
      }
    } catch (loadError) {
      if (isAuthenticationError(loadError)) {
        a.onSessionExpired();
      } else {
        setError(getUserFacingErrorMessage(loadError, "Failed to fetch invoices."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { invoices, loading, error, setError, allStatusCounts, loadInvoices };
}

import { useCallback, useEffect, useState } from "react";
import { invoiceService } from "@/api/invoiceService";
import type { Invoice, InvoiceId } from "@/domain/invoice/invoice";
import { useSessionStore } from "@/state/sessionStore";

interface InvoiceState {
  invoice: Invoice | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  previewUrl: string | null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useInvoice(invoiceId: InvoiceId | null): InvoiceState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  useEffect(() => {
    if (tenantId === null || clientOrgId === null || invoiceId === null) {
      setInvoice(null);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    invoiceService
      .getInvoice(tenantId, clientOrgId, invoiceId, controller.signal)
      .then((result) => {
        setInvoice(result);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isAbortError(caught)) return;
        const message = caught instanceof Error ? caught.message : "Failed to load invoice.";
        setError(message);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [tenantId, clientOrgId, invoiceId, reloadNonce]);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  const previewUrl =
    tenantId !== null && clientOrgId !== null && invoiceId !== null
      ? invoiceService.previewUrl(tenantId, clientOrgId, invoiceId)
      : null;

  return { invoice, isLoading, error, reload, previewUrl };
}

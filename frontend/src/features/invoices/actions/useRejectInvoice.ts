import { useCallback, useState } from "react";
import { invoiceService } from "@/api/invoiceService";
import type { InvoiceId } from "@/domain/invoice/invoice";
import { useSessionStore } from "@/state/sessionStore";

interface RejectState {
  isRejecting: boolean;
  error: string | null;
  reject: (id: InvoiceId, reason: string) => Promise<boolean>;
}

export function useRejectInvoice(onRejected?: () => void): RejectState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reject = useCallback(
    async (id: InvoiceId, reason: string): Promise<boolean> => {
      if (tenantId === null || clientOrgId === null) return false;
      if (reason.trim().length === 0) {
        setError("Reason is required to reject an invoice.");
        return false;
      }
      setIsRejecting(true);
      setError(null);
      try {
        await invoiceService.workflowReject(tenantId, clientOrgId, id, reason.trim());
        setIsRejecting(false);
        onRejected?.();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Rejection failed.";
        setError(message);
        setIsRejecting(false);
        return false;
      }
    },
    [tenantId, clientOrgId, onRejected]
  );

  return { isRejecting, error, reject };
}

import { useCallback, useState } from "react";
import { invoiceService } from "@/api/invoiceService";
import type { InvoiceId } from "@/domain/invoice/invoice";
import { useSessionStore } from "@/state/sessionStore";

interface ApproveState {
  isApproving: boolean;
  error: string | null;
  approve: (ids: InvoiceId[]) => Promise<number>;
  workflowApprove: (id: InvoiceId, comment?: string) => Promise<boolean>;
}

export function useApproveInvoices(onApproved?: () => void): ApproveState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(
    async (ids: InvoiceId[]): Promise<number> => {
      if (tenantId === null || clientOrgId === null || ids.length === 0) return 0;
      setIsApproving(true);
      setError(null);
      try {
        const result = await invoiceService.approveInvoices(tenantId, clientOrgId, ids);
        setIsApproving(false);
        onApproved?.();
        return result.modifiedCount;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Approval failed.";
        setError(message);
        setIsApproving(false);
        return 0;
      }
    },
    [tenantId, clientOrgId, onApproved]
  );

  const workflowApprove = useCallback(
    async (id: InvoiceId, comment?: string): Promise<boolean> => {
      if (tenantId === null || clientOrgId === null) return false;
      setIsApproving(true);
      setError(null);
      try {
        await invoiceService.workflowApprove(tenantId, clientOrgId, id, comment);
        setIsApproving(false);
        onApproved?.();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Workflow approval failed.";
        setError(message);
        setIsApproving(false);
        return false;
      }
    },
    [tenantId, clientOrgId, onApproved]
  );

  return { isApproving, error, approve, workflowApprove };
}

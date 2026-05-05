import { useCallback, useState } from "react";
import { invoiceService, type UpdateInvoicePayload } from "@/api/invoiceService";
import type { InvoiceId } from "@/domain/invoice/invoice";
import { useSessionStore } from "@/state/sessionStore";

interface EditState {
  isSaving: boolean;
  error: string | null;
  save: (invoiceId: InvoiceId, payload: UpdateInvoicePayload) => Promise<boolean>;
}

export function useEditInvoice(onSaved?: () => void): EditState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (invoiceId: InvoiceId, payload: UpdateInvoicePayload): Promise<boolean> => {
      if (tenantId === null || clientOrgId === null) {
        setError("Active tenant or client org is missing.");
        return false;
      }
      setIsSaving(true);
      setError(null);
      try {
        await invoiceService.updateInvoice(tenantId, clientOrgId, invoiceId, payload);
        setIsSaving(false);
        onSaved?.();
        return true;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to update invoice.";
        setError(message);
        setIsSaving(false);
        return false;
      }
    },
    [tenantId, clientOrgId, onSaved]
  );

  return { isSaving, error, save };
}

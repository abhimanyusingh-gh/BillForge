import { useCallback, useState } from "react";
import { vendorService } from "@/api/vendorService";
import type { VendorDetail, VendorEditableFields, VendorId } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface EditVendorState {
  isSaving: boolean;
  error: string | null;
  edit: (vendorId: VendorId, fields: VendorEditableFields) => Promise<VendorDetail | null>;
  reset: () => void;
}

export function useEditVendor(): EditVendorState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const edit = useCallback(
    async (vendorId: VendorId, fields: VendorEditableFields): Promise<VendorDetail | null> => {
      if (tenantId === null || clientOrgId === null) {
        const message = "Cannot edit vendor without active tenant + client org.";
        setError(message);
        throw new Error(message);
      }
      setIsSaving(true);
      setError(null);
      try {
        return await vendorService.editVendor(tenantId, clientOrgId, vendorId, fields);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to update vendor.";
        setError(message);
        throw caught;
      } finally {
        setIsSaving(false);
      }
    },
    [tenantId, clientOrgId]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { isSaving, error, edit, reset };
}

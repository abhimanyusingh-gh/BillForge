import { useCallback, useState } from "react";
import { DuplicateVendorError, vendorService, type CreateVendorInput } from "@/api/vendorService";
import type { VendorDetail } from "@/domain/vendor/vendor";
import { useSessionStore } from "@/state/sessionStore";

interface CreateVendorState {
  isSubmitting: boolean;
  error: string | null;
  existingVendor: VendorDetail | null;
  submit: (input: CreateVendorInput) => Promise<VendorDetail | null>;
  reset: () => void;
}

export function useCreateVendor(): CreateVendorState {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [existingVendor, setExistingVendor] = useState<VendorDetail | null>(null);

  const submit = useCallback(
    async (input: CreateVendorInput): Promise<VendorDetail | null> => {
      if (tenantId === null || clientOrgId === null) {
        const message = "Cannot create vendor without active tenant + client org.";
        setError(message);
        throw new Error(message);
      }
      setIsSubmitting(true);
      setError(null);
      setExistingVendor(null);
      try {
        return await vendorService.createVendor(tenantId, clientOrgId, input);
      } catch (caught) {
        if (caught instanceof DuplicateVendorError) {
          setExistingVendor(caught.existingVendor);
          setError(caught.message);
          return null;
        }
        const message = caught instanceof Error ? caught.message : "Failed to create vendor.";
        setError(message);
        throw caught;
      } finally {
        setIsSubmitting(false);
      }
    },
    [tenantId, clientOrgId]
  );

  const reset = useCallback(() => {
    setError(null);
    setExistingVendor(null);
  }, []);

  return { isSubmitting, error, existingVendor, submit, reset };
}

import { useCallback, useEffect } from "react";
import {
  useAdminRealmStore,
  syncAdminRealmFromUrl,
  readAdminRealmFromUrl
} from "@/stores/adminRealmStore";

export { ADMIN_CLIENT_ORG_QUERY_PARAM } from "@/stores/adminRealmStore";

interface UseAdminClientOrgFilterResult {
  clientOrgId: string | null;
  setClientOrgId: (id: string | null) => void;
}

export function useAdminClientOrgFilter(): UseAdminClientOrgFilterResult {
  const storeId = useAdminRealmStore((s) => s.id);
  const setAdminRealm = useAdminRealmStore((s) => s.setAdminRealm);
  // URL is the source of truth. Read it synchronously during render so the first frame is correct, even if the store hasn't been re-synced yet (test lifecycle, hard nav).
  const clientOrgId = readAdminRealmFromUrl() ?? storeId;
  useEffect(() => { syncAdminRealmFromUrl(); }, []);
  const setClientOrgId = useCallback((id: string | null) => setAdminRealm(id), [setAdminRealm]);
  return { clientOrgId, setClientOrgId };
}

import { useMemo } from "react";
import { fetchInvoices } from "@/api";
import { useScopedQuery } from "@/lib/query/useScopedQuery";
import { useActiveClientOrg } from "@/hooks/useActiveClientOrg";
import {
  buildActionQueue,
  totalActionCount,
  type ActionQueueGroup
} from "@/lib/invoice/actionRequired";

const ACTION_QUEUE_PAGE_SIZE = 500;
const ACTION_QUEUE_STALE_MS = 15_000;
export const ACTION_QUEUE_QUERY_KEY = ["invoices", "action-required"] as const;

interface UseActionRequiredQueueResult {
  groups: ActionQueueGroup[];
  totalCount: number;
  scannedCount: number;
  totalAvailable: number;
  isLoading: boolean;
  isError: boolean;
  isRealmActive: boolean;
  refetch: () => Promise<unknown>;
}

export function useActionRequiredQueue(): UseActionRequiredQueueResult {
  const { activeClientOrgId } = useActiveClientOrg();
  const isRealmActive = activeClientOrgId !== null;
  const query = useScopedQuery({
    queryKey: ACTION_QUEUE_QUERY_KEY,
    queryFn: () => fetchInvoices(undefined, undefined, undefined, 1, ACTION_QUEUE_PAGE_SIZE),
    staleTime: ACTION_QUEUE_STALE_MS
  });

  const groups = useMemo(
    () => (query.data ? buildActionQueue(query.data.items) : []),
    [query.data]
  );

  return {
    groups,
    totalCount: totalActionCount(groups),
    scannedCount: query.data?.items.length ?? 0,
    totalAvailable: query.data?.total ?? 0,
    isLoading: query.isPending && isRealmActive,
    isError: query.isError,
    isRealmActive,
    refetch: query.refetch
  };
}

import { useQuery } from "@tanstack/react-query";
import {
  fetchTriageInvoices,
  TRIAGE_QUEUE_QUERY_KEY,
  type TriageInvoice
} from "@/api/triage";

// The triage queue is the ONE accounting-leaf list that legitimately filters by
// `tenantId` WITHOUT `clientOrgId` — these invoices have `clientOrgId: null`
// because the mailbox couldn't decide which realm they belong to. Documented
// exception per #156. We deliberately use plain `useQuery` (NOT `useScopedQuery`)
// so the request fires regardless of which (if any) realm is active.
interface UseTriageQueueResult {
  invoices: TriageInvoice[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => Promise<unknown>;
}

export function useTriageQueue(): UseTriageQueueResult {
  const query = useQuery({
    queryKey: TRIAGE_QUEUE_QUERY_KEY,
    queryFn: fetchTriageInvoices,
    staleTime: 0
  });
  return {
    invoices: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: query.refetch
  };
}

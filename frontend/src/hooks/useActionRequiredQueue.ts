import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInvoices } from "@/api";
import {
  buildActionQueue,
  totalActionCount,
  type ActionQueueGroup
} from "@/lib/invoice/actionRequired";

const ACTION_QUEUE_PAGE_SIZE = 100;
const ACTION_QUEUE_STALE_MS = 15_000;
const ACTION_QUEUE_QUERY_KEY = ["invoices", "action-required"] as const;

interface UseActionRequiredQueueResult {
  groups: ActionQueueGroup[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useActionRequiredQueue(): UseActionRequiredQueueResult {
  const query = useQuery({
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
    isLoading: query.isPending,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    }
  };
}

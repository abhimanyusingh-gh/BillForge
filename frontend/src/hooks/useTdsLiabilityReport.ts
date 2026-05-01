import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  TDS_LIABILITY_QUERY_KEY,
  fetchTdsLiabilityReport,
  type TdsLiabilityQuery,
  type TdsLiabilityReport
} from "@/api/reports";
import { useTenantSetupCompleted } from "@/hooks/useTenantSetupCompleted";

export function useTdsLiabilityReport(query: TdsLiabilityQuery): UseQueryResult<TdsLiabilityReport> {
  const tenantSetupCompleted = useTenantSetupCompleted();
  return useQuery({
    queryKey: [TDS_LIABILITY_QUERY_KEY, query.fy, query.quarter ?? null, query.vendorFingerprint ?? null, query.section ?? null],
    queryFn: () => fetchTdsLiabilityReport(query),
    enabled: tenantSetupCompleted,
    staleTime: 30_000
  });
}

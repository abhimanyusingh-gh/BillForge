import { ApiError, apiClient } from "@/api/client";
import { urls } from "@/api/urlBuilder";
import type { ClientOrgId, TenantId } from "@/types/ids";

interface CountResponse {
  total?: number;
}

function readTotal(response: CountResponse | null | undefined): number {
  const total = response?.total;
  return typeof total === "number" && Number.isFinite(total) && total >= 0 ? total : 0;
}

async function fetchActionRequiredCount(
  tenantId: TenantId,
  clientOrgId: ClientOrgId,
  signal?: AbortSignal
): Promise<number> {
  const response = await apiClient.get<CountResponse>(
    urls.tenant(tenantId).clientOrg(clientOrgId).invoices.actionRequired({ pageSize: 1 }),
    { signal }
  );
  return readTotal(response);
}

async function fetchTriageCount(tenantId: TenantId, signal?: AbortSignal): Promise<number> {
  try {
    const response = await apiClient.get<CountResponse>(
      urls.tenant(tenantId).invoices.triage({ pageSize: 1 }),
      { signal }
    );
    return readTotal(response);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 403) {
      return 0;
    }
    throw caught;
  }
}

export const workspaceService = {
  fetchActionRequiredCount,
  fetchTriageCount
};

import { apiClient } from "@/api/client";
import { urls } from "@/api/urlBuilder";
import type { ClientOrg } from "@/domain/workspace/clientOrg";
import { asClientOrgId, type TenantId } from "@/types/ids";

interface RawClientOrg {
  _id?: string;
  companyName?: string | null;
  gstin?: string;
  stateName?: string | null;
  archivedAt?: string | null;
}

interface ListResponse {
  items?: RawClientOrg[];
}

function toClientOrg(raw: RawClientOrg): ClientOrg | null {
  if (typeof raw._id !== "string" || raw._id.length === 0) return null;
  if (typeof raw.gstin !== "string") return null;
  return {
    id: asClientOrgId(raw._id),
    companyName: typeof raw.companyName === "string" && raw.companyName.length > 0 ? raw.companyName : raw.gstin,
    gstin: raw.gstin,
    stateName: typeof raw.stateName === "string" ? raw.stateName : null
  };
}

async function listClientOrgs(tenantId: TenantId, signal?: AbortSignal): Promise<ClientOrg[]> {
  const response = await apiClient.get<ListResponse>(
    urls.tenant(tenantId).admin.clientOrgs.list({ includeArchived: false }),
    { signal }
  );
  const raw = Array.isArray(response?.items) ? response.items : [];
  return raw.flatMap((item) => {
    const mapped = toClientOrg(item);
    return mapped ? [mapped] : [];
  });
}

export const clientOrgService = {
  listClientOrgs
};

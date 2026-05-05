import { apiClient } from "@/api/client";
import { chromeUrls } from "@/api/chromeUrls";
import type { ClientOrg } from "@/domain/chrome/clientOrg";
import { asClientOrgId } from "@/types/ids";

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

async function listClientOrgs(signal?: AbortSignal): Promise<ClientOrg[]> {
  const response = await apiClient.get<ListResponse>(chromeUrls.clientOrgs(), { signal });
  const raw = Array.isArray(response?.items) ? response.items : [];
  return raw.flatMap((item) => {
    const mapped = toClientOrg(item);
    return mapped ? [mapped] : [];
  });
}

export const clientOrgService = {
  listClientOrgs
};

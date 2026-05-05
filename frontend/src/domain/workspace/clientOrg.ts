import type { ClientOrgId } from "@/types/ids";

export interface ClientOrg {
  id: ClientOrgId;
  companyName: string;
  gstin: string;
  stateName: string | null;
}

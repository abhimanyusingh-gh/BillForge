import type { ClientOrgId, TenantId } from "@/types/ids";

export const workspaceUrls = {
  clientOrgs: (tenantId: TenantId): string =>
    `/api/tenants/${tenantId}/admin/client-orgs?includeArchived=false`,
  triageCount: (tenantId: TenantId): string =>
    `/api/tenants/${tenantId}/invoices/triage?pageSize=1`,
  actionRequiredCount: (tenantId: TenantId, clientOrgId: ClientOrgId): string =>
    `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/action-required?pageSize=1`
} as const;

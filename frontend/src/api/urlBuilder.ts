import type { InvoiceId } from "@/domain/invoice/invoice";
import type { ClientOrgId, TenantId } from "@/types/ids";

interface QueryBag {
  readonly [key: string]: string | number | boolean | undefined;
}

function serializeQuery(query?: QueryBag): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

interface AuthUrls {
  login: () => string;
  refresh: () => string;
  changePassword: () => string;
}

interface SessionUrls {
  current: () => string;
}

interface TenantAdminClientOrgUrls {
  list: (query?: { includeArchived?: boolean }) => string;
}

interface TenantAdminUrls {
  clientOrgs: TenantAdminClientOrgUrls;
}

interface TenantInvoiceUrls {
  triage: (query?: { pageSize?: number; cursor?: string }) => string;
}

interface ClientOrgInvoiceListQuery extends QueryBag {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  approvedBy?: string;
  sortBy?: string;
  sortDir?: string;
}

interface ClientOrgInvoiceUrls {
  actionRequired: (query?: { pageSize?: number; cursor?: string }) => string;
  list: (query?: ClientOrgInvoiceListQuery) => string;
  byId: (invoiceId: InvoiceId) => string;
  edit: (invoiceId: InvoiceId) => string;
  approveBulk: () => string;
  retry: () => string;
  bulkDelete: () => string;
  workflowApprove: (invoiceId: InvoiceId) => string;
  workflowReject: (invoiceId: InvoiceId) => string;
  retriggerCompliance: (invoiceId: InvoiceId) => string;
  preview: (invoiceId: InvoiceId, query?: { page?: number }) => string;
}

interface ClientOrgUrls {
  invoices: ClientOrgInvoiceUrls;
}

interface TenantUrls {
  admin: TenantAdminUrls;
  invoices: TenantInvoiceUrls;
  clientOrg: (clientOrgId: ClientOrgId) => ClientOrgUrls;
}

interface UrlBuilder {
  auth: AuthUrls;
  session: SessionUrls;
  tenant: (tenantId: TenantId) => TenantUrls;
}

function build(): UrlBuilder {
  return {
    auth: {
      login: () => "/api/auth/token",
      refresh: () => "/api/auth/refresh",
      changePassword: () => "/api/auth/change-password"
    },
    session: {
      current: () => "/api/session"
    },
    tenant: (tenantId: TenantId): TenantUrls => {
      const tenantBase = `/api/tenants/${tenantId}`;
      return {
        admin: {
          clientOrgs: {
            list: (query) => `${tenantBase}/admin/client-orgs${serializeQuery(query)}`
          }
        },
        invoices: {
          triage: (query) => `${tenantBase}/invoices/triage${serializeQuery(query)}`
        },
        clientOrg: (clientOrgId: ClientOrgId): ClientOrgUrls => {
          const clientOrgBase = `${tenantBase}/clientOrgs/${clientOrgId}`;
          const invoicesBase = `${clientOrgBase}/invoices`;
          return {
            invoices: {
              actionRequired: (query) =>
                `${invoicesBase}/action-required${serializeQuery(query)}`,
              list: (query) => `${invoicesBase}${serializeQuery(query)}`,
              byId: (invoiceId) => `${invoicesBase}/${invoiceId}`,
              edit: (invoiceId) => `${invoicesBase}/${invoiceId}`,
              approveBulk: () => `${invoicesBase}/approve`,
              retry: () => `${invoicesBase}/retry`,
              bulkDelete: () => `${invoicesBase}/delete`,
              workflowApprove: (invoiceId) =>
                `${invoicesBase}/${invoiceId}/workflow-approve`,
              workflowReject: (invoiceId) =>
                `${invoicesBase}/${invoiceId}/workflow-reject`,
              retriggerCompliance: (invoiceId) =>
                `${invoicesBase}/${invoiceId}/retrigger-compliance`,
              preview: (invoiceId, query) =>
                `${invoicesBase}/${invoiceId}/preview${serializeQuery(query)}`
            }
          };
        }
      };
    }
  };
}

export const urls: UrlBuilder = build();

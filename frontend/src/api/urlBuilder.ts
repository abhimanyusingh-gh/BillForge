import type { ClientOrgId, TenantId } from "@/types/ids";
import type { VendorId } from "@/domain/vendor/vendor";

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

interface ClientOrgInvoiceUrls {
  actionRequired: (query?: { pageSize?: number; cursor?: string }) => string;
}

interface VendorListQuery extends QueryBag {
  search?: string;
  hasPan?: boolean;
  hasMsme?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

interface ClientOrgVendorUrls {
  list: (query?: VendorListQuery) => string;
  byId: (vendorId: VendorId) => string;
  edit: (vendorId: VendorId) => string;
  cert: (vendorId: VendorId) => string;
  merge: (vendorId: VendorId) => string;
}

interface ClientOrgUrls {
  invoices: ClientOrgInvoiceUrls;
  vendors: ClientOrgVendorUrls;
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
          return {
            invoices: {
              actionRequired: (query) =>
                `${clientOrgBase}/invoices/action-required${serializeQuery(query)}`
            },
            vendors: {
              list: (query) => `${clientOrgBase}/vendors${serializeQuery(query)}`,
              byId: (vendorId) => `${clientOrgBase}/vendors/${vendorId}`,
              edit: (vendorId) => `${clientOrgBase}/vendors/${vendorId}`,
              cert: (vendorId) => `${clientOrgBase}/vendors/${vendorId}/cert`,
              merge: (vendorId) => `${clientOrgBase}/vendors/${vendorId}/merge`
            }
          };
        }
      };
    }
  };
}

export const urls: UrlBuilder = build();

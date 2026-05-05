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

export interface AuthUrls {
  login: () => string;
  refresh: () => string;
  changePassword: () => string;
}

export interface SessionUrls {
  current: () => string;
}

export interface TenantAdminClientOrgUrls {
  list: (query?: { includeArchived?: boolean }) => string;
}

export interface TenantAdminUrls {
  clientOrgs: TenantAdminClientOrgUrls;
}

export interface TenantInvoiceUrls {
  triage: (query?: { pageSize?: number; cursor?: string }) => string;
}

export interface ClientOrgInvoiceUrls {
  actionRequired: (query?: { pageSize?: number; cursor?: string }) => string;
}

export interface ClientOrgUrls {
  invoices: ClientOrgInvoiceUrls;
}

export interface TenantUrls {
  admin: TenantAdminUrls;
  invoices: TenantInvoiceUrls;
  clientOrg: (clientOrgId: ClientOrgId) => ClientOrgUrls;
}

export interface UrlBuilder {
  auth: AuthUrls;
  session: SessionUrls;
  tenant: (tenantId: TenantId) => TenantUrls;
}

function makeUrlBuilder(): UrlBuilder {
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
            }
          };
        }
      };
    }
  };
}

export const urls: UrlBuilder = makeUrlBuilder();

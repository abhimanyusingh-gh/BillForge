import { describe, expect, it } from "vitest";
import { urls } from "@/api/urlBuilder";
import { asInvoiceId } from "@/domain/invoice/invoice";
import { asClientOrgId, asTenantId } from "@/types/ids";

const tenantId = asTenantId("65f0000000000000000000a1");
const clientOrgId = asClientOrgId("69f99e5bddd231bb20bd66c4");
const invoiceId = asInvoiceId("70a0000000000000000001ff");

describe("urlBuilder", () => {
  it("composes global auth + session URLs", () => {
    expect(urls.auth.login()).toBe("/api/auth/token");
    expect(urls.auth.refresh()).toBe("/api/auth/refresh");
    expect(urls.auth.changePassword()).toBe("/api/auth/change-password");
    expect(urls.session.current()).toBe("/api/session");
  });

  it("threads TenantId into tenant-admin clientOrgs.list and serializes query", () => {
    expect(urls.tenant(tenantId).admin.clientOrgs.list({ includeArchived: false })).toBe(
      `/api/tenants/${tenantId}/admin/client-orgs?includeArchived=false`
    );
  });

  it("threads TenantId into tenant-scoped triage URL", () => {
    expect(urls.tenant(tenantId).invoices.triage({ pageSize: 1 })).toBe(
      `/api/tenants/${tenantId}/invoices/triage?pageSize=1`
    );
  });

  it("threads TenantId + ClientOrgId into client-org-scoped action-required URL", () => {
    expect(
      urls.tenant(tenantId).clientOrg(clientOrgId).invoices.actionRequired({ pageSize: 1 })
    ).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/action-required?pageSize=1`
    );
  });

  it("omits the query string when no params are supplied", () => {
    expect(urls.tenant(tenantId).admin.clientOrgs.list()).toBe(
      `/api/tenants/${tenantId}/admin/client-orgs`
    );
    expect(urls.tenant(tenantId).invoices.triage({})).toBe(
      `/api/tenants/${tenantId}/invoices/triage`
    );
  });

  it("URL-encodes query values", () => {
    expect(urls.tenant(tenantId).invoices.triage({ cursor: "a b/c=d" })).toBe(
      `/api/tenants/${tenantId}/invoices/triage?cursor=a%20b%2Fc%3Dd`
    );
  });

  it("rejects raw strings at the type level for branded ID inputs", () => {
    // @ts-expect-error tenant() requires a branded TenantId, not a raw string
    urls.tenant("raw-tenant-string");
    // @ts-expect-error clientOrg() requires a branded ClientOrgId, not a raw string
    urls.tenant(tenantId).clientOrg("raw-client-org-string");
  });

  it("composes invoice list/detail URLs with branded IDs", () => {
    const invoices = urls.tenant(tenantId).clientOrg(clientOrgId).invoices;
    expect(invoices.list({ status: "approved", page: 2, limit: 25 })).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices?status=approved&page=2&limit=25`
    );
    expect(invoices.byId(invoiceId)).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}`
    );
    expect(invoices.edit(invoiceId)).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}`
    );
    expect(invoices.approveBulk()).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/approve`
    );
    expect(invoices.retry()).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/retry`
    );
    expect(invoices.bulkDelete()).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/delete`
    );
    expect(invoices.workflowApprove(invoiceId)).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}/workflow-approve`
    );
    expect(invoices.workflowReject(invoiceId)).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}/workflow-reject`
    );
    expect(invoices.retriggerCompliance(invoiceId)).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}/retrigger-compliance`
    );
    expect(invoices.preview(invoiceId, { page: 2 })).toBe(
      `/api/tenants/${tenantId}/clientOrgs/${clientOrgId}/invoices/${invoiceId}/preview?page=2`
    );
  });
});

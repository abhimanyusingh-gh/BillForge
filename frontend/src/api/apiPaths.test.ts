/**
 * Standalone tests for the URL-shape rewrite helpers consumed by
 * `frontend/src/api/urls/buildNested.ts` (the wrapper used by every
 * `*Urls.ts` provider module). The classifier / per-request rewriter in
 * `client.ts` was retired in #228 Sub-PR E2 — only the pure shape
 * helpers remain.
 */
import { rewriteToNestedShape, rewriteToTenantShape } from "@/api/apiPaths";

describe("api/apiPaths", () => {
  describe("rewriteToNestedShape (realm-scoped: tenants/:tenantId/clientOrgs/:clientOrgId/...)", () => {
    it("rewrites a leading-slash path into the realm-scoped nested shape", () => {
      expect(rewriteToNestedShape("/exports/tally", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/exports/tally"
      );
    });

    it("rewrites the bare prefix path", () => {
      expect(rewriteToNestedShape("/export-config", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/export-config"
      );
    });

    it("preserves the query string (provider passes the full URL through)", () => {
      expect(rewriteToNestedShape("/exports/tally/history?page=2", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/exports/tally/history?page=2"
      );
    });

    it("normalises a missing leading slash by adding one", () => {
      expect(rewriteToNestedShape("exports/tally", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/exports/tally"
      );
    });

    it("rewrites the ingestion upload path", () => {
      expect(rewriteToNestedShape("/jobs/upload/by-keys", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/jobs/upload/by-keys"
      );
    });

    it("rewrites invoice CRUD paths into the realm-scoped nested shape", () => {
      expect(rewriteToNestedShape("/invoices", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/invoices"
      );
      expect(rewriteToNestedShape("/invoices/abc-123", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/invoices/abc-123"
      );
      expect(rewriteToNestedShape("/admin/approval-workflow", "tenant-1", "org-9")).toBe(
        "/tenants/tenant-1/clientOrgs/org-9/admin/approval-workflow"
      );
    });
  });

  describe("rewriteToTenantShape (tenant-scoped: tenants/:tenantId/...)", () => {
    it("rewrites into the /tenants/:tenantId/... shape (no clientOrgId segment)", () => {
      expect(rewriteToTenantShape("/jobs/ingest", "tenant-1")).toBe(
        "/tenants/tenant-1/jobs/ingest"
      );
    });

    it("preserves nested sub-paths and query strings", () => {
      expect(rewriteToTenantShape("/jobs/ingest/status?live=1", "tenant-1")).toBe(
        "/tenants/tenant-1/jobs/ingest/status?live=1"
      );
    });

    it("rewrites the presign endpoint", () => {
      expect(rewriteToTenantShape("/uploads/presign", "tenant-1")).toBe(
        "/tenants/tenant-1/uploads/presign"
      );
    });

    it("rewrites triage list into the tenant-scoped shape (no clientOrgs segment)", () => {
      expect(rewriteToTenantShape("/invoices/triage", "tenant-1")).toBe(
        "/tenants/tenant-1/invoices/triage"
      );
    });

    it("rewrites triage mutations (assign-client-org / reject) into tenant-scoped shape", () => {
      expect(rewriteToTenantShape("/invoices/abc-123/assign-client-org", "tenant-1")).toBe(
        "/tenants/tenant-1/invoices/abc-123/assign-client-org"
      );
      expect(rewriteToTenantShape("/invoices/abc-123/reject", "tenant-1")).toBe(
        "/tenants/tenant-1/invoices/abc-123/reject"
      );
    });

    it("preserves the query string for triage paths", () => {
      expect(rewriteToTenantShape("/invoices/triage?status=PENDING_TRIAGE", "tenant-1")).toBe(
        "/tenants/tenant-1/invoices/triage?status=PENDING_TRIAGE"
      );
    });

    it("normalises a missing leading slash by adding one", () => {
      expect(rewriteToTenantShape("jobs/ingest", "tenant-1")).toBe(
        "/tenants/tenant-1/jobs/ingest"
      );
    });

    it("rewrites tenant-domain admin paths (no clientOrgs segment)", () => {
      expect(rewriteToTenantShape("/admin/users", "tenant-1")).toBe(
        "/tenants/tenant-1/admin/users"
      );
      expect(rewriteToTenantShape("/admin/client-orgs?includeArchived=true", "tenant-1")).toBe(
        "/tenants/tenant-1/admin/client-orgs?includeArchived=true"
      );
    });

    it("rewrites the analytics overview endpoint and preserves the optional clientOrgId query param", () => {
      expect(rewriteToTenantShape("/analytics/overview", "tenant-1")).toBe(
        "/tenants/tenant-1/analytics/overview"
      );
      expect(
        rewriteToTenantShape(
          "/analytics/overview?clientOrgId=65a1b2c3d4e5f6a7b8c9d0e1&from=2026-04-01",
          "tenant-1"
        )
      ).toBe(
        "/tenants/tenant-1/analytics/overview?clientOrgId=65a1b2c3d4e5f6a7b8c9d0e1&from=2026-04-01"
      );
    });
  });
});

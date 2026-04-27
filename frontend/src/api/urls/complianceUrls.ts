import { buildNested } from "@/api/urls/buildNested";

// All compliance endpoints exposed here are realm-scoped (mounted under
// `clientOrgRouter` in `app.ts`: vendors, GL codes, TCS config, client
// compliance config, notification config, approval workflow + limits).
// The unscoped statutory-metadata routes (`/compliance/tds-rates`,
// `/compliance/tds-sections`, `/compliance/risk-signals`) stay on the legacy
// `/api` mount: they have no tenantId/clientOrgId in the path (handlers read
// no tenant context — pure global reference data) and the FE callers in
// `admin.ts` invoke them via the bare path, bypassing the rewriter.
export const complianceUrls = {
  vendorsList: (): string => buildNested("/vendors"),
  vendorUpdate: (id: string): string =>
    buildNested(`/vendors/${encodeURIComponent(id)}`),
  glCodesList: (): string => buildNested("/admin/gl-codes"),
  glCodesCreate: (): string => buildNested("/admin/gl-codes"),
  glCodeUpdate: (code: string): string =>
    buildNested(`/admin/gl-codes/${encodeURIComponent(code)}`),
  glCodeDelete: (code: string): string =>
    buildNested(`/admin/gl-codes/${encodeURIComponent(code)}`),
  glCodesImportCsv: (): string => buildNested("/admin/gl-codes/import-csv"),
  complianceConfig: (): string => buildNested("/admin/compliance-config"),
  notificationConfig: (): string => buildNested("/admin/notification-config"),
  tcsConfig: (): string => buildNested("/admin/tcs-config"),
  tcsConfigRoles: (): string => buildNested("/admin/tcs-config/roles"),
  tcsConfigHistory: (): string => buildNested("/admin/tcs-config/history"),
  approvalWorkflowGet: (): string => buildNested("/admin/approval-workflow"),
  approvalWorkflowUpdate: (): string => buildNested("/admin/approval-workflow"),
  approvalLimitsGet: (): string => buildNested("/admin/approval-limits"),
  approvalLimitsUpdate: (): string => buildNested("/admin/approval-limits")
};

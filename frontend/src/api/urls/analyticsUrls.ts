import { buildTenantNested } from "@/api/urls/buildNested";

// Analytics overview — tenant-scoped. The shared `analyticsRouter` mounts on
// `tenantRouter` only (see `app.ts`); optional realm scoping flows via
// `?clientOrgId=` query param resolved by `resolveOptionalClientOrgId` (#162),
// not via a nested path segment.
export const analyticsUrls = {
  overview: (): string => buildTenantNested("/analytics/overview")
};

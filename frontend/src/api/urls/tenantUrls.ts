import { buildTenantNested } from "@/api/urls/buildNested";

// Tenant administrative user routes — all mounted under `tenantAdminRouter` in
// `app.ts` (path `/api/tenants/:tenantId/admin/users/...`). Tenant-scoped only;
// no clientOrgId in the URL.
//
// `/tenant/onboarding/complete` is deliberately NOT here: it stays on the
// legacy `/api` mount (admin invokes it during invite/setup BEFORE the
// `tenantId` path param is established), so it bypasses the rewriter and
// remains a bare-path caller. Will be retired alongside the legacy mount.
export const tenantUrls = {
  usersList: (): string => buildTenantNested("/admin/users"),
  usersInvite: (): string => buildTenantNested("/admin/users/invite"),
  userRole: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}/role`),
  userDelete: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}`),
  userEnabled: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}/enabled`)
};

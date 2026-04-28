import { buildTenantNested } from "@/api/urls/buildNested";

// Tenant administrative routes — all mounted under `tenantAdminRouter` in
// `app.ts` (path `/api/tenants/:tenantId/...`). Tenant-scoped only; no
// clientOrgId in the URL. `tenantAdminRouter` omits
// `requireTenantSetupCompleted` so onboarding-time calls (e.g.
// `/onboarding/complete`) work BEFORE setup flips to completed.
export const tenantUrls = {
  usersList: (): string => buildTenantNested("/admin/users"),
  usersInvite: (): string => buildTenantNested("/admin/users/invite"),
  userRole: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}/role`),
  userDelete: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}`),
  userEnabled: (userId: string): string =>
    buildTenantNested(`/admin/users/${encodeURIComponent(userId)}/enabled`),
  onboardingComplete: (): string => buildTenantNested("/onboarding/complete"),
  clientOrgsList: (): string => buildTenantNested("/admin/client-orgs"),
  clientOrgsCreate: (): string => buildTenantNested("/admin/client-orgs"),
  clientOrgUpdate: (id: string): string =>
    buildTenantNested(`/admin/client-orgs/${encodeURIComponent(id)}`),
  clientOrgDelete: (id: string): string =>
    buildTenantNested(`/admin/client-orgs/${encodeURIComponent(id)}`),
  clientOrgPreviewArchive: (id: string): string =>
    buildTenantNested(`/admin/client-orgs/${encodeURIComponent(id)}/preview-archive`)
};

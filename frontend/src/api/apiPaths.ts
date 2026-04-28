// URL-shape rewrite helpers consumed by `frontend/src/api/urls/buildNested.ts`.
// The provider modules under `api/urls/*Urls.ts` wrap these helpers (via
// `buildNested` / `buildTenantNested`) so call sites get a fully-rewritten
// URL at construction time. The historical FE classifier and per-request
// rewriter in the axios interceptor were retired in #228 Sub-PR E2 — every
// FE caller now produces a nested URL up front, so the interceptor only
// attaches the auth token.
export function rewriteToNestedShape(path: string, tenantId: string, clientOrgId: string): string {
  return `/tenants/${tenantId}/clientOrgs/${clientOrgId}${path.startsWith("/") ? path : `/${path}`}`;
}

export function rewriteToTenantShape(path: string, tenantId: string): string {
  return `/tenants/${tenantId}${path.startsWith("/") ? path : `/${path}`}`;
}

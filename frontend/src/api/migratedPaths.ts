/**
 * Per-path migrated-shape dispatch for the axios interceptor.
 *
 * The interceptor in `client.ts` calls `classifyMigratedPath(path)` to
 * determine whether a request needs URL rewriting (to nested or
 * tenant-scoped shape) or should pass through unchanged. The legacy
 * `classifyApiPath` / `?clientOrgId=` query-injection layer was removed in
 * #223 once all realm-scoped routes migrated; this module is now the sole
 * URL-shape decision point.
 *
 * Extracted from `client.ts` so the helpers can be unit-tested standalone —
 * `client.ts` pulls in `import.meta.env` which Jest's CJS runtime can't parse.
 *
 * Two prefix lists, two rewrite shapes, one enum dispatcher:
 *   - `MIGRATED_REALM_SCOPED_PREFIXES` → `/tenants/:tenantId/clientOrgs/:clientOrgId/...`
 *     (handlers depend on `req.activeClientOrgId`).
 *   - `MIGRATED_TENANT_SCOPED_PREFIXES` → `/tenants/:tenantId/...`
 *     (tenant-wide; no clientOrgId in the path).
 *   - `classifyMigratedPath(path)` → `MIGRATED_PATH_KIND.{REALM_SCOPED|TENANT_SCOPED|NONE}`
 *     reads both arrays plus the invoice-domain bypass rules.
 */

export const MIGRATED_PATH_KIND = {
  REALM_SCOPED: "realm-scoped",
  TENANT_SCOPED: "tenant-scoped",
  NONE: "none"
} as const;

type MigratedPathKind = typeof MIGRATED_PATH_KIND[keyof typeof MIGRATED_PATH_KIND];

export const MIGRATED_REALM_SCOPED_PREFIXES = [
  // Export domain (#199, sub-PR 1) — first vertical slice migrated.
  "/exports",
  "/export-config",
  // Ingestion domain (#198, sub-PR 2): the upload endpoints carry a
  // clientOrgId in the path. The ingest-orchestration endpoints
  // (`/jobs/ingest{,/status,/sse,/pause,/email-simulate}`) and the presign
  // endpoint are tenant-wide and live in `MIGRATED_TENANT_SCOPED_PREFIXES`.
  "/jobs/upload",
  // Compliance domain (#200) — vendors, GL codes, TCS config, realm-scoped
  // compliance config. The unscoped metadata routes (`/compliance/tds-sections`,
  // `/compliance/risk-signals`, `/compliance/tds-rates`) stay on the legacy
  // mount and are NOT in this list.
  "/vendors",
  "/admin/gl-codes",
  "/admin/tcs-config",
  "/admin/compliance-config",
  // Bank domain (#201, sub-PR 2) — bank accounts + bank statements (the
  // tenant-scoped SSE subscriber endpoint /bank-statements/parse/sse uses
  // EventSource directly and bypasses the axios interceptor, so it stays
  // on the legacy `/api` mount and is NOT included here).
  "/bank/accounts",
  "/bank-accounts",
  "/bank-statements",
  // Invoice domain (#204, final vertical slice — closes #171).
  "/invoices",
  "/admin/approval-workflow",
  "/admin/approval-limits",
  // Notification config (#223 — last realm-scoped prefix off the legacy
  // classifier; ships with the classifier teardown).
  "/admin/notification-config"
] as const;

/**
 * Tenant-scoped (no clientOrgId required) prefixes that have migrated to the
 * new `/api/tenants/:tenantId/...` shape. Rewrites WITHOUT a
 * `/clientOrgs/:clientOrgId` segment — these routes are tenant-wide.
 */
export const MIGRATED_TENANT_SCOPED_PREFIXES = [
  // Ingestion domain (#198, sub-PR 2) — tenant-wide orchestration + presign.
  "/jobs/ingest",
  "/uploads/presign",
  // Tenant domain (#203, sub-PR) — administrative + integration routes that
  // operate on the tenant itself (admin CRUD, integrations).
  "/admin/users",
  "/admin/mailboxes",
  "/admin/client-orgs",
  "/admin/mailbox-assignments",
  // Notification log (#223) — split out from the realm-scoped notification-config
  // router; tenant-wide and admin-only (no clientOrgId in the path).
  "/admin/notifications/log",
  "/integrations/gmail",
  // Analytics domain (#222, sub-PR B of #171) — single overview endpoint.
  // Optional realm scoping flows via `?clientOrgId=` query param; the BE
  // resolves it via `resolveOptionalClientOrgId`, so no realm-scoped mount.
  "/analytics/overview"
] as const;

/**
 * Sub-paths under a realm-scoped prefix that are actually tenant-scoped
 * (PENDING_TRIAGE invoices carry `clientOrgId: null` per the documented
 * composite-key exception #156, exposed via #166 triage endpoints). These
 * rewrite to `/tenants/:tenantId/...` (no `/clientOrgs/:clientOrgId`
 * segment) — the BE mounts them under `tenantRouter` directly.
 */
const MIGRATED_TENANT_SCOPED_BYPASS_PREFIXES = [
  "/invoices/triage"
] as const;

/**
 * Suffix-based bypasses for triage mutations under realm-scoped trees:
 * `/invoices/:id/assign-client-org` and `/invoices/:id/reject`. The check
 * is suffix + must-also-sit-under a realm-scoped prefix (mirrors the
 * legacy classifier's bypass shape so naming stays consistent).
 *
 * WARNING: any new realm-scoped route ending with one of these suffixes
 * (e.g. `/invoices/:id/some-feature/reject`) will silently inherit the
 * tenant-scoped bypass. Add a counter-rule before adding such a route.
 *
 * COUNTER-RULE: any path that ends in `/reject` or `/assign-client-org` but
 * should REMAIN realm-scoped (i.e. needs the nested
 * `/clientOrgs/:clientOrgId` segment in the rewritten URL) must NOT use
 * these suffix names. Rename the new endpoint (e.g. `/workflow-reject`,
 * `/reassign-client-org`), OR explicitly path-handle it BEFORE the suffix
 * check fires in `classifyMigratedPath`.
 */
const MIGRATED_TENANT_SCOPED_BYPASS_SUFFIXES = [
  "/assign-client-org",
  "/reject"
] as const;

function stripQueryString(path: string): string {
  const idx = path.indexOf("?");
  return idx === -1 ? path : path.slice(0, idx);
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

function endsWithSuffix(path: string, suffix: string): boolean {
  const bare = stripQueryString(path);
  return bare.endsWith(suffix);
}

function matchesAnyRealmScopedPrefix(path: string): boolean {
  for (const prefix of MIGRATED_REALM_SCOPED_PREFIXES) {
    if (matchesPrefix(path, prefix)) return true;
  }
  return false;
}

function matchesAnyTenantScopedPrefix(path: string): boolean {
  for (const prefix of MIGRATED_TENANT_SCOPED_PREFIXES) {
    if (matchesPrefix(path, prefix)) return true;
  }
  return false;
}

export function classifyMigratedPath(path: string): MigratedPathKind {
  // Tenant-scoped bypass (prefix) wins over realm-scoped — a path may match
  // BOTH `/invoices` (realm) and `/invoices/triage` (tenant bypass). The
  // bypass is the more specific rule.
  for (const bypass of MIGRATED_TENANT_SCOPED_BYPASS_PREFIXES) {
    if (matchesPrefix(path, bypass)) return MIGRATED_PATH_KIND.TENANT_SCOPED;
  }
  // Tenant-scoped bypass (suffix) — only fires when the path also sits under
  // a migrated realm-scoped prefix, so unrelated `/foo/reject` paths stay
  // unclassified by this helper.
  if (matchesAnyRealmScopedPrefix(path)) {
    for (const suffix of MIGRATED_TENANT_SCOPED_BYPASS_SUFFIXES) {
      if (endsWithSuffix(path, suffix)) return MIGRATED_PATH_KIND.TENANT_SCOPED;
    }
  }
  // Tenant-scoped data prefixes (ingestion orchestration, tenant-domain admin,
  // integrations) — checked BEFORE realm-scoped so e.g. `/admin/users` (tenant)
  // doesn't get caught by a future `/admin/...` realm prefix.
  if (matchesAnyTenantScopedPrefix(path)) return MIGRATED_PATH_KIND.TENANT_SCOPED;
  if (matchesAnyRealmScopedPrefix(path)) return MIGRATED_PATH_KIND.REALM_SCOPED;
  return MIGRATED_PATH_KIND.NONE;
}

export function isMigratedRealmScopedPath(path: string): boolean {
  return classifyMigratedPath(path) === MIGRATED_PATH_KIND.REALM_SCOPED;
}

export function isMigratedTenantScopedPath(path: string): boolean {
  return classifyMigratedPath(path) === MIGRATED_PATH_KIND.TENANT_SCOPED;
}

export function rewriteToNestedShape(path: string, tenantId: string, clientOrgId: string): string {
  return `/tenants/${tenantId}/clientOrgs/${clientOrgId}${path.startsWith("/") ? path : `/${path}`}`;
}

export function rewriteToTenantShape(path: string, tenantId: string): string {
  return `/tenants/${tenantId}${path.startsWith("/") ? path : `/${path}`}`;
}

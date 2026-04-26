import axios from "axios";

const E2E_KC_BASE = process.env.E2E_KEYCLOAK_BASE_URL ?? "http://127.0.0.1:8280";
const E2E_KC_REALM = process.env.E2E_KC_REALM ?? "ledgerbuddy";
const E2E_KC_CLIENT_ID = process.env.E2E_OIDC_CLIENT_ID ?? "ledgerbuddy-app";
const E2E_KC_CLIENT_SECRET = process.env.E2E_OIDC_CLIENT_SECRET ?? "ledgerbuddy-local-secret";
export const E2E_TEST_PASSWORD = "E2eTestPass!1";

/**
 * Create a Keycloak user (if not exists) and return a session token via /api/auth/token ROPC proxy.
 */
export async function createE2EUserAndLogin(apiBaseUrl: string, email: string): Promise<string> {
  const token = await getKcAdminToken();
  // Create user in Keycloak
  const createResponse = await axios.post(
    `${E2E_KC_BASE}/admin/realms/${E2E_KC_REALM}/users`,
    {
      username: email,
      email,
      firstName: email.split("@")[0],
      lastName: "User",
      emailVerified: true,
      enabled: true,
      credentials: [{ type: "password", value: E2E_TEST_PASSWORD, temporary: false }]
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      validateStatus: () => true
    }
  );
  if (createResponse.status !== 201 && createResponse.status !== 409) {
    throw new Error(`Failed to create E2E Keycloak user '${email}': HTTP ${createResponse.status} — ${JSON.stringify(createResponse.data)}`);
  }

  // If user already exists (e.g. created by invite flow with empty password), reset password
  if (createResponse.status === 409) {
    const searchResp = await axios.get(
      `${E2E_KC_BASE}/admin/realms/${E2E_KC_REALM}/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
    );
    if (searchResp.status === 200 && Array.isArray(searchResp.data) && searchResp.data.length > 0) {
      const userId = (searchResp.data as Array<{ id: string }>)[0].id;
      await axios.put(
        `${E2E_KC_BASE}/admin/realms/${E2E_KC_REALM}/users/${userId}/reset-password`,
        { type: "password", value: E2E_TEST_PASSWORD, temporary: false },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, validateStatus: () => true }
      );
    }
  }

  return loginWithPassword(apiBaseUrl, email, E2E_TEST_PASSWORD);
}

/**
 * Login with a known password (seeded demo users or onboarded tenant admins).
 */
export async function loginWithPassword(apiBaseUrl: string, email: string, password: string): Promise<string> {
  const response = await axios.post(
    `${apiBaseUrl}/api/auth/token`,
    { email, password },
    { validateStatus: () => true }
  );
  if (response.status !== 200) {
    throw new Error(`Login failed for '${email}': HTTP ${response.status} — ${JSON.stringify(response.data)}`);
  }
  const sessionToken = response.data?.token;
  if (typeof sessionToken !== "string" || !sessionToken) {
    throw new Error(`Login for '${email}' returned no session token.`);
  }
  return sessionToken;
}

/**
 * Delete a Keycloak user by email (call in afterAll for cleanup).
 */
async function deleteE2EKeycloakUser(email: string): Promise<void> {
  try {
    const token = await getKcAdminToken();
    const searchResponse = await axios.get(
      `${E2E_KC_BASE}/admin/realms/${E2E_KC_REALM}/users`,
      {
        params: { email, exact: true },
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
      }
    );
    if (searchResponse.status !== 200 || !Array.isArray(searchResponse.data) || searchResponse.data.length === 0) {
      return;
    }
    const userId = (searchResponse.data as Array<{ id: string }>)[0].id;
    await axios.delete(
      `${E2E_KC_BASE}/admin/realms/${E2E_KC_REALM}/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true
      }
    );
  } catch {
    // Best-effort cleanup — ignore errors
  }
}

export async function completeE2ETenantOnboarding(apiBaseUrl: string, token: string): Promise<void> {
  const sessionResponse = await axios.get(`${apiBaseUrl}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
  });
  if (sessionResponse.status !== 200) {
    throw new Error(`Failed to fetch session context for onboarding (HTTP ${sessionResponse.status}).`);
  }

  const onboardingStatus = String(sessionResponse.data?.tenant?.onboarding_status ?? "");
  if (onboardingStatus === "completed") {
    return;
  }

  const tenantName = String(sessionResponse.data?.tenant?.name ?? "").trim() || "local-tenant";
  const adminEmail = String(sessionResponse.data?.user?.email ?? "").trim() || "admin@local.test";
  const completeResponse = await axios.post(
    `${apiBaseUrl}/api/tenant/onboarding/complete`,
    {
      tenantName,
      adminEmail
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    }
  );
  if (completeResponse.status < 200 || completeResponse.status >= 300) {
    throw new Error(`Failed to complete tenant onboarding (HTTP ${completeResponse.status}).`);
  }
}

/**
 * Resolve `{tenantId, clientOrgId}` for the authenticated session.
 *
 * Required for callers that hit nested-path routes
 * (`/api/tenants/:tenantId/clientOrgs/:clientOrgId/...`). `tenantId` comes
 * from `/api/session`; `clientOrgId` is the first row returned by
 * `GET /api/tenants/:tenantId/admin/client-orgs`. When the tenant has no
 * client-org yet (production tenants do NOT auto-create a placeholder per
 * the locked decision in #156), one is created with a deterministic
 * tenant-derived GSTIN so the bootstrap is idempotent across reruns.
 *
 * `completeE2ETenantOnboarding` MUST run first — `requireTenantSetupCompleted`
 * gates the nested mount.
 */
export async function bootstrapTenantContext(
  apiBaseUrl: string,
  token: string
): Promise<{ tenantId: string; clientOrgId: string }> {
  const sessionResponse = await axios.get(`${apiBaseUrl}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
  });
  if (sessionResponse.status !== 200) {
    throw new Error(`Failed to fetch session context for tenant bootstrap (HTTP ${sessionResponse.status}).`);
  }
  const tenantId = String(sessionResponse.data?.tenant?.id ?? "").trim();
  if (!tenantId) {
    throw new Error("Session response did not include tenant.id.");
  }

  const listResponse = await axios.get(
    `${apiBaseUrl}/api/tenants/${tenantId}/admin/client-orgs`,
    {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    }
  );
  if (listResponse.status !== 200) {
    throw new Error(`Failed to list client-orgs for tenant ${tenantId} (HTTP ${listResponse.status}).`);
  }
  const items = Array.isArray(listResponse.data?.items)
    ? listResponse.data.items
    : Array.isArray(listResponse.data)
      ? listResponse.data
      : [];
  if (items.length > 0 && typeof items[0]?._id === "string") {
    return { tenantId, clientOrgId: items[0]._id };
  }

  const gstin = deriveDeterministicGstin(tenantId);
  const createResponse = await axios.post(
    `${apiBaseUrl}/api/tenants/${tenantId}/admin/client-orgs`,
    {
      gstin,
      companyName: "E2E Default Org",
      stateName: "Telangana"
    },
    {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true
    }
  );
  if (createResponse.status !== 201 && createResponse.status !== 200) {
    throw new Error(
      `Failed to create default client-org for tenant ${tenantId} (HTTP ${createResponse.status} — ${JSON.stringify(createResponse.data)}).`
    );
  }
  const clientOrgId = String(createResponse.data?._id ?? "").trim();
  if (!clientOrgId) {
    throw new Error("Create client-org response did not include _id.");
  }
  return { tenantId, clientOrgId };
}

/**
 * Build a 15-char GSTIN seeded from the tenantId so reruns reuse the same
 * realm. Matches `GSTIN_FORMAT` in `backend/src/constants/indianCompliance.ts`:
 * `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]`. Hex digits 0-9 are
 * mapped to A-J for the letter slots so the derivation is collision-free
 * across distinct tenant ids (12 distinct hex chars → 22 distinct GSTIN
 * chars after the alphabet+digit dual mapping).
 */
function deriveDeterministicGstin(tenantId: string): string {
  const hex = tenantId.replace(/[^0-9a-fA-F]/g, "").toLowerCase().padEnd(12, "0");
  const letters = (start: number, count: number): string =>
    Array.from({ length: count }, (_, i) => {
      const code = hex.charCodeAt(start + i);
      const value = code >= 0x61 ? code - 0x61 + 10 : code - 0x30;
      return String.fromCharCode(0x41 + (value % 26));
    }).join("");
  const digits = (start: number, count: number): string =>
    Array.from({ length: count }, (_, i) => {
      const code = hex.charCodeAt(start + i);
      const value = code >= 0x61 ? code - 0x61 + 10 : code - 0x30;
      return String((value % 10));
    }).join("");
  const five = letters(0, 5);
  const four = digits(5, 4);
  const oneA = letters(9, 1);
  const oneAlnum = letters(10, 1);
  const lastAlnum = letters(11, 1);
  return `36${five}${four}${oneA}${oneAlnum}Z${lastAlnum}`;
}

async function getKcAdminToken(): Promise<string> {
  const response = await axios.post(
    `${E2E_KC_BASE}/realms/${E2E_KC_REALM}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: E2E_KC_CLIENT_ID,
      client_secret: E2E_KC_CLIENT_SECRET
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      validateStatus: () => true
    }
  );
  if (response.status !== 200) {
    throw new Error(`Failed to get Keycloak admin token: HTTP ${response.status}`);
  }
  const token = response.data?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Keycloak admin token response missing access_token.");
  }
  return token;
}

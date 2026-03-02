import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import axios from "axios";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000";
const mailhogApiBaseUrl = process.env.E2E_MAILHOG_API_BASE_URL ?? "http://127.0.0.1:8025";
const platformAdminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL ?? "platform-admin@local.test";

test.describe("tenant admin visibility", () => {
  let adminToken = "";
  let memberToken = "";
  let platformToken = "";

  test.beforeAll(async ({ request }) => {
    await expectBackendReady(request);

    const adminEmail = uniqueEmail("fe-admin");
    adminToken = await createE2ESessionToken(apiBaseUrl, adminEmail);
    await completeE2ETenantOnboarding(request, adminToken);

    platformToken = await createE2ESessionToken(apiBaseUrl, platformAdminEmail);
    await completeE2ETenantOnboarding(request, platformToken);

    const memberEmail = uniqueEmail("fe-member");
    const inviteStartMs = Date.now();
    const invite = await request.post(`${apiBaseUrl}/api/admin/users/invite`, {
      headers: authHeaders(adminToken),
      data: { email: memberEmail }
    });
    expect(invite.status()).toBe(201);

    const inviteToken = await pollInviteTokenFromMailhog(memberEmail, inviteStartMs);
    memberToken = await createE2ESessionToken(apiBaseUrl, memberEmail);
    const accept = await request.post(`${apiBaseUrl}/api/tenant/invites/accept`, {
      headers: authHeaders(memberToken),
      data: { token: inviteToken }
    });
    expect(accept.status()).toBe(204);

    await connectGmail(adminToken);
  });

  test("admin sees tenant settings and gmail action controls", async ({ page }) => {
    await seedAuthToken(page, adminToken);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ops Console" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tenant Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Invite" })).toBeVisible();
    await expect(page.getByText("Mailbox Connected")).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect Gmail|Reconnect Gmail/ })).toHaveCount(0);
  });

  test("member does not see tenant settings or gmail action controls", async ({ page }) => {
    await seedAuthToken(page, memberToken);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ops Console" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tenant Settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send Invite" })).toHaveCount(0);
    await expect(page.getByText("Mailbox Connected")).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect Gmail|Reconnect Gmail/ })).toHaveCount(0);
  });

  test("member is denied gmail connect-url api while admin is allowed", async ({ request }) => {
    const adminConnectUrl = await request.get(`${apiBaseUrl}/api/integrations/gmail/connect-url`, {
      headers: authHeaders(adminToken)
    });
    expect(adminConnectUrl.status()).toBe(200);
    const payload = (await adminConnectUrl.json()) as { connectUrl?: string };
    expect(typeof payload.connectUrl).toBe("string");

    const memberConnectUrl = await request.get(`${apiBaseUrl}/api/integrations/gmail/connect-url`, {
      headers: authHeaders(memberToken)
    });
    expect(memberConnectUrl.status()).toBe(403);
  });

  test("platform admin sees tenant usage overview panel", async ({ page }) => {
    await seedAuthToken(page, platformToken);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Platform Tenant Usage Overview" })).toBeVisible();
    await expect(page.getByText("This view is usage-only. Invoice content is not exposed at platform scope.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tenant" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Documents" })).toBeVisible();
  });
});

async function expectBackendReady(request: APIRequestContext): Promise<void> {
  const health = await request.get(`${apiBaseUrl}/health`);
  expect(health.ok()).toBeTruthy();
  const payload = (await health.json()) as { ready?: boolean };
  expect(payload.ready).toBe(true);
}

async function createE2ESessionToken(apiRoot: string, loginHint: string): Promise<string> {
  const loginUrl = new URL("/auth/login", apiRoot);
  loginUrl.searchParams.set("next", "/");
  loginUrl.searchParams.set("login_hint", loginHint);

  const authorizeRedirect = await requestRedirect(loginUrl.toString());
  const callbackRedirect = await requestRedirect(authorizeRedirect);
  const frontendRedirect = await requestRedirect(callbackRedirect);
  const token = new URL(frontendRedirect).searchParams.get("token");
  if (!token) {
    throw new Error("OAuth callback did not return a session token.");
  }
  return token;
}

async function completeE2ETenantOnboarding(request: APIRequestContext, token: string): Promise<void> {
  const session = await request.get(`${apiBaseUrl}/api/session`, {
    headers: authHeaders(token)
  });
  expect(session.ok()).toBeTruthy();
  const payload = (await session.json()) as {
    tenant?: { onboarding_status?: string; name?: string };
    user?: { email?: string };
  };

  if (payload.tenant?.onboarding_status === "completed") {
    return;
  }

  const complete = await request.post(`${apiBaseUrl}/api/tenant/onboarding/complete`, {
    headers: authHeaders(token),
    data: {
      tenantName: payload.tenant?.name ?? "local-tenant",
      adminEmail: payload.user?.email ?? "admin@local.test"
    }
  });
  expect(complete.ok()).toBeTruthy();
}

async function pollInviteTokenFromMailhog(recipient: string, startedAfterMs: number): Promise<string> {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    const response = await axios.get(`${mailhogApiBaseUrl}/api/v2/messages`, {
      timeout: 15_000,
      validateStatus: () => true
    });
    if (response.status === 200 && Array.isArray(response.data?.items)) {
      const token = extractInviteToken(response.data.items, recipient, startedAfterMs);
      if (token) {
        return token;
      }
    }
    await sleep(1_000);
  }
  throw new Error(`Timed out waiting for invite email token for recipient '${recipient}'.`);
}

function extractInviteToken(messages: unknown[], recipient: string, startedAfterMs: number): string {
  const target = recipient.toLowerCase();
  const sorted = [...messages].sort((left, right) => parseCreatedAt(right) - parseCreatedAt(left));

  for (const message of sorted) {
    const createdAt = parseCreatedAt(message);
    if (createdAt > 0 && createdAt < startedAfterMs) {
      continue;
    }
    if (!containsRecipient(message, target)) {
      continue;
    }
    for (const candidate of getMessageTextCandidates(message)) {
      const decoded = decodeQuotedPrintable(candidate);
      const match = decoded.match(/invite\?token=([A-Za-z0-9._~-]+)/i);
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    }
  }

  return "";
}

function parseCreatedAt(message: unknown): number {
  if (!message || typeof message !== "object") {
    return 0;
  }
  const created = (message as { Created?: unknown }).Created;
  if (typeof created !== "string") {
    return 0;
  }
  const parsed = Date.parse(created);
  return Number.isFinite(parsed) ? parsed : 0;
}

function containsRecipient(message: unknown, recipient: string): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const toEntries = (message as { To?: Array<{ Mailbox?: unknown; Domain?: unknown }> }).To;
  if (!Array.isArray(toEntries)) {
    return JSON.stringify(message).toLowerCase().includes(recipient);
  }
  return toEntries.some((entry) => {
    const mailbox = typeof entry?.Mailbox === "string" ? entry.Mailbox.toLowerCase() : "";
    const domain = typeof entry?.Domain === "string" ? entry.Domain.toLowerCase() : "";
    return mailbox && domain ? `${mailbox}@${domain}` === recipient : false;
  });
}

function getMessageTextCandidates(message: unknown): string[] {
  if (!message || typeof message !== "object") {
    return [];
  }
  const contentBody =
    typeof (message as { Content?: { Body?: unknown } }).Content?.Body === "string"
      ? (message as { Content: { Body: string } }).Content.Body
      : "";
  const rawData =
    typeof (message as { Raw?: { Data?: unknown } }).Raw?.Data === "string"
      ? (message as { Raw: { Data: string } }).Raw.Data
      : "";
  return [contentBody, rawData].filter((value) => value.length > 0);
}

function decodeQuotedPrintable(value: string): string {
  const unfolded = value.replace(/=\r?\n/g, "");
  return unfolded.replace(/=([A-Fa-f0-9]{2})/g, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`
  };
}

async function seedAuthToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("invoice_processor_session_token", value);
  }, token);
}

async function requestRedirect(url: string): Promise<string> {
  const response = await axios.get(url, {
    maxRedirects: 0,
    validateStatus: () => true
  });
  if (response.status < 300 || response.status >= 400) {
    throw new Error(`Expected redirect from ${url}, received HTTP ${response.status}.`);
  }
  const location = response.headers.location;
  if (typeof location !== "string" || location.trim().length === 0) {
    throw new Error(`Redirect from ${url} did not include location header.`);
  }
  return new URL(location, url).toString();
}

async function connectGmail(token: string): Promise<void> {
  const connectUrlResponse = await axios.get(`${apiBaseUrl}/api/integrations/gmail/connect-url`, {
    headers: authHeaders(token),
    timeout: 30_000,
    validateStatus: () => true
  });
  if (connectUrlResponse.status !== 200) {
    throw new Error(`Failed to resolve Gmail connect URL (HTTP ${connectUrlResponse.status}).`);
  }

  const connectUrl = String(connectUrlResponse.data?.connectUrl ?? "");
  if (!connectUrl) {
    throw new Error("Gmail connect URL was empty.");
  }

  const finalRedirect = await followRedirectChain(connectUrl);
  const parsed = new URL(finalRedirect);
  if (parsed.searchParams.get("gmail") !== "connected") {
    throw new Error(`Expected gmail=connected redirect, got '${finalRedirect}'.`);
  }
}

async function followRedirectChain(startUrl: string, maxHops = 6): Promise<string> {
  let currentUrl = startUrl;
  for (let hop = 0; hop < maxHops; hop += 1) {
    const response = await axios.get(currentUrl, {
      timeout: 30_000,
      maxRedirects: 0,
      validateStatus: () => true
    });
    if (response.status < 300 || response.status >= 400) {
      return currentUrl;
    }
    const location = response.headers.location;
    if (typeof location !== "string" || location.trim().length === 0) {
      throw new Error(`Redirect from '${currentUrl}' did not include a location header.`);
    }
    currentUrl = new URL(location, currentUrl).toString();
  }

  return currentUrl;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@local.test`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

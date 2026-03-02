import axios from "axios";
import mongoose from "mongoose";
import { createE2ESessionTokenWithOptions, completeE2ETenantOnboarding } from "./authHelper.js";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000";
const mailhogApiBaseUrl = process.env.E2E_MAILHOG_API_BASE_URL ?? "http://127.0.0.1:8025";
const mongoUri = process.env.E2E_MONGO_URI ?? "mongodb://127.0.0.1:27017/invoice_processor";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60_000,
  validateStatus: () => true
});

jest.setTimeout(3 * 60_000);

describe("sendgrid invite formatting e2e", () => {
  beforeAll(async () => {
    const health = await api.get("/health");
    expect(health.status).toBe(200);
    expect(health.data?.ready).toBe(true);
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("delivers invite email to MailHog with formatted invite details", async () => {
    const adminEmail = `sendgrid-admin-${Date.now()}@local.test`;
    const inviteeEmail = `sendgrid-invitee-${Date.now()}@local.test`;
    const adminToken = await createE2ESessionTokenWithOptions(apiBaseUrl, { loginHint: adminEmail });
    await completeE2ETenantOnboarding(apiBaseUrl, adminToken);

    const inviteStartMs = Date.now();
    const inviteResponse = await api.post(
      "/api/admin/users/invite",
      { email: inviteeEmail },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );
    expect(inviteResponse.status).toBe(201);

    const inviteMessage = await pollInviteMessage(inviteeEmail, inviteStartMs);
    expect(inviteMessage.subject).toContain("You were invited to Invoice Processor");
    expect(inviteMessage.decodedBody).toContain("You were invited to join a tenant in Invoice Processor.");
    expect(inviteMessage.decodedBody).toMatch(/Accept invite:\s+http:\/\/localhost:5173\/invite\?token=/i);
    expect(inviteMessage.decodedBody).toContain("Expires at:");
    expect(inviteMessage.decodedBody).toContain("<strong>Accept invite:</strong>");
  });
});

async function pollInviteMessage(recipient: string, startedAfterMs: number): Promise<{ subject: string; decodedBody: string }> {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    const response = await axios.get(`${mailhogApiBaseUrl}/api/v2/messages`, {
      timeout: 15_000,
      validateStatus: () => true
    });
    if (response.status === 200 && Array.isArray(response.data?.items)) {
      const match = extractInviteMessage(response.data.items, recipient, startedAfterMs);
      if (match) {
        return match;
      }
    }
    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for invite email for '${recipient}'.`);
}

function extractInviteMessage(
  messages: unknown[],
  recipient: string,
  startedAfterMs: number
): { subject: string; decodedBody: string } | null {
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

    const subject = getMessageSubject(message);
    const candidates = getMessageTextCandidates(message);
    const decodedBody = candidates.map((candidate) => decodeQuotedPrintable(candidate)).join("\n");
    if (!decodedBody.includes("invite?token=")) {
      continue;
    }

    return { subject, decodedBody };
  }

  return null;
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

function getMessageSubject(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const headers = (message as { Content?: { Headers?: Record<string, unknown> } }).Content?.Headers;
  if (!headers || typeof headers !== "object") {
    return "";
  }

  const subject = headers.Subject;
  if (Array.isArray(subject)) {
    return subject.map((entry) => String(entry)).join(" ").trim();
  }
  return typeof subject === "string" ? subject.trim() : "";
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

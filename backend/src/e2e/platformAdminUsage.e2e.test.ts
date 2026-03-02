import axios from "axios";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { createE2ESessionTokenWithOptions, completeE2ETenantOnboarding } from "./authHelper.js";
import { InvoiceModel } from "../models/Invoice.js";
import { TenantIntegrationModel } from "../models/TenantIntegration.js";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000";
const mongoUri = process.env.E2E_MONGO_URI ?? "mongodb://127.0.0.1:27017/invoice_processor";
const platformAdminEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL ?? "platform-admin@local.test";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60_000,
  validateStatus: () => true
});

jest.setTimeout(5 * 60_000);

describe("platform admin tenant usage e2e", () => {
  beforeAll(async () => {
    const health = await api.get("/health");
    expect(health.status).toBe(200);
    expect(health.data?.ready).toBe(true);
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("returns usage-only tenant overview for platform admin and blocks non-platform users", async () => {
    const platformToken = await createE2ESessionTokenWithOptions(apiBaseUrl, {
      loginHint: platformAdminEmail
    });
    const platformSession = await fetchSession(platformToken);
    expect(platformSession.user.isPlatformAdmin).toBe(true);

    const tenantAEmail = `usage-a-${Date.now()}@local.test`;
    const tenantBEmail = `usage-b-${Date.now()}@local.test`;
    const tenantAToken = await createE2ESessionTokenWithOptions(apiBaseUrl, {
      loginHint: tenantAEmail
    });
    const tenantBToken = await createE2ESessionTokenWithOptions(apiBaseUrl, {
      loginHint: tenantBEmail
    });
    await completeE2ETenantOnboarding(apiBaseUrl, tenantAToken);
    await completeE2ETenantOnboarding(apiBaseUrl, tenantBToken);

    const tenantASession = await fetchSession(tenantAToken);
    const tenantBSession = await fetchSession(tenantBToken);

    await seedInvoice(tenantASession.tenant.id, "PARSED");
    await seedInvoice(tenantASession.tenant.id, "FAILED_PARSE");
    await seedInvoice(tenantASession.tenant.id, "EXPORTED");
    await seedInvoice(tenantBSession.tenant.id, "APPROVED");
    await seedInvoice(tenantBSession.tenant.id, "NEEDS_REVIEW");

    await TenantIntegrationModel.findOneAndUpdate(
      {
        tenantId: tenantASession.tenant.id,
        provider: "gmail"
      },
      {
        tenantId: tenantASession.tenant.id,
        provider: "gmail",
        status: "connected",
        emailAddress: tenantAEmail,
        encryptedRefreshToken: "encrypted-token",
        createdByUserId: tenantASession.user.id
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const usageResponse = await api.get("/api/platform/tenants/usage", {
      headers: authHeaders(platformToken)
    });
    expect(usageResponse.status).toBe(200);
    const items: Array<{
      tenantId: string;
      totalDocuments: number;
      parsedDocuments: number;
      failedDocuments: number;
      exportedDocuments: number;
      approvedDocuments: number;
      needsReviewDocuments: number;
      gmailConnectionState: string;
    }> = Array.isArray(usageResponse.data?.items) ? usageResponse.data.items : [];
    const tenantAUsage = items.find((entry) => entry.tenantId === tenantASession.tenant.id);
    const tenantBUsage = items.find((entry) => entry.tenantId === tenantBSession.tenant.id);

    expect(tenantAUsage).toBeTruthy();
    if (!tenantAUsage) {
      throw new Error("Missing tenant A usage row.");
    }
    expect(tenantAUsage.totalDocuments).toBe(3);
    expect(tenantAUsage.parsedDocuments).toBe(1);
    expect(tenantAUsage.failedDocuments).toBe(1);
    expect(tenantAUsage.exportedDocuments).toBe(1);
    expect(tenantAUsage.gmailConnectionState).toBe("CONNECTED");
    expect(tenantAUsage).not.toHaveProperty("invoices");
    expect(tenantAUsage).not.toHaveProperty("ocrText");

    expect(tenantBUsage).toBeTruthy();
    if (!tenantBUsage) {
      throw new Error("Missing tenant B usage row.");
    }
    expect(tenantBUsage.totalDocuments).toBe(2);
    expect(tenantBUsage.approvedDocuments).toBe(1);
    expect(tenantBUsage.needsReviewDocuments).toBe(1);

    const forbidden = await api.get("/api/platform/tenants/usage", {
      headers: authHeaders(tenantAToken)
    });
    expect(forbidden.status).toBe(403);
  });
});

async function fetchSession(token: string): Promise<{
  user: { id: string; email: string; role: "TENANT_ADMIN" | "MEMBER"; isPlatformAdmin: boolean };
  tenant: { id: string; name: string; onboarding_status: "pending" | "completed" };
}> {
  const response = await api.get("/api/session", {
    headers: authHeaders(token)
  });
  expect(response.status).toBe(200);
  return response.data;
}

async function seedInvoice(tenantId: string, status: "PARSED" | "FAILED_PARSE" | "EXPORTED" | "APPROVED" | "NEEDS_REVIEW"): Promise<void> {
  const id = randomUUID();
  await InvoiceModel.create({
    tenantId,
    workloadTier: "standard",
    sourceType: "folder",
    sourceKey: "platform-usage-test",
    sourceDocumentId: `platform-usage-${id}.pdf`,
    attachmentName: `platform-usage-${id}.pdf`,
    mimeType: "application/pdf",
    receivedAt: new Date(),
    status,
    parsed: {
      invoiceNumber: `USAGE-${id.slice(0, 8)}`,
      vendorName: "Usage Vendor",
      invoiceDate: "2026-03-01",
      dueDate: "2026-03-08",
      currency: "USD",
      totalAmountMinor: 1000
    }
  });
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`
  };
}

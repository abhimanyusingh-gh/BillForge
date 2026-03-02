import { InvoiceModel } from "../models/Invoice.js";
import { TenantIntegrationModel } from "../models/TenantIntegration.js";
import { TenantModel } from "../models/Tenant.js";
import { UserModel } from "../models/User.js";

export interface TenantUsageOverview {
  tenantId: string;
  tenantName: string;
  onboardingStatus: "pending" | "completed";
  userCount: number;
  totalDocuments: number;
  parsedDocuments: number;
  approvedDocuments: number;
  exportedDocuments: number;
  needsReviewDocuments: number;
  failedDocuments: number;
  gmailConnectionState: "CONNECTED" | "NEEDS_REAUTH" | "DISCONNECTED";
  lastIngestedAt: string | null;
  createdAt: string;
}

export class PlatformAdminService {
  async listTenantUsageOverview(): Promise<TenantUsageOverview[]> {
    const [tenants, invoiceStats, userStats, integrations] = await Promise.all([
      TenantModel.find().sort({ createdAt: 1 }).lean(),
      InvoiceModel.aggregate<{
        _id: string;
        totalDocuments: number;
        parsedDocuments: number;
        approvedDocuments: number;
        exportedDocuments: number;
        needsReviewDocuments: number;
        failedDocuments: number;
        lastIngestedAt: Date | null;
      }>([
        {
          $group: {
            _id: "$tenantId",
            totalDocuments: { $sum: 1 },
            parsedDocuments: {
              $sum: {
                $cond: [{ $eq: ["$status", "PARSED"] }, 1, 0]
              }
            },
            approvedDocuments: {
              $sum: {
                $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0]
              }
            },
            exportedDocuments: {
              $sum: {
                $cond: [{ $eq: ["$status", "EXPORTED"] }, 1, 0]
              }
            },
            needsReviewDocuments: {
              $sum: {
                $cond: [{ $eq: ["$status", "NEEDS_REVIEW"] }, 1, 0]
              }
            },
            failedDocuments: {
              $sum: {
                $cond: [{ $in: ["$status", ["FAILED_OCR", "FAILED_PARSE"]] }, 1, 0]
              }
            },
            lastIngestedAt: { $max: "$createdAt" }
          }
        }
      ]),
      UserModel.aggregate<{ _id: string; userCount: number }>([
        {
          $group: {
            _id: "$tenantId",
            userCount: { $sum: 1 }
          }
        }
      ]),
      TenantIntegrationModel.find({ provider: "gmail" }).lean()
    ]);

    const invoiceMap = new Map(invoiceStats.map((entry) => [entry._id, entry]));
    const userMap = new Map(userStats.map((entry) => [entry._id, entry.userCount]));
    const gmailMap = new Map(
      integrations
        .filter((entry) => typeof entry.tenantId === "string" && entry.tenantId.trim().length > 0)
        .map((entry) => [entry.tenantId, entry.status])
    );

    return tenants.map((tenant) => {
      const tenantId = String(tenant._id);
      const invoice = invoiceMap.get(tenantId);
      const gmailStatus = gmailMap.get(tenantId);
      return {
        tenantId,
        tenantName: tenant.name,
        onboardingStatus: tenant.onboardingStatus,
        userCount: userMap.get(tenantId) ?? 0,
        totalDocuments: invoice?.totalDocuments ?? 0,
        parsedDocuments: invoice?.parsedDocuments ?? 0,
        approvedDocuments: invoice?.approvedDocuments ?? 0,
        exportedDocuments: invoice?.exportedDocuments ?? 0,
        needsReviewDocuments: invoice?.needsReviewDocuments ?? 0,
        failedDocuments: invoice?.failedDocuments ?? 0,
        gmailConnectionState:
          gmailStatus === "connected" ? "CONNECTED" : gmailStatus === "requires_reauth" ? "NEEDS_REAUTH" : "DISCONNECTED",
        lastIngestedAt: invoice?.lastIngestedAt ? new Date(invoice.lastIngestedAt).toISOString() : null,
        createdAt: new Date(tenant.createdAt).toISOString()
      };
    });
  }
}

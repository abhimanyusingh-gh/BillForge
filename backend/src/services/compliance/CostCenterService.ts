import type { Types } from "mongoose";
import { CostCenterMasterModel } from "@/models/compliance/CostCenterMaster.js";
import { VendorCostCenterMappingModel } from "@/models/compliance/VendorCostCenterMapping.js";
import { VendorMasterModel } from "@/models/compliance/VendorMaster.js";
import type { ComplianceCostCenterResult } from "@/types/invoice.js";

interface CostCenterSuggestion {
  costCenter: ComplianceCostCenterResult;
}

export class CostCenterService {
  async suggest(
    tenantId: string,
    clientOrgId: Types.ObjectId,
    vendorFingerprint: string,
    glCode: string | null
  ): Promise<CostCenterSuggestion> {
    const vendorResult = await this.suggestFromVendorHistory(tenantId, clientOrgId, vendorFingerprint);
    if (vendorResult) return vendorResult;

    if (glCode) {
      const glLinked = await this.suggestFromGlLink(tenantId, clientOrgId, glCode);
      if (glLinked) return glLinked;
    }

    return {
      costCenter: { code: null, name: null, source: "vendor-default", confidence: null }
    };
  }

  async recordUsage(
    tenantId: string,
    clientOrgId: Types.ObjectId,
    vendorFingerprint: string,
    costCenterCode: string,
    costCenterName: string
  ): Promise<void> {
    const now = new Date();
    await VendorCostCenterMappingModel.findOneAndUpdate(
      { tenantId, clientOrgId, vendorFingerprint, costCenterCode },
      { $inc: { usageCount: 1 }, $set: { costCenterName, lastUsedAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const topMapping = await VendorCostCenterMappingModel
      .findOne({ tenantId, clientOrgId, vendorFingerprint })
      .sort({ usageCount: -1 })
      .lean();

    if (topMapping) {
      await VendorMasterModel.updateOne(
        { tenantId, clientOrgId, vendorFingerprint },
        { $set: { defaultCostCenter: topMapping.costCenterCode } }
      );
    }
  }

  private async suggestFromVendorHistory(
    tenantId: string,
    clientOrgId: Types.ObjectId,
    vendorFingerprint: string
  ): Promise<CostCenterSuggestion | null> {
    const mappings = await VendorCostCenterMappingModel
      .find({ tenantId, clientOrgId, vendorFingerprint })
      .sort({ usageCount: -1 })
      .limit(1)
      .lean();

    if (mappings.length === 0) return null;

    const top = mappings[0];
    return {
      costCenter: {
        code: top.costCenterCode,
        name: top.costCenterName,
        source: "vendor-default",
        confidence: Math.min(100, top.usageCount * 15)
      }
    };
  }

  private async suggestFromGlLink(
    tenantId: string,
    clientOrgId: Types.ObjectId,
    glCode: string
  ): Promise<CostCenterSuggestion | null> {
    const cc = await CostCenterMasterModel.findOne({
      tenantId,
      clientOrgId,
      linkedGlCodes: glCode,
      isActive: true
    }).lean();

    if (!cc) return null;

    return {
      costCenter: {
        code: cc.code,
        name: cc.name,
        source: "gl-linked",
        confidence: 70
      }
    };
  }
}

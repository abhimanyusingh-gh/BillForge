import { VendorTemplateModel } from "@/models/invoice/VendorTemplate.js";

export interface VendorTemplateSnapshot {
  clientOrgId: string;
  fingerprintKey: string;
  layoutSignature: string;
  vendorName: string;
  currency?: string;
  invoicePrefix?: string;
  confidenceScore: number;
}

export interface VendorTemplateStore {
  findByFingerprint(clientOrgId: string, fingerprintKey: string): Promise<VendorTemplateSnapshot | undefined>;
  saveOrUpdate(template: VendorTemplateSnapshot): Promise<void>;
}

export class MongoVendorTemplateStore implements VendorTemplateStore {
  async findByFingerprint(clientOrgId: string, fingerprintKey: string): Promise<VendorTemplateSnapshot | undefined> {
    try {
      const template = await VendorTemplateModel.findOne({ clientOrgId, fingerprintKey }).lean();
      if (!template) {
        return undefined;
      }

      return {
        clientOrgId: String(template.clientOrgId),
        fingerprintKey: template.fingerprintKey,
        layoutSignature: template.layoutSignature,
        vendorName: template.vendorName,
        currency: template.currency ?? undefined,
        invoicePrefix: template.invoicePrefix ?? undefined,
        confidenceScore: template.confidenceScore
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async saveOrUpdate(template: VendorTemplateSnapshot): Promise<void> {
    try {
      await VendorTemplateModel.findOneAndUpdate(
        { clientOrgId: template.clientOrgId, fingerprintKey: template.fingerprintKey },
        {
          $set: {
            clientOrgId: template.clientOrgId,
            fingerprintKey: template.fingerprintKey,
            layoutSignature: template.layoutSignature,
            vendorName: template.vendorName,
            currency: template.currency,
            invoicePrefix: template.invoicePrefix,
            confidenceScore: template.confidenceScore
          },
          $inc: { usageCount: 1 }
        },
        { upsert: true }
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

export class InMemoryVendorTemplateStore implements VendorTemplateStore {
  private readonly templates = new Map<string, VendorTemplateSnapshot>();

  async findByFingerprint(clientOrgId: string, fingerprintKey: string): Promise<VendorTemplateSnapshot | undefined> {
    return this.templates.get(`${clientOrgId}|${fingerprintKey}`);
  }

  async saveOrUpdate(template: VendorTemplateSnapshot): Promise<void> {
    this.templates.set(`${template.clientOrgId}|${template.fingerprintKey}`, template);
  }
}

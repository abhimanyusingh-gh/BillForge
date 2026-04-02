import { GlCodeMasterModel } from "../../models/GlCodeMaster.js";
import { VendorGlMappingModel } from "../../models/VendorGlMapping.js";
import { VendorMasterModel } from "../../models/VendorMaster.js";
import type { ComplianceGlCodeResult, ParsedInvoiceData } from "../../types/invoice.js";

interface GlSuggestion {
  glCode: ComplianceGlCodeResult;
}

export class GlCodeSuggestionService {
  async suggest(
    tenantId: string,
    vendorFingerprint: string,
    parsed: ParsedInvoiceData,
    ocrText?: string
  ): Promise<GlSuggestion> {
    const vendorResult = await this.suggestFromVendorHistory(tenantId, vendorFingerprint);
    if (vendorResult) return vendorResult;

    const descriptionResult = await this.suggestFromDescription(tenantId, parsed, ocrText);
    if (descriptionResult) return descriptionResult;

    return {
      glCode: {
        code: null,
        name: null,
        source: "vendor-default",
        confidence: null,
        suggestedAlternatives: []
      }
    };
  }

  async recordUsage(
    tenantId: string,
    vendorFingerprint: string,
    glCode: string,
    glCodeName: string
  ): Promise<void> {
    const now = new Date();
    const existing = await VendorGlMappingModel.findOne({ tenantId, vendorFingerprint, glCode });

    if (existing) {
      existing.usageCount += 1;
      existing.lastUsedAt = now;
      const usages = [...(existing.recentUsages ?? []), now];
      existing.recentUsages = usages.slice(-5) as typeof existing.recentUsages;
      await existing.save();
    } else {
      await VendorGlMappingModel.create({
        tenantId,
        vendorFingerprint,
        glCode,
        glCodeName,
        usageCount: 1,
        recentUsages: [now],
        lastUsedAt: now
      });
    }

    const allMappings = await VendorGlMappingModel.find({ tenantId, vendorFingerprint }).sort({ usageCount: -1 }).limit(1).lean();
    if (allMappings.length > 0) {
      await VendorMasterModel.updateOne(
        { tenantId, vendorFingerprint },
        { $set: { defaultGlCode: allMappings[0].glCode } }
      );
    }
  }

  private async suggestFromVendorHistory(
    tenantId: string,
    vendorFingerprint: string
  ): Promise<GlSuggestion | null> {
    const mappings = await VendorGlMappingModel.find({ tenantId, vendorFingerprint }).lean();
    if (mappings.length === 0) return null;

    const now = Date.now();
    const fiveUsagesAgo = now - 30 * 24 * 60 * 60 * 1000;

    const scored = mappings.map(m => {
      const recentCount = (m.recentUsages ?? []).filter(
        (d: unknown) => new Date(d as string | number | Date).getTime() > fiveUsagesAgo
      ).length;
      return {
        code: m.glCode,
        name: m.glCodeName,
        score: m.usageCount + 2 * recentCount
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const totalUsage = mappings.reduce((sum, m) => sum + m.usageCount, 0);
    const topScore = scored[0].score;
    const confidence = Math.min(100, Math.round((topScore / Math.max(1, totalUsage)) * 100));

    const alternatives = scored.slice(1, 4).map(s => ({
      code: s.code,
      name: s.name,
      score: s.score
    }));

    return {
      glCode: {
        code: scored[0].code,
        name: scored[0].name,
        source: "vendor-default",
        confidence,
        suggestedAlternatives: confidence < 60 ? alternatives : []
      }
    };
  }

  private async suggestFromDescription(
    tenantId: string,
    parsed: ParsedInvoiceData,
    ocrText?: string
  ): Promise<GlSuggestion | null> {
    const textParts: string[] = [];
    if (parsed.notes && parsed.notes.length > 0) textParts.push(parsed.notes.join(" "));
    if (parsed.vendorName) textParts.push(parsed.vendorName);
    if (ocrText) textParts.push(ocrText.substring(0, 500));

    const combinedText = textParts.join(" ").toLowerCase();
    if (!combinedText.trim()) return null;

    const tokens = combinedText.split(/\s+/).filter(t => t.length > 2);
    if (tokens.length === 0) return null;

    const glCodes = await GlCodeMasterModel.find({ tenantId, isActive: true }).lean();
    if (glCodes.length === 0) return null;

    let bestMatch: { code: string; name: string; matchCount: number } | null = null;

    for (const gl of glCodes) {
      const glTokens = `${gl.name} ${gl.category}`.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const matchCount = glTokens.filter(gt => tokens.some(t => t.includes(gt) || gt.includes(t))).length;
      if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
        bestMatch = { code: gl.code, name: gl.name, matchCount };
      }
    }

    if (!bestMatch) return null;

    return {
      glCode: {
        code: bestMatch.code,
        name: bestMatch.name,
        source: "description-match",
        confidence: Math.min(70, bestMatch.matchCount * 20),
        suggestedAlternatives: []
      }
    };
  }
}

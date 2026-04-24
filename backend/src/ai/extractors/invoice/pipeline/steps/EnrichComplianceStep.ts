import { Types } from "mongoose";
import type { PipelineContext, PipelineStep, StepOutput } from "@/core/pipeline/index.js";
import type { ParsedInvoiceData } from "@/types/invoice.js";
import type { ComplianceEnricher } from "@/services/compliance/ComplianceEnricher.js";
import { toUUID } from "@/types/uuid.js";
import { logger } from "@/utils/logger.js";
import { POST_ENGINE_CTX } from "@/ai/extractors/invoice/pipeline/postEngineContextKeys.js";

/**
 * Stage 13: Enriches the parsed data with compliance information (TDS, PAN, risk signals).
 * Only executes if a ComplianceEnricher was provided. Mirrors `runCompliance()` in the pipeline.
 */
export class EnrichComplianceStep implements PipelineStep {
  readonly name = "enrich-compliance";

  constructor(private readonly complianceEnricher?: ComplianceEnricher) {}

  async execute(ctx: PipelineContext): Promise<StepOutput> {
    if (!this.complianceEnricher) {
      return {};
    }

    const parsed = ctx.store.require<ParsedInvoiceData>(POST_ENGINE_CTX.RECOVERED_PARSED);
    const tenantId = toUUID(ctx.input.tenantId);
    const vendorFingerprint = ctx.metadata.vendorFingerprint ?? "";
    const contentHash = ctx.metadata.vendorContentHash ?? "";
    // Post hierarchy-pivot: compliance enricher is scoped per client-org.
    // The pipeline input gains a `clientOrgId` (sub-PR 4: ingestion). Until
    // that lands, skip enrichment if clientOrgId is missing rather than
    // fan out across all client-orgs of the tenant.
    const clientOrgIdRaw = (ctx.input as { clientOrgId?: Types.ObjectId | string }).clientOrgId;
    if (!clientOrgIdRaw) {
      logger.info("compliance.enrich.skipped.no_client_org", { tenantId });
      return {};
    }
    const clientOrgId = typeof clientOrgIdRaw === "string"
      ? new Types.ObjectId(clientOrgIdRaw)
      : clientOrgIdRaw;

    try {
      const compliance = await this.complianceEnricher.enrich(parsed, tenantId, clientOrgId, vendorFingerprint, { contentHash });
      ctx.store.set(POST_ENGINE_CTX.COMPLIANCE, compliance);
    } catch (error) {
      logger.warn("compliance.enrich.failed", {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {};
  }
}

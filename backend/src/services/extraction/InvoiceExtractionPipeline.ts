import type { FieldVerifier } from "../../core/interfaces/FieldVerifier.js";
import type { ExtractedField, OcrBlock, OcrPageImage, OcrProvider, OcrResult } from "../../core/interfaces/OcrProvider.js";
import { postProcessOcrResult, type EnhancedOcrResult } from "../../ocr/ocrPostProcessor.js";
import { parseInvoiceText } from "../../parser/invoiceParser.js";
import type {
  InvoiceExtractionData,
  InvoiceFieldProvenance,
  InvoiceLineItemProvenance,
  ParsedInvoiceData
} from "../../types/invoice.js";
import { logger } from "../../utils/logger.js";
import { assessInvoiceConfidence } from "../confidenceAssessment.js";
import type { ComplianceEnricher } from "../compliance/ComplianceEnricher.js";
import { RiskSignalEvaluator } from "../compliance/RiskSignalEvaluator.js";
import type { ExtractionLearningStore } from "./extractionLearningStore.js";
import type { ExtractionMappingService } from "./extractionMappingService.js";
import type { DetectedInvoiceLanguage } from "./languageDetection.js";
import { detectInvoiceLanguage, detectInvoiceLanguageBeforeOcr } from "./languageDetection.js";
import type { PipelineExtractionResult } from "./types.js";
import type { VendorTemplateSnapshot, VendorTemplateStore } from "./vendorTemplateStore.js";
import { validateInvoiceFields } from "./deterministicValidation.js";
import {
  clampProbability,
  formatConfidence,
  resolveDetectedLanguage,
  resolvePreOcrLanguageHint,
  uniqueIssues
} from "./invoiceExtractionPipelineHelpers.js";
import { addFieldDiagnosticsToMetadata, calibrateDocumentConfidence } from "./pipeline/diagnostics.js";
import { buildFieldCandidates, buildFieldRegions } from "./pipeline/fieldCandidates.js";
import {
  buildRankedOcrTextCandidates,
  type RankedOcrTextCandidate
} from "./pipeline/ocrTextCandidates.js";
import { classifyOcrRecoveryStrategy, recoverParsedFromOcr } from "./pipeline/ocrRecovery.js";
import type { OcrRecoveryStrategy } from "./pipeline/lineItemRecovery.js";
import {
  collectLineItemConfidence,
  mergeClassification,
  normalizeClassification,
  normalizeFieldConfidence,
  normalizeFieldProvenance,
  normalizeLineItemProvenance,
  resolveLineItemProvenance
} from "./pipeline/provenance.js";
import { computeVendorFingerprint } from "./vendorFingerprint.js";
import * as fs from "fs/promises";
import * as path from "path";
import { DocumentProcessingEngine } from "../../core/engine/DocumentProcessingEngine.js";
import {
  InvoiceDocumentDefinition,
  type InvoiceSlmOutput,
  type InvoiceSlmContext,
  type InvoiceValidationContext
} from "./InvoiceDocumentDefinition.js";
import { EXTRACTION_SOURCE, type ExtractionSource } from "../../core/engine/extractionSource.js";

const OCR_RECOVERY_STRATEGY_SOURCE: Record<OcrRecoveryStrategy, ExtractionSource> = {
  generic: EXTRACTION_SOURCE.SLM_GENERIC,
  invoice_table: EXTRACTION_SOURCE.SLM_INVOICE_TABLE,
  receipt_statement: EXTRACTION_SOURCE.SLM_RECEIPT_STATEMENT,
};

type PipelineErrorCode = "FAILED_OCR" | "FAILED_PARSE";

interface ExtractionPipelineInput {
  tenantId: string;
  sourceKey: string;
  attachmentName: string;
  fileBuffer: Buffer;
  mimeType: string;
  expectedMaxTotal: number;
  expectedMaxDueDays: number;
  autoSelectMin: number;
  referenceDate?: Date;
}

interface ExtractionPipelineOptions {
  ocrHighConfidenceThreshold?: number;
  enableOcrKeyValueGrounding?: boolean;
  llmAssistConfidenceThreshold?: number;
  learningMode?: "active" | "assistive";
  ocrDumpEnabled?: boolean;
  llamaExtractEnabled?: boolean;
}

interface LanguageResolution {
  preOcr: DetectedInvoiceLanguage;
  postOcr: DetectedInvoiceLanguage;
  resolved: DetectedInvoiceLanguage;
}

export class ExtractionPipelineError extends Error {
  constructor(readonly code: PipelineErrorCode, message: string) {
    super(message);
    this.name = "ExtractionPipelineError";
  }
}

interface ExtractionPipelineDeps {
  ocrProvider: OcrProvider;
  fieldVerifier: FieldVerifier;
  templateStore: VendorTemplateStore;
  learningStore?: ExtractionLearningStore;
  complianceEnricher?: ComplianceEnricher;
  mappingService?: ExtractionMappingService;
}

export class InvoiceExtractionPipeline {
  private readonly ocrProvider: OcrProvider;
  private readonly fieldVerifier: FieldVerifier;
  private readonly templateStore: VendorTemplateStore;
  private readonly learningStore?: ExtractionLearningStore;
  private readonly complianceEnricher?: ComplianceEnricher;
  private readonly mappingService?: ExtractionMappingService;
  private readonly ocrHighConfidenceThreshold: number;
  private readonly enableOcrKeyValueGrounding: boolean;
  private readonly llmAssistConfidenceThreshold: number;
  private readonly learningMode: "active" | "assistive";
  private readonly ocrDumpEnabled: boolean;
  private readonly llamaExtractEnabled: boolean;

  constructor(deps: ExtractionPipelineDeps, options?: ExtractionPipelineOptions) {
    this.ocrProvider = deps.ocrProvider;
    this.fieldVerifier = deps.fieldVerifier;
    this.templateStore = deps.templateStore;
    this.learningStore = deps.learningStore;
    this.complianceEnricher = deps.complianceEnricher;
    this.mappingService = deps.mappingService;
    this.ocrHighConfidenceThreshold = clampProbability(options?.ocrHighConfidenceThreshold ?? 0.88);
    this.enableOcrKeyValueGrounding = options?.enableOcrKeyValueGrounding ?? true;
    this.llmAssistConfidenceThreshold = options?.llmAssistConfidenceThreshold ?? 85;
    this.learningMode = options?.learningMode ?? "assistive";
    this.ocrDumpEnabled = options?.ocrDumpEnabled ?? process.env.OCR_DUMP_ENABLED === "true";
    this.llamaExtractEnabled = options?.llamaExtractEnabled ?? false;
  }

  async extract(input: ExtractionPipelineInput): Promise<PipelineExtractionResult> {
    const metadata: Record<string, string> = {};
    const processingIssues: string[] = [];

    const fingerprint = computeVendorFingerprint({
      buffer: input.fileBuffer,
      mimeType: input.mimeType,
      sourceKey: input.sourceKey,
      attachmentName: input.attachmentName
    });

    metadata.vendorFingerprint = fingerprint.key;
    metadata.layoutSignature = fingerprint.layoutSignature;

    const template = await this.templateStore.findByFingerprint(input.tenantId, fingerprint.key);
    metadata.vendorTemplateMatched = template ? "true" : "false";

    const preOcrLanguage = detectInvoiceLanguageBeforeOcr(input);
    const preOcrLanguageHint = resolvePreOcrLanguageHint(preOcrLanguage, input.mimeType);
    metadata.preOcrLanguage = preOcrLanguage.code;
    metadata.preOcrLanguageConfidence = formatConfidence(preOcrLanguage.confidence);
    metadata.preOcrLanguageHintReason = preOcrLanguageHint.reason;
    if (preOcrLanguageHint.hint) {
      metadata.preOcrLanguageHint = preOcrLanguageHint.hint;
    }

    const definition = new InvoiceDocumentDefinition();
    const engine = new DocumentProcessingEngine<InvoiceSlmOutput>(
      definition,
      this.fieldVerifier,
      this.ocrProvider
    );

    let capturedEnhanced: EnhancedOcrResult | null = null;
    let capturedRankedCandidates: RankedOcrTextCandidate[] = [];
    let capturedPrimaryCandidate: RankedOcrTextCandidate | null = null;
    let capturedAugmentedText = "";
    let capturedOcrBlocks: OcrBlock[] = [];
    let capturedOcrPageImages: OcrPageImage[] = [];
    let capturedOcrConfidence = 0;
    let capturedOcrTokens = 0;
    let capturedExtractFields: ExtractedField[] | undefined;

    const afterOcr = async (ocrResult: OcrResult, _ocrText: string) => {
      capturedOcrBlocks = ocrResult.blocks ?? [];
      capturedOcrPageImages = ocrResult.pageImages ?? [];
      capturedOcrTokens = ocrResult.tokenUsage?.totalTokens ?? 0;
      capturedExtractFields = ocrResult.fields;

      if (this.ocrDumpEnabled) {
        const enhanced = postProcessOcrResult(ocrResult);
        await this.saveOcrResult(ocrResult, enhanced);
        capturedEnhanced = enhanced;
      } else {
        capturedEnhanced = postProcessOcrResult(ocrResult);
      }

      const rawText = ocrResult.text.trim();
      const textCandidates = buildRankedOcrTextCandidates({
        rawText,
        blocks: ocrResult.blocks ?? [],
        layoutLines: capturedEnhanced.lines,
        enableKeyValueGrounding: this.enableOcrKeyValueGrounding
      });

      capturedRankedCandidates = textCandidates.ranked;
      capturedPrimaryCandidate = textCandidates.primary;
      capturedAugmentedText = textCandidates.augmentedText;

      const calibrated = calibrateDocumentConfidence(ocrResult.confidence, rawText, textCandidates.primary.text);
      capturedOcrConfidence = calibrated.score;

      metadata.ocrPrimaryVariant = textCandidates.primary.id;
      metadata.ocrPrimaryVariantScore = textCandidates.primary.score.toFixed(3);
      metadata.ocrPrimaryTokenCount = String(textCandidates.primary.metrics.tokenCount);
      metadata.ocrCandidateCount = String(textCandidates.ranked.length);
      metadata.ocrHasKeyValueGrounding = textCandidates.keyValueText.length > 0 ? "true" : "false";
      metadata.ocrHasAugmentedContext = textCandidates.augmentedText.length > 0 ? "true" : "false";
      metadata.ocrLowQualityTokenRatio = formatConfidence(textCandidates.primary.metrics.lowQualityTokenRatio);
      metadata.ocrDuplicateLineRatio = formatConfidence(textCandidates.primary.metrics.duplicateLineRatio);

      const post = detectInvoiceLanguage(textCandidates.ranked.map((candidate) => candidate.text));
      const resolved = resolveDetectedLanguage(preOcrLanguage, post);

      metadata.postOcrLanguage = post.code;
      metadata.postOcrLanguageConfidence = formatConfidence(post.confidence);
      metadata.documentLanguage = resolved.code;
      metadata.documentLanguageConfidence = formatConfidence(resolved.confidence);

      const language: LanguageResolution = { preOcr: preOcrLanguage, postOcr: post, resolved };

      const primary = capturedPrimaryCandidate!.text;

      if ((capturedExtractFields?.length ?? 0) > 0) {
        return;
      }

      if (this.llamaExtractEnabled) {
        processingIssues.push("LlamaExtract returned no structured fields.");
        return;
      }

      const baseline = parseInvoiceText(primary, { languageHint: language.resolved.code });
      const fieldCandidates = buildFieldCandidates(primary, baseline.parsed, template);
      const fieldRegions = buildFieldRegions(capturedOcrBlocks, fieldCandidates);

      metadata.baselineFieldCount = String(Object.keys(baseline.parsed).length);
      metadata.baselineWarningCount = String(baseline.warnings.length);
      metadata.fieldCandidateCount = String(Object.keys(fieldCandidates).length);
      metadata.fieldRegionCount = String(Object.keys(fieldRegions).length);

      const slmCtx: InvoiceSlmContext = {
        mimeType: input.mimeType,
        attachmentName: input.attachmentName,
        template,
        language,
        enhanced: capturedEnhanced!,
        primaryCandidate: capturedPrimaryCandidate!,
        rankedCandidates: capturedRankedCandidates,
        augmentedText: capturedAugmentedText,
        ocrConfidence: capturedOcrConfidence,
        ocrPageImages: capturedOcrPageImages,
        baselineParsed: baseline.parsed,
        fieldCandidates,
        fieldRegions,
        ocrHighConfidenceThreshold: this.ocrHighConfidenceThreshold,
        llmAssistConfidenceThreshold: this.llmAssistConfidenceThreshold,
        learningMode: this.learningMode
      };
      definition.setSlmContext(slmCtx);

      const validationCtx: InvoiceValidationContext = {
        expectedMaxTotal: input.expectedMaxTotal,
        expectedMaxDueDays: input.expectedMaxDueDays,
        referenceDate: input.referenceDate,
        ocrText: primary
      };
      definition.setValidationContext(validationCtx);
    };

    let engineResult: import("../../core/engine/types.js").ProcessingResult<InvoiceSlmOutput> | undefined;
    try {
      engineResult = await engine.process(
        {
          tenantId: input.tenantId,
          fileName: input.attachmentName,
          mimeType: input.mimeType,
          fileBuffer: input.fileBuffer,
          ocrLanguageHint: preOcrLanguageHint.hint
        },
        undefined,
        afterOcr
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Empty OCR")) {
        throw new ExtractionPipelineError("FAILED_OCR", "Empty OCR");
      }
      throw error;
    }

    if (!engineResult) {
      throw new ExtractionPipelineError("FAILED_OCR", "Engine returned no result.");
    }

    const primaryCandidate = capturedPrimaryCandidate as RankedOcrTextCandidate | null;
    const primaryText: string = primaryCandidate !== null ? primaryCandidate.text : engineResult.ocrText;
    const ocrBlocks = capturedOcrBlocks;
    const ocrPageImages = capturedOcrPageImages;
    const ocrConfidence = capturedOcrConfidence;
    const ocrTokens = capturedOcrTokens;

    if (engineResult.strategy === "llamaextract") {
      const slmOutput = engineResult.output;
      const parsed = slmOutput.parsed;
      const fieldProvenance = slmOutput.fieldProvenance ?? {};

      const compliance = await this.runCompliance(parsed, input, fingerprint);
      let confidence = this.assessConfidence(input, parsed, processingIssues, ocrConfidence);
      if (compliance?.riskSignals?.length) {
        const penalty = RiskSignalEvaluator.sumPenalties(compliance.riskSignals);
        confidence = this.assessConfidenceWithPenalty(input, parsed, processingIssues, ocrConfidence, penalty);
      }

      const extraction: InvoiceExtractionData = {
        source: EXTRACTION_SOURCE.LLAMA_EXTRACT,
        strategy: EXTRACTION_SOURCE.LLAMA_EXTRACT,
        ...(Object.keys(fieldProvenance).length > 0 ? { fieldProvenance } : {})
      };

      return {
        provider: this.ocrProvider.name,
        text: primaryText,
        confidence: ocrConfidence,
        source: EXTRACTION_SOURCE.LLAMA_EXTRACT,
        strategy: EXTRACTION_SOURCE.LLAMA_EXTRACT,
        parseResult: { parsed, warnings: processingIssues },
        confidenceAssessment: confidence,
        attempts: [],
        ocrBlocks,
        ocrPageImages,
        processingIssues: uniqueIssues(processingIssues),
        metadata,
        ocrTokens,
        slmTokens: 0,
        compliance,
        extraction
      };
    }

    const slm = engineResult.output;
    processingIssues.push(...slm.issues);

    const capturedSlmContext = definition.slmContext;
    const baselineParsed: ParsedInvoiceData = capturedSlmContext?.baselineParsed ?? {};

    const mergedParsed = mergeParsedInvoiceData(baselineParsed, slm.parsed);
    const parsed = recoverParsedFromOcr(mergedParsed, ocrBlocks, primaryText);
    const recoveryStrategy = classifyOcrRecoveryStrategy(ocrBlocks, primaryText);
    metadata.ocrRecoveryStrategy = recoveryStrategy;

    const validation = validateInvoiceFields({
      parsed,
      ocrText: primaryText,
      expectedMaxTotal: input.expectedMaxTotal,
      expectedMaxDueDays: input.expectedMaxDueDays,
      referenceDate: input.referenceDate
    });

    if (!validation.valid) {
      processingIssues.push(...validation.issues);
    }

    const fieldCandidates = capturedSlmContext?.fieldCandidates ?? {};
    const fieldRegions = capturedSlmContext?.fieldRegions ?? {};

    const diagnostics = addFieldDiagnosticsToMetadata({
      metadata,
      parsed,
      ocrBlocks,
      fieldRegions,
      source: EXTRACTION_SOURCE.SLM_DIRECT,
      ocrConfidence,
      validationIssues: validation.issues,
      warnings: processingIssues,
      templateAppliedFields: new Set<string>(),
      verifierChangedFields: slm.changedFields,
      verifierFieldConfidence: slm.fieldConfidence,
      verifierFieldProvenance: slm.fieldProvenance
    });

    const compliance = await this.runCompliance(parsed, input, fingerprint);

    let confidence = this.assessConfidence(input, parsed, processingIssues, ocrConfidence);

    if (compliance?.riskSignals?.length) {
      const penalty = RiskSignalEvaluator.sumPenalties(compliance.riskSignals);
      confidence = this.assessConfidenceWithPenalty(input, parsed, processingIssues, ocrConfidence, penalty);
    }

    const lineItemProvenance = resolveLineItemProvenance({
      lineItems: parsed.lineItems,
      ocrBlocks,
      verifierLineItemProvenance: slm.lineItemProvenance
    });
    const lineItemConfidence = collectLineItemConfidence(lineItemProvenance);
    const combinedFieldConfidence =
      Object.keys(lineItemConfidence).length > 0
        ? { ...diagnostics.fieldConfidence, ...lineItemConfidence }
        : diagnostics.fieldConfidence;
    const classification = mergeClassification(slm.classification, compliance?.tds?.section);

    const extraction: InvoiceExtractionData = {
      source: EXTRACTION_SOURCE.SLM_DIRECT,
      strategy: OCR_RECOVERY_STRATEGY_SOURCE[recoveryStrategy],
      ...(classification ? { classification } : {}),
      ...(classification?.invoiceType ? { invoiceType: classification.invoiceType } : {}),
      ...(Object.keys(combinedFieldConfidence).length > 0 ? { fieldConfidence: combinedFieldConfidence } : {}),
      ...(Object.keys(diagnostics.fieldProvenance).length > 0 ? { fieldProvenance: diagnostics.fieldProvenance } : {}),
      ...(lineItemProvenance.length > 0 ? { lineItemProvenance } : {})
    };

    return {
      provider: this.ocrProvider.name,
      text: primaryText,
      confidence: ocrConfidence,
      source: EXTRACTION_SOURCE.SLM_DIRECT,
      strategy: extraction.strategy ?? EXTRACTION_SOURCE.SLM_DIRECT,
      parseResult: { parsed, warnings: processingIssues },
      confidenceAssessment: confidence,
      attempts: [],
      ocrBlocks,
      ocrPageImages,
      processingIssues: uniqueIssues(processingIssues),
      metadata,
      ocrTokens,
      slmTokens: slm.tokens,
      compliance,
      extraction
    };
  }

  private async runCompliance(
    parsed: ParsedInvoiceData,
    input: ExtractionPipelineInput,
    fingerprint: ReturnType<typeof computeVendorFingerprint>
  ) {
    if (!this.complianceEnricher) return;
    try {
      return await this.complianceEnricher.enrich(parsed, input.tenantId, fingerprint.key, {
        contentHash: fingerprint.hash
      });
    } catch {
      return;
    }
  }

  private assessConfidence(input: ExtractionPipelineInput, parsed: ParsedInvoiceData, warnings: string[], ocrConfidence?: number) {
    return assessInvoiceConfidence({
      ocrConfidence,
      parsed,
      warnings,
      expectedMaxTotal: input.expectedMaxTotal,
      expectedMaxDueDays: input.expectedMaxDueDays,
      autoSelectMin: input.autoSelectMin,
      referenceDate: input.referenceDate
    });
  }

  private assessConfidenceWithPenalty(
      input: ExtractionPipelineInput,
      parsed: ParsedInvoiceData,
      warnings: string[],
      ocrConfidence: number | undefined,
      penalty: number
  ) {
    return assessInvoiceConfidence({
      ocrConfidence,
      parsed,
      warnings,
      expectedMaxTotal: input.expectedMaxTotal,
      expectedMaxDueDays: input.expectedMaxDueDays,
      autoSelectMin: input.autoSelectMin,
      referenceDate: input.referenceDate,
      complianceRiskPenalty: penalty
    });
  }

  async saveOcrResult(result: OcrResult, enhanced: EnhancedOcrResult) {
    const filePath = path.join("/tmp", "ocr_dumps", `${Date.now()}.json`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ raw: result, enhanced }, null, 2));
    logger.info("ocr.dump.saved", { filePath });
  }

  private resolveLanguage(
    preOcrLanguage: DetectedInvoiceLanguage,
    rankedCandidates: RankedOcrTextCandidate[],
    metadata: Record<string, string>
  ): LanguageResolution {
    const post = detectInvoiceLanguage(rankedCandidates.map((candidate) => candidate.text));
    const resolved = resolveDetectedLanguage(preOcrLanguage, post);

    metadata.postOcrLanguage = post.code;
    metadata.postOcrLanguageConfidence = formatConfidence(post.confidence);
    metadata.documentLanguage = resolved.code;
    metadata.documentLanguageConfidence = formatConfidence(resolved.confidence);

    return { preOcr: preOcrLanguage, postOcr: post, resolved };
  }
}

function mergeParsedInvoiceData(base: ParsedInvoiceData, override: ParsedInvoiceData): ParsedInvoiceData {
  const baseNormalized = sanitizeParsedInvoiceData(base);
  const overrideNormalized = sanitizeParsedInvoiceData(override);
  const merged: ParsedInvoiceData = {
    ...baseNormalized,
    ...overrideNormalized
  };

  if (baseNormalized.gst || overrideNormalized.gst) {
    merged.gst = {
      ...(baseNormalized.gst ?? {}),
      ...(overrideNormalized.gst ?? {})
    };
  }

  if (overrideNormalized.lineItems && overrideNormalized.lineItems.length > 0) {
    merged.lineItems = overrideNormalized.lineItems;
  } else if (baseNormalized.lineItems && baseNormalized.lineItems.length > 0) {
    merged.lineItems = baseNormalized.lineItems;
  }

  const notes = uniqueIssues([...(baseNormalized.notes ?? []), ...(overrideNormalized.notes ?? [])]);
  if (notes.length > 0) {
    merged.notes = notes;
  }

  return sanitizeParsedInvoiceData(merged);
}

function sanitizeParsedInvoiceData(parsed: ParsedInvoiceData | undefined): ParsedInvoiceData {
  if (!parsed) {
    return {};
  }

  const normalized: ParsedInvoiceData = {};
  const copyString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const invoiceNumber = copyString(parsed.invoiceNumber);
  if (invoiceNumber) {
    normalized.invoiceNumber = invoiceNumber;
  }
  const vendorName = copyString(parsed.vendorName);
  if (vendorName) {
    normalized.vendorName = vendorName;
  }
  const invoiceDate = copyString(parsed.invoiceDate);
  if (invoiceDate) {
    normalized.invoiceDate = invoiceDate;
  }
  const dueDate = copyString(parsed.dueDate);
  if (dueDate) {
    normalized.dueDate = dueDate;
  }
  const currency = copyString(parsed.currency);
  if (currency) {
    normalized.currency = currency.toUpperCase();
  }
  if (Number.isInteger(parsed.totalAmountMinor) && (parsed.totalAmountMinor ?? 0) > 0) {
    normalized.totalAmountMinor = parsed.totalAmountMinor;
  }

  const notes = uniqueIssues(parsed.notes ?? []);
  if (notes.length > 0) {
    normalized.notes = notes;
  }

  const gst = parsed.gst;
  if (gst) {
    const normalizedGst: NonNullable<ParsedInvoiceData["gst"]> = {};
    if (copyString(gst.gstin)) {
      normalizedGst.gstin = gst.gstin?.trim();
    }
    for (const field of [
      "subtotalMinor",
      "cgstMinor",
      "sgstMinor",
      "igstMinor",
      "cessMinor",
      "totalTaxMinor"
    ] as const) {
      const value = gst[field];
      if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
        normalizedGst[field] = value;
      }
    }
    if (Object.keys(normalizedGst).length > 0) {
      normalized.gst = normalizedGst;
    }
  }

  if (Array.isArray(parsed.lineItems)) {
    const lineItems = parsed.lineItems
      .map((item) => {
        const description = copyString(item.description) ?? "";
        if (!Number.isInteger(item.amountMinor) || item.amountMinor <= 0) {
          return undefined;
        }
        return {
          ...item,
          description
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (lineItems.length > 0) {
      normalized.lineItems = lineItems;
    }
  }

  const pan = copyString(parsed.pan);
  if (pan) {
    normalized.pan = pan.toUpperCase();
  }
  const bankAccountNumber = copyString(parsed.bankAccountNumber);
  if (bankAccountNumber) {
    normalized.bankAccountNumber = bankAccountNumber;
  }
  const bankIfsc = copyString(parsed.bankIfsc);
  if (bankIfsc) {
    normalized.bankIfsc = bankIfsc.toUpperCase();
  }

  return normalized;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

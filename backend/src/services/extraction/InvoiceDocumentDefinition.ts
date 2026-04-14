import type { OcrBlock, OcrPageImage } from "../../core/interfaces/OcrProvider.js";
import type { SinglePassDocumentDefinition, ExtractionSchema } from "../../core/engine/DocumentDefinition.js";
import { DOC_TYPE } from "../../core/engine/DocumentDefinition.js";
import type { ValidationResult } from "../../core/engine/types.js";
import { INVOICE_EXTRACT_SCHEMA } from "../../ocr/llamaExtractSchema.js";
import type {
  InvoiceExtractionData,
  InvoiceFieldProvenance,
  InvoiceLineItemProvenance,
  ParsedInvoiceData
} from "../../types/invoice.js";
import type { EnhancedOcrResult } from "../../ocr/ocrPostProcessor.js";
import type { RankedOcrTextCandidate } from "./pipeline/ocrTextCandidates.js";
import type { DetectedInvoiceLanguage } from "./languageDetection.js";
import type { VendorTemplateSnapshot } from "./vendorTemplateStore.js";
import { uniqueIssues } from "./invoiceExtractionPipelineHelpers.js";
import { validateInvoiceFields } from "./deterministicValidation.js";

export interface InvoiceSlmOutput {
  parsed: ParsedInvoiceData;
  tokens: number;
  issues: string[];
  changedFields: string[];
  fieldConfidence?: Record<string, number>;
  fieldProvenance?: Record<string, InvoiceFieldProvenance>;
  lineItemProvenance: InvoiceLineItemProvenance[];
  classification?: InvoiceExtractionData["classification"];
}

export interface InvoiceSlmContext {
  mimeType: string;
  attachmentName: string;
  template: VendorTemplateSnapshot | undefined;
  language: {
    preOcr: DetectedInvoiceLanguage;
    postOcr: DetectedInvoiceLanguage;
    resolved: DetectedInvoiceLanguage;
  };
  enhanced: EnhancedOcrResult;
  primaryCandidate: RankedOcrTextCandidate;
  rankedCandidates: RankedOcrTextCandidate[];
  augmentedText: string;
  ocrConfidence: number;
  ocrPageImages: OcrPageImage[];
  baselineParsed: ParsedInvoiceData;
  fieldCandidates: Record<string, string[]>;
  fieldRegions: Record<string, OcrBlock[]>;
  ocrHighConfidenceThreshold: number;
  llmAssistConfidenceThreshold: number;
  learningMode: string;
}

export interface InvoiceValidationContext {
  expectedMaxTotal: number;
  expectedMaxDueDays: number;
  referenceDate?: Date;
  ocrText: string;
}

export class InvoiceDocumentDefinition implements SinglePassDocumentDefinition<InvoiceSlmOutput> {
  readonly docType = DOC_TYPE.INVOICE;
  readonly extractionSchema: ExtractionSchema = INVOICE_EXTRACT_SCHEMA as ExtractionSchema;

  private _slmContext: InvoiceSlmContext | null = null;
  private _validationContext: InvoiceValidationContext | null = null;

  get slmContext(): InvoiceSlmContext | null {
    return this._slmContext;
  }

  setSlmContext(ctx: InvoiceSlmContext): void {
    this._slmContext = ctx;
  }

  setValidationContext(ctx: InvoiceValidationContext): void {
    this._validationContext = ctx;
  }

  buildPrompt(_ocrText: string, _blocks: OcrBlock[], _pageImages: OcrPageImage[]): string {
    if (!this._slmContext) {
      return _ocrText;
    }
    return this._slmContext.augmentedText || this._slmContext.primaryCandidate.text;
  }

  parseOutput(raw: string | Record<string, unknown>): InvoiceSlmOutput {
    if (typeof raw === "string") {
      return this.parseFromVerifierResult(raw);
    }
    return this.parseFromExtractFields(raw);
  }

  private parseFromVerifierResult(rawJson: string): InvoiceSlmOutput {
    let parsedData: ParsedInvoiceData | undefined;
    try {
      parsedData = JSON.parse(rawJson) as ParsedInvoiceData;
    } catch {
      parsedData = undefined;
    }

    if (!parsedData || Object.keys(parsedData).length === 0) {
      return {
        parsed: this._slmContext?.baselineParsed ?? {},
        tokens: 0,
        issues: ["SLM verification failed. Falling back to OCR heuristics."],
        changedFields: [],
        lineItemProvenance: []
      };
    }

    const baselineParsed = this._slmContext?.baselineParsed ?? {};
    const normalizedParsed = sanitizeParsedInvoiceData(parsedData);
    const parsed = Object.keys(normalizedParsed).length > 0 ? normalizedParsed : baselineParsed;

    return {
      parsed,
      tokens: 0,
      issues: [],
      changedFields: [],
      lineItemProvenance: []
    };
  }

  private parseFromExtractFields(fields: Record<string, unknown>): InvoiceSlmOutput {
    const parsed: ParsedInvoiceData = {};

    const getString = (key: string): string | undefined => {
      const val = fields[key];
      if (typeof val !== "string" || val.trim() === "") return undefined;
      return val.trim();
    };

    const getNumber = (key: string): number | undefined => {
      const val = fields[key];
      if (typeof val !== "number" || val === null) return undefined;
      return val;
    };

    const invoiceNumber = getString("invoice_number");
    if (invoiceNumber) parsed.invoiceNumber = invoiceNumber;

    const vendorName = getString("vendor_name");
    if (vendorName) parsed.vendorName = vendorName;

    const invoiceDate = getString("invoice_date");
    if (invoiceDate) parsed.invoiceDate = invoiceDate;

    const dueDate = getString("due_date");
    if (dueDate) parsed.dueDate = dueDate;

    const currency = getString("currency");
    if (currency) parsed.currency = currency;

    const totalAmountRaw = getNumber("total_amount");
    if (totalAmountRaw !== undefined) parsed.totalAmountMinor = Math.round(totalAmountRaw * 100);

    const pan = getString("pan");
    if (pan) parsed.pan = pan;

    const subtotalRaw = getNumber("subtotal");
    const cgstRaw = getNumber("cgst_amount");
    const sgstRaw = getNumber("sgst_amount");
    const igstRaw = getNumber("igst_amount");
    const cessRaw = getNumber("cess_amount");
    const gstin = getString("gstin");

    const totalTaxRaw = (cgstRaw ?? 0) + (sgstRaw ?? 0) + (igstRaw ?? 0) + (cessRaw ?? 0);
    const hasGst = subtotalRaw !== undefined || cgstRaw !== undefined || sgstRaw !== undefined || igstRaw !== undefined || cessRaw !== undefined || gstin !== undefined;

    if (hasGst) {
      const gst: NonNullable<ParsedInvoiceData["gst"]> = {};
      if (subtotalRaw !== undefined) gst.subtotalMinor = Math.round(subtotalRaw * 100);
      if (cgstRaw !== undefined) gst.cgstMinor = Math.round(cgstRaw * 100);
      if (sgstRaw !== undefined) gst.sgstMinor = Math.round(sgstRaw * 100);
      if (igstRaw !== undefined) gst.igstMinor = Math.round(igstRaw * 100);
      if (cessRaw !== undefined) gst.cessMinor = Math.round(cessRaw * 100);
      if (totalTaxRaw > 0) gst.totalTaxMinor = Math.round(totalTaxRaw * 100);
      if (gstin !== undefined) gst.gstin = gstin;
      parsed.gst = gst;
    }

    return {
      parsed,
      tokens: 0,
      issues: [],
      changedFields: [],
      lineItemProvenance: []
    };
  }

  validateOutput(output: InvoiceSlmOutput): ValidationResult {
    if (!this._validationContext) {
      return { valid: true, issues: [] };
    }
    const result = validateInvoiceFields({
      parsed: output.parsed,
      ocrText: this._validationContext.ocrText,
      expectedMaxTotal: this._validationContext.expectedMaxTotal,
      expectedMaxDueDays: this._validationContext.expectedMaxDueDays,
      referenceDate: this._validationContext.referenceDate
    });
    return result;
  }

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

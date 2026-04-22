import type { InvoiceExtractionData, InvoiceFieldProvenance, InvoiceFieldKey } from "@/types/invoice.js";
import type { ExtractionSource } from "@/core/engine/extractionSource.js";
import { normalizeBoxTuple } from "@/services/ingestion/box.js";
import { normalizeConfidence } from "@/utils/math.js";

const EXTRACTION_KEY_DOT_TOKEN = "__dot__";

type FieldProvenanceEntry = InvoiceFieldProvenance;

function encodeExtractionFieldKey(field: string): string {
  return field.replace(/\./g, EXTRACTION_KEY_DOT_TOKEN);
}

function sanitizeFieldProvenanceRecord(
  value: Record<string, InvoiceFieldProvenance> | undefined
): Record<string, FieldProvenanceEntry> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const output: Record<string, FieldProvenanceEntry> = {};
  for (const [field, rawEntry] of Object.entries(value)) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }
    const candidate = rawEntry as Partial<FieldProvenanceEntry>;
    const bbox = normalizeBoxTuple(candidate.bbox);
    const bboxNormalized = normalizeBoxTuple(candidate.bboxNormalized);
    const bboxModel = normalizeBoxTuple(candidate.bboxModel);
    if (!bbox && !bboxNormalized && !bboxModel) {
      continue;
    }
    const confidence = Number(candidate.confidence);
    output[field] = {
      source: typeof candidate.source === "string" ? candidate.source : undefined,
      page: typeof candidate.page === "number" && Number.isFinite(candidate.page) ? Math.max(1, Math.round(candidate.page)) : 1,
      ...(bbox ? { bbox } : {}),
      ...(bboxNormalized ? { bboxNormalized } : {}),
      ...(bboxModel ? { bboxModel } : {}),
      ...(typeof candidate.blockIndex === "number" && Number.isFinite(candidate.blockIndex)
        ? { blockIndex: Math.max(0, Math.round(candidate.blockIndex)) }
        : {}),
      ...(Number.isFinite(confidence)
        ? { confidence: normalizeConfidence(confidence) }
        : {})
    };
  }
  return output;
}

export function normalizeExtractionData(value: InvoiceExtractionData | undefined): InvoiceExtractionData | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = typeof value.source === "string" && value.source.trim().length > 0 ? value.source.trim() as ExtractionSource : undefined;
  const strategy = typeof value.strategy === "string" && value.strategy.trim().length > 0 ? value.strategy.trim() as ExtractionSource : undefined;
  const invoiceType =
    typeof value.invoiceType === "string" && value.invoiceType.trim().length > 0 ? value.invoiceType.trim() : undefined;
  const classification =
    value.classification && typeof value.classification === "object"
      ? {
          ...(typeof value.classification.invoiceType === "string" && value.classification.invoiceType.trim().length > 0
            ? { invoiceType: value.classification.invoiceType.trim() }
            : {}),
          ...(typeof value.classification.category === "string" && value.classification.category.trim().length > 0
            ? { category: value.classification.category.trim() }
            : {}),
          ...(typeof value.classification.tdsSection === "string" && value.classification.tdsSection.trim().length > 0
            ? { tdsSection: value.classification.tdsSection.trim() }
            : {})
        }
      : undefined;

  const fieldConfidence: Partial<Record<InvoiceFieldKey, number>> = {};
  if (value.fieldConfidence && typeof value.fieldConfidence === "object") {
    for (const [field, rawValue] of Object.entries(value.fieldConfidence)) {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      fieldConfidence[encodeExtractionFieldKey(field) as InvoiceFieldKey] = normalizeConfidence(parsed);
    }
  }

  const fieldProvenanceRaw = sanitizeFieldProvenanceRecord(value.fieldProvenance);
  const fieldProvenance: Partial<Record<InvoiceFieldKey, FieldProvenanceEntry>> = Object.fromEntries(
    Object.entries(fieldProvenanceRaw).map(([field, provenance]) => [encodeExtractionFieldKey(field) as InvoiceFieldKey, provenance])
  );
  const lineItemProvenance = Array.isArray(value.lineItemProvenance) ? value.lineItemProvenance : [];

  const normalized: InvoiceExtractionData = {
    ...(source ? { source } : {}),
    ...(strategy ? { strategy } : {}),
    ...(invoiceType ? { invoiceType } : {}),
    ...(classification && Object.keys(classification).length > 0 ? { classification } : {}),
    ...(Object.keys(fieldConfidence).length > 0 ? { fieldConfidence } : {}),
    ...(Object.keys(fieldProvenance).length > 0 ? { fieldProvenance } : {}),
    ...(lineItemProvenance.length > 0 ? { lineItemProvenance } : {})
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

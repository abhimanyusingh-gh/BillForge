import type { SourceHighlight } from "./sourceHighlights";
import type { InvoiceStatus } from "./types";

export const STATUSES: Array<InvoiceStatus | "ALL"> = [
  "ALL",
  "PARSED",
  "NEEDS_REVIEW",
  "FAILED_OCR",
  "FAILED_PARSE",
  "APPROVED",
  "EXPORTED"
];

export function normalizeInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildFieldCropUrlMap(
  invoiceId: string,
  highlights: SourceHighlight[],
  resolveCropUrl: (invoiceId: string, blockIndex: number) => string
): Partial<Record<SourceHighlight["fieldKey"], string>> {
  const output: Partial<Record<SourceHighlight["fieldKey"], string>> = {};
  for (const highlight of highlights) {
    if (typeof highlight.blockIndex !== "number" || highlight.blockIndex < 0 || !highlight.cropPath) {
      continue;
    }
    output[highlight.fieldKey] = resolveCropUrl(invoiceId, highlight.blockIndex);
  }
  return output;
}

export function buildFieldOverlayUrlMap(
  invoiceId: string,
  highlights: SourceHighlight[],
  resolveOverlayUrl: (invoiceId: string, fieldKey: SourceHighlight["fieldKey"]) => string
): Partial<Record<SourceHighlight["fieldKey"], string>> {
  const output: Partial<Record<SourceHighlight["fieldKey"], string>> = {};
  for (const highlight of highlights) {
    if (!highlight.overlayPath) {
      continue;
    }
    output[highlight.fieldKey] = resolveOverlayUrl(invoiceId, highlight.fieldKey);
  }
  return output;
}

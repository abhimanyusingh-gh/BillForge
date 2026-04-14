import type { OcrBlock } from "@/core/interfaces/OcrProvider.js";
import { currencyBySymbol } from "@/ai/parsers/invoiceParser.js";

// ---------------------------------------------------------------------------
// Block-indexing types and helpers
// ---------------------------------------------------------------------------

/** A block with its original index and guaranteed non-null normalized bounding box. */
export interface IndexedBlock {
  block: OcrBlock;
  index: number;
  box: [number, number, number, number];
}

/** Convert an OcrBlock array into IndexedBlocks, filtering out those without bboxNormalized. */
export function indexBlocks(blocks: OcrBlock[]): IndexedBlock[] {
  const result: IndexedBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const box = blocks[i].bboxNormalized;
    if (box) {
      result.push({ block: blocks[i], index: i, box });
    }
  }
  return result;
}

/** Filter blocks whose vertical extent falls within [topY, bottomY + tolerance]. */
export function filterByRow(
  indexed: IndexedBlock[],
  topY: number,
  bottomY: number,
  tolerance: number = 0.002
): IndexedBlock[] {
  return indexed.filter((entry) => entry.box[1] >= topY && entry.box[3] <= bottomY + tolerance);
}

/** Filter blocks whose left edge is within `tolerance` of `anchorX`. */
export function filterByColumn(
  indexed: IndexedBlock[],
  anchorX: number,
  tolerance: number = 0.05
): IndexedBlock[] {
  return indexed.filter((entry) => Math.abs(entry.box[0] - anchorX) <= tolerance);
}

/** Extract the first numeric value from column-aligned blocks in a row region. */
export function extractColumnNumeric(
  blocks: OcrBlock[],
  headerIndex: number,
  topBoundary: number,
  bottomBoundary: number,
  parser: (text: string) => number | null
): number | undefined {
  const headerBox = blocks[headerIndex]?.bboxNormalized;
  if (!headerBox) return undefined;
  const candidates = filterByColumn(
    filterByRow(
      indexBlocks(blocks).filter((e) => e.index !== headerIndex),
      topBoundary,
      bottomBoundary
    ),
    headerBox[0]
  );
  for (const entry of candidates) {
    const value = parser(entry.block.text);
    if (value !== null) return value;
  }
  return undefined;
}

/**
 * Canonical month-name-to-number map, shared across date parsing utilities.
 */
function resolveMonthNumber(value: string): string | undefined {
  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12"
  };
  return months[value.trim().toLowerCase()];
}

/**
 * Normalize a raw text block into an ISO-style date (YYYY-MM-DD) if it contains
 * a recognisable named-date pattern (e.g. "January 15, 2024" or "15 Jan 2024").
 */
export function normalizeDateToken(text: string): string | undefined {
  const normalizedText = text.trim().replace(/[|]/g, "I");
  const patterns = [
    /\b([A-Z][a-z]+ \d{1,2}, \d{4})\b/,
    /\b(\d{1,2} [A-Z][a-z]{2} \d{4})\b/,
    /\b([A-Z][a-z]{2} \d{1,2}, \d{4})\b/
  ];
  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (!match) {
      continue;
    }
    const normalizedDate = normalizeDateValue(match[1]);
    if (normalizedDate) {
      return normalizedDate;
    }
  }
  return undefined;
}

/**
 * Parse a named date string like "January 15 2024" or "15 January 2024"
 * into ISO format "2024-01-15".
 */
export function normalizeDateValue(value: string): string | undefined {
  const sanitized = value.replace(/,/g, "").trim();
  const monthNameFirst = sanitized.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})$/);
  if (monthNameFirst) {
    const month = resolveMonthNumber(monthNameFirst[1]);
    if (month) {
      return `${monthNameFirst[3]}-${month}-${monthNameFirst[2].padStart(2, "0")}`;
    }
  }

  const dayFirst = sanitized.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (dayFirst) {
    const month = resolveMonthNumber(dayFirst[2]);
    if (month) {
      return `${dayFirst[3]}-${month}-${dayFirst[1].padStart(2, "0")}`;
    }
  }

  return undefined;
}

/**
 * Detect an explicit currency from OCR text and blocks. Shared between
 * documentFieldRecovery and totalsRecovery stages.
 */
export function detectExplicitCurrency(text: string, ocrBlocks: OcrBlock[] = []): string | undefined {
  const hasIndiaTaxContext = /\b(place of supply|gstin|cgst|sgst|igst|gst|tax invoice)\b/i.test(text) ||
    /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i.test(text) ||
    ocrBlocks.some((block) => /\b(gstin|cgst|sgst|igst|gst|place of supply)\b/i.test(block.text));
  const hasUsdContext = /\bUSD\b/i.test(text) || ocrBlocks.some((block) => /\bUSD\b/i.test(block.text));
  if (hasUsdContext) {
    return "USD";
  }
  if (/\$/.test(text) && !hasIndiaTaxContext) {
    return "USD";
  }
  if (/\bINR\b/i.test(text) || /₹/.test(text)) {
    return "INR";
  }
  if (hasIndiaTaxContext) {
    return "INR";
  }
  if (ocrBlocks.some((block) => /\$/.test(block.text) && !hasIndiaTaxContext)) {
    return "USD";
  }
  const symbolMatch = text.match(/([$€£₹])/);
  if (symbolMatch) {
    return currencyBySymbol[symbolMatch[1]];
  }
  return undefined;
}

/**
 * Clamp a numeric value to the [0, 1] probability range.
 */
export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Deduplicate and trim an array of issue/signal strings.
 */
export function uniqueIssues(issues: string[]): string[] {
  return [...new Set(issues.map((issue) => issue.trim()).filter((issue) => issue.length > 0))];
}

/**
 * Format a confidence value as a 4-decimal string after clamping to [0, 1].
 */
export function formatConfidence(value: number): string {
  return clampProbability(value).toFixed(4);
}

export function buildDateTerms(value: string): string[] {
  const [year, month, day] = value.split("-");
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11 || !Number.isInteger(dayNumber)) {
    return [value];
  }

  const monthNames = [
    ["jan", "january"],
    ["feb", "february"],
    ["mar", "march"],
    ["apr", "april"],
    ["may", "may"],
    ["jun", "june"],
    ["jul", "july"],
    ["aug", "august"],
    ["sep", "september"],
    ["oct", "october"],
    ["nov", "november"],
    ["dec", "december"]
  ];
  const [shortMonth, longMonth] = monthNames[monthIndex] ?? [];
  const normalizedDay = String(dayNumber);
  return [value, `${longMonth} ${normalizedDay}, ${year}`, `${shortMonth} ${normalizedDay}, ${year}`].filter(Boolean);
}

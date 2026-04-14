import type { OcrBlock } from "@/core/interfaces/OcrProvider.js";
import { parseAmountToken } from "@/ai/parsers/invoiceParser.js";
import { extractColumnNumeric } from "./fieldParsingUtils.js";

export function findBlockByAmountValue(
  amountMinor: number,
  blocks: OcrBlock[],
  labelPattern?: RegExp
): { block: OcrBlock; index: number } | undefined {
  const majorStr = (amountMinor / 100).toFixed(2);
  const majorNoDecimal = Math.floor(amountMinor / 100).toString();
  const indianFormatted = formatIndianNumber(amountMinor / 100);

  const valueMatches: Array<{ block: OcrBlock; index: number }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const text = blocks[i].text.replace(/\s/g, "");
    if (text.includes(majorStr) || text.includes(majorNoDecimal) || text.includes(indianFormatted)) {
      valueMatches.push({ block: blocks[i], index: i });
    }
  }

  if (valueMatches.length === 0) return undefined;
  if (valueMatches.length === 1 || !labelPattern) return valueMatches[0];

  const labelBlocks: Array<{ index: number; yMid: number }> = [];
  for (let i = 0; i < blocks.length; i++) {
    if (labelPattern.test(blocks[i].text.trim())) {
      const bbox = blocks[i].bboxNormalized ?? blocks[i].bbox;
      if (bbox && bbox.length >= 4) {
        labelBlocks.push({ index: i, yMid: (bbox[1] + bbox[3]) / 2 });
      }
    }
  }

  if (labelBlocks.length === 0) return valueMatches[0];

  let best = valueMatches[0];
  let bestDist = Infinity;

  for (const label of labelBlocks) {
    for (const match of valueMatches) {
      const matchBbox = match.block.bboxNormalized ?? match.block.bbox;
      if (matchBbox && matchBbox.length >= 4) {
        const matchYMid = (matchBbox[1] + matchBbox[3]) / 2;
        const dy = Math.abs(matchYMid - label.yMid);
        if (dy < bestDist) {
          bestDist = dy;
          best = match;
        }
      }
    }
  }

  return best;
}

export function extractNumericValueNearColumn(
  blocks: OcrBlock[],
  headerIndex: number,
  topBoundary: number,
  bottomBoundary: number
): number | undefined {
  return extractColumnNumeric(blocks, headerIndex, topBoundary, bottomBoundary, (text) => {
    const trimmed = text.trim();
    if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  });
}

export function extractAmountValueNearColumn(
  blocks: OcrBlock[],
  headerIndex: number,
  topBoundary: number,
  bottomBoundary: number
): number | undefined {
  return extractColumnNumeric(blocks, headerIndex, topBoundary, bottomBoundary, (text) =>
    parseAmountToken(text)
  );
}

function formatIndianNumber(value: number): string {
  const parts = value.toFixed(2).split(".");
  const intPart = parts[0];
  if (intPart.length <= 3) return parts.join(".");
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${grouped},${last3}.${parts[1]}`;
}

export type Box4 = [number, number, number, number];

function validateBox(value: Box4 | undefined): Box4 | undefined {
  if (!value) {
    return undefined;
  }
  const [x1, y1, x2, y2] = value;
  if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) {
    return undefined;
  }
  return value;
}

export function normalizeUnitBox(value: Box4 | undefined): Box4 | undefined {
  const v = validateBox(value);
  if (!v) {
    return undefined;
  }
  const [x1, y1, x2, y2] = v;
  return x1 < 0 || y1 < 0 || x2 > 1 || y2 > 1 ? undefined : v;
}

export function normalizeModelBox(value: Box4 | undefined): Box4 | undefined {
  const v = validateBox(value);
  if (!v) {
    return undefined;
  }
  const scale = 999;
  return v.map((n) => Math.max(0, Math.min(1, n / scale))) as Box4;
}

export function normalizeAbsoluteBox(value: Box4, pageWidth: number, pageHeight: number): Box4 | undefined {
  if (!validateBox(value)) {
    return undefined;
  }
  const [x1, y1, x2, y2] = value;
  return [
    Math.max(0, Math.min(1, x1 / pageWidth)),
    Math.max(0, Math.min(1, y1 / pageHeight)),
    Math.max(0, Math.min(1, x2 / pageWidth)),
    Math.max(0, Math.min(1, y2 / pageHeight))
  ];
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Convert a normalized [x1, y1, x2, y2] box (each in [0, 1]) to a pixel rectangle
 * as floats. Clamps coordinates into the page and enforces a minimum width/height of 1
 * pixel (as a float) so that degenerate zero-area inputs still render something visible.
 *
 * Used by the SVG overlay path — librsvg antialiases fractional rect coords, so we
 * preserve subpixel precision end-to-end rather than snapping each edge independently.
 */
export function toPixelRectFloat(normalized: Box4, pageWidth: number, pageHeight: number): PixelRect {
  const x1 = Math.max(0, Math.min(1, normalized[0]));
  const y1 = Math.max(0, Math.min(1, normalized[1]));
  const x2 = Math.max(0, Math.min(1, normalized[2]));
  const y2 = Math.max(0, Math.min(1, normalized[3]));

  const leftF = Math.max(0, Math.min(pageWidth, x1 * pageWidth));
  const topF = Math.max(0, Math.min(pageHeight, y1 * pageHeight));
  const rightF = Math.max(0, Math.min(pageWidth, x2 * pageWidth));
  const bottomF = Math.max(0, Math.min(pageHeight, y2 * pageHeight));

  const widthF = Math.max(1, rightF - leftF);
  const heightF = Math.max(1, bottomF - topF);

  // Keep the rectangle inside the page after the min-size floor above.
  const width = Math.min(widthF, pageWidth - leftF);
  const height = Math.min(heightF, pageHeight - topF);

  return {
    left: leftF,
    top: topF,
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

export function normalizeBoxTuple(value: unknown): Box4 | undefined {
  if (!Array.isArray(value) || value.length !== 4) {
    return undefined;
  }

  const numbers = value.map((entry) => Number(entry));
  if (!numbers.every((entry) => Number.isFinite(entry))) {
    return undefined;
  }

  const [x1, y1, x2, y2] = numbers;
  if (x2 <= x1 || y2 <= y1) {
    return undefined;
  }

  return [x1, y1, x2, y2];
}

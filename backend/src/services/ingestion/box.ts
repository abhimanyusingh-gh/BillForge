export type Box4 = [number, number, number, number];

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

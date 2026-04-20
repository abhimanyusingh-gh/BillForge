import { clampProbability, clamp, normalizeConfidence } from "@/utils/math.js";

describe("clampProbability", () => {
  it.each([
    ["NaN", NaN, 0],
    ["Infinity", Infinity, 0],
    ["-Infinity", -Infinity, 0],
    ["negative value", -0.5, 0],
    ["value above 1", 1.5, 1],
    ["value within [0,1]", 0.5, 0.5],
    ["exactly 0", 0, 0],
    ["exactly 1", 1, 1],
  ])("returns %s -> clamped probability", (_label, input, expected) => {
    expect(clampProbability(input)).toBe(expected);
  });
});

describe("clamp", () => {
  it.each([
    ["within range", 5, 0, 10, 5],
    ["below min", -5, 0, 10, 0],
    ["above max", 15, 0, 10, 10],
    ["equals min", 0, 0, 10, 0],
    ["equals max", 10, 0, 10, 10],
    ["negative range below", -15, -10, -5, -10],
    ["negative range above", -3, -10, -5, -5],
    ["negative range inside", -7, -10, -5, -7],
    ["NaN returns min", NaN, 0, 100, 0],
    ["Infinity returns min", Infinity, 0, 100, 0],
    ["-Infinity returns min", -Infinity, 0, 100, 0],
  ])("%s", (_label, value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
});

describe("normalizeConfidence", () => {
  it("treats values > 1 and <= 100 as percentages", () => {
    expect(normalizeConfidence(85)).toBe(0.85);
    expect(normalizeConfidence(100)).toBe(1);
    expect(normalizeConfidence(42.5)).toBe(0.425);
    expect(normalizeConfidence(1.5)).toBe(0.015);
    expect(normalizeConfidence(50)).toBe(0.5);
  });

  it.each([
    ["value in [0,1] as-is with 4-decimal precision (0.85)", 0.85, 0.85],
    ["value in [0,1] as-is with 4-decimal precision (0.12345)", 0.12345, 0.1235],
    ["value in [0,1] as-is (1)", 1, 1],
    ["clamps > 100 (150)", 150, 1],
    ["clamps > 100 (200)", 200, 1],
    ["clamps > 100 (100.01)", 100.01, 1],
    ["zero", 0, 0],
    ["NaN", NaN, 0],
    ["Infinity", Infinity, 0],
    ["-Infinity", -Infinity, 0],
    ["negative", -0.5, 0],
  ])("%s", (_label, input, expected) => {
    expect(normalizeConfidence(input)).toBe(expected);
  });
});

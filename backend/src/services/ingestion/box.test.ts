import { toPixelRectFloat, type Box4 } from "@/services/ingestion/box";

const VENDOR_NAME_BBOX: Box4 = [0.2944980, 0.0717247, 0.6212589, 0.1002388];
const PAGE_WIDTH = 1700;
const PAGE_HEIGHT = 2200;

describe("toPixelRectFloat", () => {
  it("returns sub-pixel-precise rect for the vendorName bbox at 1700x2200", () => {
    const rect = toPixelRectFloat(VENDOR_NAME_BBOX, PAGE_WIDTH, PAGE_HEIGHT);

    expect(rect.left).toBeCloseTo(500.6466, 3);
    expect(rect.top).toBeCloseTo(157.7943, 3);
    expect(rect.width).toBeCloseTo(555.4936, 3);
    expect(rect.height).toBeCloseTo(62.7310, 3);
  });

  it("returns the full page for a unit bbox [0, 0, 1, 1]", () => {
    const rect = toPixelRectFloat([0, 0, 1, 1], PAGE_WIDTH, PAGE_HEIGHT);
    expect(rect).toEqual({ left: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
  });

  it("floors the minimum width/height at 1 for zero-area input", () => {
    const rect = toPixelRectFloat([0.5, 0.5, 0.5, 0.5], PAGE_WIDTH, PAGE_HEIGHT);
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
  });

  it("clamps out-of-range normalized input into the page", () => {
    const rect = toPixelRectFloat([-0.1, -0.1, 1.2, 1.2], PAGE_WIDTH, PAGE_HEIGHT);
    expect(rect).toEqual({ left: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
  });
});

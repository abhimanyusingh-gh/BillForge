import { renderToStaticMarkup } from "react-dom/server";
import { BboxCrop } from "@/components/invoice/ExtractedFieldsTable";

describe("BboxCrop", () => {
  it("renders float-percent CSS for INV-FY2526-939 vendorGstin bbox without rounding", () => {
    // Ground-truth for INV-FY2526-939 vendorGstin at 1700x2200 preview image:
    //   absolute rect: left=500.65 top=328.74 width=268.24 height=20.91
    //   x1 = 500.65 / 1700 = 0.29450
    //   y1 = 328.74 / 2200 = 0.14943
    //   x2 = (500.65 + 268.24) / 1700 = 0.45229
    //   y2 = (328.74 + 20.91) / 2200 = 0.15893
    const x1 = 500.65 / 1700;
    const y1 = 328.74 / 2200;
    const x2 = (500.65 + 268.24) / 1700;
    const y2 = (328.74 + 20.91) / 2200;

    const html = renderToStaticMarkup(
      <BboxCrop
        pageImageUrl="/preview/1.png"
        bboxNormalized={[x1, y1, x2, y2]}
        alt="Vendor GSTIN"
        onError={() => {}}
      />
    );

    // Compute the expected CSS values using the same lossless arithmetic the
    // component performs (floats all the way through — browser clips via overflow:hidden).
    const bboxW = x2 - x1;
    const bboxH = y2 - y1;
    const expectedImgWidthPct = 100 / bboxW;
    const expectedImgHeightPct = 100 / bboxH;
    const expectedImgLeftPct = -(x1 / bboxW) * 100;
    const expectedImgTopPct = -(y1 / bboxH) * 100;

    // Sanity: none of these percentages should be rounded to integers.
    // (If any integer-rounding creeps in, these will fail with telltale near-integer deltas.)
    expect(Math.abs(expectedImgWidthPct - Math.round(expectedImgWidthPct))).toBeGreaterThan(0.01);
    expect(Math.abs(expectedImgLeftPct - Math.round(expectedImgLeftPct))).toBeGreaterThan(0.01);

    // The rendered markup must contain the exact float percentages we computed.
    expect(html).toContain(`width:${expectedImgWidthPct}%`);
    expect(html).toContain(`height:${expectedImgHeightPct}%`);
    expect(html).toContain(`left:${expectedImgLeftPct}%`);
    expect(html).toContain(`top:${expectedImgTopPct}%`);
    expect(html).toContain('src="/preview/1.png"');
    expect(html).toContain('alt="Vendor GSTIN"');
  });

  it("returns null for a zero-size bbox", () => {
    const html = renderToStaticMarkup(
      <BboxCrop
        pageImageUrl="/preview/1.png"
        bboxNormalized={[0.5, 0.5, 0.5, 0.5]}
        alt="invalid"
        onError={() => {}}
      />
    );
    expect(html).toBe("");
  });
});

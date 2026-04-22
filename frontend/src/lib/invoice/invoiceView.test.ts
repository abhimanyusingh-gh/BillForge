import { buildFieldCropSourceMap } from "@/lib/invoice/invoiceView";
import type { SourceHighlight } from "@/lib/invoice/sourceHighlights";

describe("buildFieldCropSourceMap", () => {
  it("emits a bbox crop source for every highlight with a bboxNormalized", () => {
    const highlights = [
      {
        fieldKey: "invoiceNumber",
        label: "Invoice Number",
        value: "INV-1",
        source: "ocr",
        page: 1,
        bbox: [10, 10, 30, 30],
        bboxNormalized: [0.1, 0.1, 0.3, 0.3] as [number, number, number, number],
        blockIndex: 2
      },
      {
        fieldKey: "vendorName",
        label: "Vendor",
        value: "Acme",
        source: "ocr",
        page: 2,
        bbox: [10, 10, 30, 30],
        bboxNormalized: [0.2, 0.3, 0.5, 0.4] as [number, number, number, number]
      }
    ] as SourceHighlight[];

    const map = buildFieldCropSourceMap(
      "invoice-1",
      highlights,
      (invoiceId, page) => `${invoiceId}/preview/${page}`
    );
    expect(map.invoiceNumber).toEqual({
      type: "bbox",
      pageImageUrl: "invoice-1/preview/1",
      bboxNormalized: [0.1, 0.1, 0.3, 0.3]
    });
    expect(map.vendorName).toEqual({
      type: "bbox",
      pageImageUrl: "invoice-1/preview/2",
      bboxNormalized: [0.2, 0.3, 0.5, 0.4]
    });
  });

  it("skips highlights without a bboxNormalized", () => {
    const highlights = [
      {
        fieldKey: "invoiceNumber",
        label: "Invoice Number",
        value: "INV-1",
        source: "ocr",
        page: 1,
        bbox: [10, 10, 30, 30]
      } as unknown as SourceHighlight
    ];

    const map = buildFieldCropSourceMap(
      "invoice-1",
      highlights,
      (invoiceId, page) => `${invoiceId}/preview/${page}`
    );
    expect(map.invoiceNumber).toBeUndefined();
  });

  it("skips highlights when the resolver returns an empty page image URL", () => {
    const highlights = [
      {
        fieldKey: "invoiceNumber",
        label: "Invoice Number",
        value: "INV-1",
        source: "ocr",
        page: 1,
        bbox: [10, 10, 30, 30],
        bboxNormalized: [0.1, 0.1, 0.3, 0.3] as [number, number, number, number]
      }
    ] as SourceHighlight[];

    const map = buildFieldCropSourceMap("invoice-1", highlights, () => "");
    expect(map.invoiceNumber).toBeUndefined();
  });
});

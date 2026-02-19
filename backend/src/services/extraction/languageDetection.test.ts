import { detectInvoiceLanguage, detectInvoiceLanguageBeforeOcr } from "./languageDetection.ts";

describe("detectInvoiceLanguage", () => {
  it("detects french invoices from lexical cues", () => {
    const detected = detectInvoiceLanguage([
      [
        "Numéro de facture: FAC-2026-10",
        "Date de facture: 12/02/2026",
        "Date d'échéance: 22/02/2026",
        "Montant total: 1 250,50 EUR"
      ].join("\n")
    ]);

    expect(detected.code).toBe("fr");
    expect(detected.confidence).toBeGreaterThan(0.5);
  });

  it("detects german invoices from lexical cues", () => {
    const detected = detectInvoiceLanguage([
      [
        "Rechnungsnummer: DE-443-20",
        "Rechnungsdatum: 12.02.2026",
        "Fälligkeitsdatum: 20.02.2026",
        "Gesamtbetrag: EUR 1250,50"
      ].join("\n")
    ]);

    expect(detected.code).toBe("de");
    expect(detected.confidence).toBeGreaterThan(0.5);
  });

  it("detects devanagari script as hindi", () => {
    const detected = detectInvoiceLanguage([
      "इनवॉइस नंबर: INV-001\nकुल राशि: ₹1500.00\nदिनांक: 12/02/2026"
    ]);

    expect(detected.code).toBe("hi");
    expect(detected.signals).toContain("script:hi");
  });

  it("falls back to english for latin text without strong language signals", () => {
    const detected = detectInvoiceLanguage(["INVOICE REF A-100\nTOTAL 100.00"]);

    expect(detected.code).toBe("en");
    expect(detected.confidence).toBeGreaterThan(0);
  });

  it("returns und for empty payload", () => {
    const detected = detectInvoiceLanguage(["", "   "]);

    expect(detected.code).toBe("und");
    expect(detected.confidence).toBe(0);
  });
});

describe("detectInvoiceLanguageBeforeOcr", () => {
  it("uses file naming hints for pre-OCR language detection", () => {
    const detected = detectInvoiceLanguageBeforeOcr({
      attachmentName: "Facture_2026-10_fr.pdf",
      sourceKey: "mailbox/france",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.7\n")
    });

    expect(detected.code).toBe("fr");
    expect(detected.confidence).toBeGreaterThanOrEqual(0.4);
    expect(detected.signals).toContain("pre-ocr");
  });

  it("uses utf8 text probe for text-based documents before OCR", () => {
    const detected = detectInvoiceLanguageBeforeOcr({
      attachmentName: "invoice.txt",
      sourceKey: "uploads",
      mimeType: "text/plain",
      fileBuffer: Buffer.from("Rechnungsnummer: DE-100\nGesamtbetrag: EUR 200.00", "utf8")
    });

    expect(detected.code).toBe("de");
    expect(detected.confidence).toBeGreaterThan(0.4);
  });

  it("returns und for image payloads without hints", () => {
    const detected = detectInvoiceLanguageBeforeOcr({
      attachmentName: "scan-001.png",
      sourceKey: "folder-a",
      mimeType: "image/png",
      fileBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])
    });

    expect(detected.code).toBe("und");
    expect(detected.confidence).toBe(0);
  });
});

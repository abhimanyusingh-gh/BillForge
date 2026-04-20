import {
  PAN_FORMAT,
  GSTIN_FORMAT,
  UDYAM_FORMAT,
  IRN_FORMAT,
  ADDRESS_SIGNAL_PATTERN,
  extractPanFromGstin,
  derivePanCategory
} from "@/constants/indianCompliance";

describe("indian compliance regexes", () => {
  it.each([
    ["PAN valid ABCPK1234F", PAN_FORMAT, "ABCPK1234F", true],
    ["PAN valid AABCC1234F", PAN_FORMAT, "AABCC1234F", true],
    ["PAN valid ZZZZZ9999Z", PAN_FORMAT, "ZZZZZ9999Z", true],
    ["PAN invalid lowercase", PAN_FORMAT, "abcpk1234f", false],
    ["PAN invalid digits only", PAN_FORMAT, "1234567890", false],
    ["PAN invalid short", PAN_FORMAT, "ABCPK1234", false],
    ["PAN invalid long", PAN_FORMAT, "ABCPK1234FG", false],
    ["PAN invalid empty", PAN_FORMAT, "", false],
  ])("%s", (_label, re, input, expected) => {
    expect(re.test(input)).toBe(expected);
  });

  it.each([
    ["GSTIN valid 29ABCPK1234F1Z5", GSTIN_FORMAT, "29ABCPK1234F1Z5", true],
    ["GSTIN valid 07AABCC1234D1ZA", GSTIN_FORMAT, "07AABCC1234D1ZA", true],
    ["GSTIN invalid 'INVALID'", GSTIN_FORMAT, "INVALID", false],
    ["GSTIN invalid wrong check", GSTIN_FORMAT, "29ABCPK1234F1X5", false],
    ["GSTIN invalid empty", GSTIN_FORMAT, "", false],
  ])("%s", (_label, re, input, expected) => {
    expect(re.test(input)).toBe(expected);
  });

  it.each([
    ["UDYAM valid KA-01", UDYAM_FORMAT, "UDYAM-KA-01-1234567", true],
    ["UDYAM valid MH-99", UDYAM_FORMAT, "UDYAM-MH-99-0000001", true],
    ["UDYAM invalid single-digit block", UDYAM_FORMAT, "UDYAM-KA-1-1234567", false],
    ["UDYAM invalid prefix", UDYAM_FORMAT, "NOTUDYAM-KA-01-1234567", false],
    ["UDYAM invalid empty", UDYAM_FORMAT, "", false],
  ])("%s", (_label, re, input, expected) => {
    expect(re.test(input)).toBe(expected);
  });

  it.each([
    ["IRN valid 64 hex lowercase", IRN_FORMAT, "a".repeat(64), true],
    ["IRN valid 64 hex mixed", IRN_FORMAT, "A1b2C3d4".repeat(8), true],
    ["IRN invalid 63 chars", IRN_FORMAT, "a".repeat(63), false],
    ["IRN invalid 65 chars", IRN_FORMAT, "a".repeat(65), false],
    ["IRN invalid non-hex", IRN_FORMAT, "g".repeat(64), false],
    ["IRN invalid empty", IRN_FORMAT, "", false],
  ])("%s", (_label, re, input, expected) => {
    expect(re.test(input)).toBe(expected);
  });

  it.each([
    ["street", ADDRESS_SIGNAL_PATTERN, "123 Main Street", true],
    ["warehouse", ADDRESS_SIGNAL_PATTERN, "Warehouse No. 5", true],
    ["hobli", ADDRESS_SIGNAL_PATTERN, "Village Hobli", true],
    ["taluk", ADDRESS_SIGNAL_PATTERN, "Taluk Center", true],
    ["district", ADDRESS_SIGNAL_PATTERN, "District Office", true],
    ["postal code", ADDRESS_SIGNAL_PATTERN, "Postal Code 560001", true],
    ["pin", ADDRESS_SIGNAL_PATTERN, "Pin 560001", true],
    ["zip", ADDRESS_SIGNAL_PATTERN, "ZIP 12345", true],
    ["near", ADDRESS_SIGNAL_PATTERN, "Near Railway Station", true],
    ["state highway", ADDRESS_SIGNAL_PATTERN, "State Highway", true],
    ["country road", ADDRESS_SIGNAL_PATTERN, "Country Road", true],
    ["karnataka", ADDRESS_SIGNAL_PATTERN, "Karnataka Region", true],
    ["india", ADDRESS_SIGNAL_PATTERN, "India Gate", true],
    ["non-address corp", ADDRESS_SIGNAL_PATTERN, "ACME Corporation", false],
    ["non-address invoice", ADDRESS_SIGNAL_PATTERN, "Invoice #12345", false],
  ])("ADDRESS_SIGNAL_PATTERN: %s", (_label, re, input, expected) => {
    expect(re.test(input)).toBe(expected);
  });
});

describe("extractPanFromGstin", () => {
  it("extracts PAN (chars 3-12) from a GSTIN", () => {
    expect(extractPanFromGstin("29ABCPK1234F1Z5")).toBe("ABCPK1234F");
    expect(extractPanFromGstin("07AABCC1234D1ZA")).toBe("AABCC1234D");
  });
});

describe("derivePanCategory", () => {
  it("returns category code from fourth character", () => {
    expect(derivePanCategory("AABCC1234F")).toBe("C");
    expect(derivePanCategory("ABCPK1234F")).toBe("P");
    expect(derivePanCategory("ABCHK1234F")).toBe("H");
    expect(derivePanCategory("ABCFK1234F")).toBe("F");
    expect(derivePanCategory("ABCTK1234F")).toBe("T");
  });

  it("handles lowercase input", () => {
    expect(derivePanCategory("abcpk1234f")).toBe("P");
  });

  it("returns null for short strings", () => {
    expect(derivePanCategory("ABC")).toBeNull();
    expect(derivePanCategory("")).toBeNull();
  });

  it("returns null for invalid category character", () => {
    expect(derivePanCategory("ABCXK1234F")).toBeNull();
    expect(derivePanCategory("ABCZK1234F")).toBeNull();
  });
});

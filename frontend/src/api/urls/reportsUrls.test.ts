import { REPORTS_URL_PATHS, reportsUrls } from "@/api/urls/reportsUrls";

describe("api/urls/reportsUrls", () => {
  it("exposes the BE TDS liability path constant", () => {
    expect(REPORTS_URL_PATHS.tdsLiability).toBe("/reports/tds-liability");
  });

  it("tdsLiability() returns the bare path (auth-derived tenant scope)", () => {
    expect(reportsUrls.tdsLiability()).toBe("/reports/tds-liability");
  });
});

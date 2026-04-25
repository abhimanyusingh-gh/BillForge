import { Types } from "mongoose";
import { ClientExportConfigModel } from "@/models/integration/ClientExportConfig.ts";
import { buildTallyExportConfig, buildCsvExportConfig } from "@/services/export/tenantExportConfigResolver.ts";

jest.mock("@/config/env.js", () => ({
  env: {
    TALLY_COMPANY: "EnvCompany",
    TALLY_PURCHASE_LEDGER: "EnvPurchase",
    TALLY_CGST_LEDGER: "Env CGST",
    TALLY_SGST_LEDGER: "Env SGST",
    TALLY_IGST_LEDGER: "Env IGST",
    TALLY_CESS_LEDGER: "Env Cess",
    TALLY_TDS_LEDGER: "Env TDS",
    TALLY_TCS_LEDGER: "Env TCS"
  }
}));

const CLIENT_ORG_ID = new Types.ObjectId();

describe("buildTallyExportConfig", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const systemDefaults = {
    companyName: "SystemCompany",
    purchaseLedgerName: "SystemPurchase",
    gstLedgers: {
      cgstLedger: "System CGST",
      sgstLedger: "System SGST",
      igstLedger: "System IGST",
      cessLedger: "System Cess"
    },
    tdsLedgerPrefix: "System TDS",
    tcsLedgerName: "System TCS"
  };

  it("returns tenant config when tenant has overrides", async () => {
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        tenantId: "tenant-a",
        clientOrgId: CLIENT_ORG_ID,
        tallyCompanyName: "TenantCompany",
        tallyPurchaseLedger: "TenantPurchase",
        tallyCgstLedger: "Tenant CGST",
        tallySgstLedger: null,
        tallyIgstLedger: undefined
      })
    } as never);

    const result = await buildTallyExportConfig("tenant-a", CLIENT_ORG_ID, systemDefaults);

    expect(result.companyName).toBe("TenantCompany");
    expect(result.purchaseLedgerName).toBe("TenantPurchase");
    expect(result.gstLedgers.cgstLedger).toBe("Tenant CGST");
    expect(result.gstLedgers.sgstLedger).toBe("System SGST");
    expect(result.gstLedgers.igstLedger).toBe("System IGST");
  });

  it("falls back to system defaults when no tenant config exists", async () => {
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    } as never);

    const result = await buildTallyExportConfig("tenant-b", CLIENT_ORG_ID, systemDefaults);

    expect(result.companyName).toBe("SystemCompany");
    expect(result.purchaseLedgerName).toBe("SystemPurchase");
    expect(result.gstLedgers.cgstLedger).toBe("System CGST");
    expect(result.tdsLedgerPrefix).toBe("System TDS");
    expect(result.tcsLedgerName).toBe("System TCS");
  });

  it("falls back to env vars when system defaults are missing", async () => {
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    } as never);

    const result = await buildTallyExportConfig("tenant-c", CLIENT_ORG_ID, {
      companyName: "",
      purchaseLedgerName: "",
      gstLedgers: undefined as never,
      tdsLedgerPrefix: undefined as never,
      tcsLedgerName: undefined as never
    });

    expect(result.companyName).toBe("EnvCompany");
    expect(result.purchaseLedgerName).toBe("EnvPurchase");
    expect(result.gstLedgers.cgstLedger).toBe("Env CGST");
    expect(result.tdsLedgerPrefix).toBe("Env TDS");
    expect(result.tcsLedgerName).toBe("Env TCS");
  });

  it("tenant tds/tcs ledger overrides system defaults", async () => {
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        tenantId: "tenant-d",
        clientOrgId: CLIENT_ORG_ID,
        tallyTdsLedger: "Custom TDS",
        tallyTcsLedger: "Custom TCS"
      })
    } as never);

    const result = await buildTallyExportConfig("tenant-d", CLIENT_ORG_ID, systemDefaults);

    expect(result.tdsLedgerPrefix).toBe("Custom TDS");
    expect(result.tcsLedgerName).toBe("Custom TCS");
  });

  it("skips per-tenant lookup when clientOrgId is undefined", async () => {
    const spy = jest.spyOn(ClientExportConfigModel, "findOne");
    const result = await buildTallyExportConfig("tenant-e", undefined, systemDefaults);
    expect(spy).not.toHaveBeenCalled();
    expect(result.companyName).toBe("SystemCompany");
  });
});

describe("buildCsvExportConfig", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["no tenant config exists", null],
    ["tenant config has empty csvColumns", { tenantId: "tenant-a", csvColumns: [] }],
  ])("returns undefined columns when %s", async (_label, docValue) => {
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(docValue)
    } as never);

    const result = await buildCsvExportConfig("tenant-a", CLIENT_ORG_ID);
    expect(result.columns).toBeUndefined();
  });

  it("returns tenant columns when configured", async () => {
    const tenantCols = [
      { key: "invoiceNumber", label: "Inv #" },
      { key: "vendorName", label: "Vendor" },
      { key: "total", label: "Amount" }
    ];
    jest.spyOn(ClientExportConfigModel, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue({ tenantId: "tenant-b", clientOrgId: CLIENT_ORG_ID, csvColumns: tenantCols })
    } as never);

    const result = await buildCsvExportConfig("tenant-b", CLIENT_ORG_ID);
    expect(result.columns).toEqual(tenantCols);
  });

  it("returns undefined when clientOrgId is missing", async () => {
    const spy = jest.spyOn(ClientExportConfigModel, "findOne");
    const result = await buildCsvExportConfig("tenant-x", undefined);
    expect(result.columns).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});

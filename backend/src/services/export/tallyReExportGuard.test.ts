import { describeHarness } from "@/test-utils";
import { InvoiceModel } from "@/models/invoice/Invoice.js";
import { TenantTallyCompanyModel } from "@/models/integration/TenantTallyCompany.js";
import {
  commitExportVersionBump,
  computeVoucherGuid,
  F12OverwriteNotVerifiedError,
  resolveReExportDecision
} from "@/services/export/tallyReExportGuard.ts";
import { TALLY_ACTION } from "@/services/export/tallyExporter/xml.ts";

describe("computeVoucherGuid", () => {
  it("is deterministic for the same (tenantId, invoiceId, exportVersion)", () => {
    const a = computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 1 });
    const b = computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("produces a different GUID when exportVersion changes", () => {
    const v1 = computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 1 });
    const v2 = computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 2 });
    expect(v1).not.toBe(v2);
  });

  it("produces a different GUID when tenantId or invoiceId changes", () => {
    const base = computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 1 });
    expect(computeVoucherGuid({ tenantId: "tenant-2", invoiceId: "inv-1", exportVersion: 1 })).not.toBe(base);
    expect(computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-2", exportVersion: 1 })).not.toBe(base);
  });
});

describeHarness("resolveReExportDecision + commitExportVersionBump (BE-2)", ({ getHarness }) => {
  afterEach(async () => {
    await getHarness().reset();
  });

  it("first export issues ACTION=Create without requiring F12 verification", async () => {
    const decision = await resolveReExportDecision({
      tenantId: "tenant-1",
      invoiceId: "inv-1",
      currentExportVersion: 0
    });
    expect(decision.action).toBe(TALLY_ACTION.CREATE);
    expect(decision.nextExportVersion).toBe(1);
    expect(decision.guid).toBe(computeVoucherGuid({ tenantId: "tenant-1", invoiceId: "inv-1", exportVersion: 1 }));
  });

  it("re-export throws F12OverwriteNotVerifiedError when toggle not verified", async () => {
    await TenantTallyCompanyModel.create({
      tenantId: "tenant-1",
      companyName: "ACME",
      f12OverwriteByGuidVerified: false
    });

    await expect(
      resolveReExportDecision({ tenantId: "tenant-1", invoiceId: "inv-1", currentExportVersion: 1 })
    ).rejects.toBeInstanceOf(F12OverwriteNotVerifiedError);
  });

  it("re-export also throws when no TenantTallyCompany row exists", async () => {
    await expect(
      resolveReExportDecision({ tenantId: "tenant-missing", invoiceId: "inv-1", currentExportVersion: 1 })
    ).rejects.toBeInstanceOf(F12OverwriteNotVerifiedError);
  });

  it("re-export issues ACTION=Alter with same-invoice GUID bumped to next version when F12 verified", async () => {
    await TenantTallyCompanyModel.create({
      tenantId: "tenant-1",
      companyName: "ACME",
      stateName: "Karnataka",
      f12OverwriteByGuidVerified: true
    });

    const decision = await resolveReExportDecision({
      tenantId: "tenant-1",
      invoiceId: "inv-1",
      currentExportVersion: 1
    });
    expect(decision.action).toBe(TALLY_ACTION.ALTER);
    expect(decision.nextExportVersion).toBe(2);
    expect(decision.buyerStateName).toBe("Karnataka");
  });

  it("commitExportVersionBump persists the bumped exportVersion on the invoice", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k",
      sourceDocumentId: "d",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED"
    });

    await commitExportVersionBump({ invoiceId: String(invoice._id), nextExportVersion: 3 });
    const reloaded = await InvoiceModel.findById(invoice._id).lean();
    expect(reloaded?.exportVersion).toBe(3);
  });

  it("new invoice defaults exportVersion to 0 (additive, backward-compatible)", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k2",
      sourceDocumentId: "d2",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED"
    });
    expect(invoice.exportVersion).toBe(0);
  });
});

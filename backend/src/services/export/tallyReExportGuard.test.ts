import { describeHarness } from "@/test-utils";
import { InvoiceModel } from "@/models/invoice/Invoice.js";
import { TenantTallyCompanyModel } from "@/models/integration/TenantTallyCompany.js";
import {
  commitExportVersionBump,
  computeVoucherGuid,
  ExportVersionConflictError,
  F12OverwriteNotVerifiedError,
  resolveReExportDecision,
  rollbackExportVersionBump
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

  it("length-prefixing prevents separator collisions across differing tuples", () => {
    const a = computeVoucherGuid({ tenantId: "abc", invoiceId: "def", exportVersion: 1 });
    const b = computeVoucherGuid({ tenantId: "abc:def", invoiceId: "", exportVersion: 1 });
    expect(a).not.toBe(b);

    const c = computeVoucherGuid({ tenantId: "a", invoiceId: "b:c", exportVersion: 1 });
    const d = computeVoucherGuid({ tenantId: "a:b", invoiceId: "c", exportVersion: 1 });
    expect(c).not.toBe(d);
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

  it("commitExportVersionBump CAS-increments exportVersion when expectedPriorVersion matches", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k",
      sourceDocumentId: "d",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED",
      exportVersion: 2
    });

    await commitExportVersionBump({ invoiceId: String(invoice._id), expectedPriorVersion: 2 });
    const reloaded = await InvoiceModel.findById(invoice._id).lean();
    expect(reloaded?.exportVersion).toBe(3);
  });

  it("commitExportVersionBump throws ExportVersionConflictError when expectedPriorVersion does not match", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k-conflict",
      sourceDocumentId: "d-conflict",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED",
      exportVersion: 5
    });

    await expect(
      commitExportVersionBump({ invoiceId: String(invoice._id), expectedPriorVersion: 3 })
    ).rejects.toBeInstanceOf(ExportVersionConflictError);
    const reloaded = await InvoiceModel.findById(invoice._id).lean();
    expect(reloaded?.exportVersion).toBe(5);
  });

  it("concurrent commitExportVersionBump on same expectedPriorVersion: exactly one succeeds", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k-race",
      sourceDocumentId: "d-race",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED",
      exportVersion: 1
    });

    const outcomes = await Promise.allSettled([
      commitExportVersionBump({ invoiceId: String(invoice._id), expectedPriorVersion: 1 }),
      commitExportVersionBump({ invoiceId: String(invoice._id), expectedPriorVersion: 1 })
    ]);
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ExportVersionConflictError);

    const reloaded = await InvoiceModel.findById(invoice._id).lean();
    expect(reloaded?.exportVersion).toBe(2);
  });

  it("rollbackExportVersionBump decrements only when current version matches bumpedVersion", async () => {
    const invoice = await InvoiceModel.create({
      tenantId: "tenant-1",
      sourceType: "manual",
      sourceKey: "k-rollback",
      sourceDocumentId: "d-rollback",
      attachmentName: "a.pdf",
      mimeType: "application/pdf",
      receivedAt: new Date(),
      status: "PARSED",
      exportVersion: 4
    });

    await rollbackExportVersionBump({ invoiceId: String(invoice._id), bumpedVersion: 4 });
    const afterMatch = await InvoiceModel.findById(invoice._id).lean();
    expect(afterMatch?.exportVersion).toBe(3);

    await rollbackExportVersionBump({ invoiceId: String(invoice._id), bumpedVersion: 99 });
    const afterNoMatch = await InvoiceModel.findById(invoice._id).lean();
    expect(afterNoMatch?.exportVersion).toBe(3);
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

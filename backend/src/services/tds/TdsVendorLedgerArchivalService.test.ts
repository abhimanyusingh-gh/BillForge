import { describeHarness } from "@/test-utils";
import { TdsVendorLedgerModel } from "@/models/compliance/TdsVendorLedger.js";
import { TdsVendorLedgerArchiveModel } from "@/models/compliance/TdsVendorLedgerArchive.js";
import { TdsVendorLedgerEntryOverflowModel } from "@/models/compliance/TdsVendorLedgerEntryOverflow.js";
import { TdsVendorLedgerService } from "@/services/tds/TdsVendorLedgerService.js";
import {
  archiveFyForVendor,
  type LedgerKey
} from "@/services/tds/TdsVendorLedgerArchivalService.js";
import { env } from "@/config/env.js";
import type { UUID } from "@/types/uuid.js";
import type { TdsSection } from "@/types/tdsSection.js";

const TENANT = "tenant-tds-archival" as UUID;
const VENDOR = "vendor-fingerprint-archival";
const FY = "2026-27";
const SECTION = "194C" as TdsSection;
const APRIL_15_IST = new Date("2026-04-15T05:30:00+05:30");

const KEY: LedgerKey = {
  tenantId: TENANT,
  vendorFingerprint: VENDOR,
  financialYear: FY,
  section: SECTION
};

interface SeedEntry {
  invoiceId: string;
  taxableAmountMinor: number;
  tdsAmountMinor: number;
}

function buildEntry(seed: SeedEntry): Record<string, unknown> {
  return {
    invoiceId: seed.invoiceId,
    invoiceDate: APRIL_15_IST,
    taxableAmountMinor: seed.taxableAmountMinor,
    tdsAmountMinor: seed.tdsAmountMinor,
    rateSource: "rateTable",
    rateBps: 100,
    quarter: "Q1",
    recordedAt: APRIL_15_IST
  };
}

async function seedPrimary(
  count: number,
  baseAmount: number,
  tdsAmount: number,
  invoicePrefix: string
): Promise<void> {
  const entries = Array.from({ length: count }, (_, i) =>
    buildEntry({
      invoiceId: `${invoicePrefix}-${i}`,
      taxableAmountMinor: baseAmount,
      tdsAmountMinor: tdsAmount
    })
  );
  await TdsVendorLedgerModel.collection.insertOne({
    ...KEY,
    cumulativeBaseMinor: baseAmount * count,
    cumulativeTdsMinor: tdsAmount * count,
    invoiceCount: count,
    thresholdCrossedAt: null,
    lastUpdatedInvoiceId: `${invoicePrefix}-${count - 1}`,
    quarter: "Q1",
    entries,
    hasOverflow: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

describeHarness("TdsVendorLedgerArchivalService chaos", ({ getHarness }) => {
  let service: TdsVendorLedgerService;

  beforeAll(async () => {
    await TdsVendorLedgerModel.syncIndexes();
    await TdsVendorLedgerArchiveModel.syncIndexes();
    await TdsVendorLedgerEntryOverflowModel.syncIndexes();
    service = new TdsVendorLedgerService();
  });

  afterEach(async () => {
    await getHarness().reset();
  });

  it("chaos: concurrent writes during FY archival preserve cumulative", async () => {
    const N = 25;
    const baseAmount = 200_00;
    const tdsAmount = 2_00;
    await seedPrimary(N, baseAmount, tdsAmount, "seed");

    const concurrentWrites = 50;
    const writeAmount = 100_00;
    const writeTds = 1_00;

    const tasks: Array<Promise<unknown>> = [
      archiveFyForVendor(KEY),
      ...Array.from({ length: concurrentWrites }, (_, i) =>
        service.recordTdsToLedger({
          tenantId: TENANT,
          vendorFingerprint: VENDOR,
          financialYear: FY,
          section: SECTION,
          invoiceId: `chaos-arch-${i}`,
          invoiceDate: APRIL_15_IST,
          taxableAmountMinor: writeAmount,
          tdsAmountMinor: writeTds,
          rateSource: "rateTable",
          thresholdCrossed: false
        })
      )
    ];

    await Promise.all(tasks);

    const primary = await TdsVendorLedgerModel.findOne(KEY).lean();
    const archive = await TdsVendorLedgerArchiveModel.findOne(KEY).lean();

    const primaryBase = (primary?.cumulativeBaseMinor as number | undefined) ?? 0;
    const archiveBase = (archive?.cumulativeBaseMinor as number | undefined) ?? 0;
    const primaryTds = (primary?.cumulativeTdsMinor as number | undefined) ?? 0;
    const archiveTds = (archive?.cumulativeTdsMinor as number | undefined) ?? 0;

    const expectedBase = baseAmount * N + writeAmount * concurrentWrites;
    const expectedTds = tdsAmount * N + writeTds * concurrentWrites;

    expect(primaryBase + archiveBase).toBe(expectedBase);
    expect(primaryTds + archiveTds).toBe(expectedTds);

    const primaryEntries = ((primary?.entries as Array<{ invoiceId: string }> | undefined) ?? []);
    const archiveEntries = ((archive?.entries as Array<{ invoiceId: string }> | undefined) ?? []);

    const allIds = [...primaryEntries, ...archiveEntries].map((e) => e.invoiceId);
    expect(allIds).toHaveLength(N + concurrentWrites);
    expect(new Set(allIds).size).toBe(N + concurrentWrites);
  });

  it("chaos: concurrent writes during entries[] split preserve cumulative", async () => {
    const testCap = 20;
    const seedCount = testCap - 5;
    const baseAmount = 300_00;
    const tdsAmount = 3_00;

    const original = env.TDS_LEDGER_ENTRIES_CAP;
    Object.defineProperty(env, "TDS_LEDGER_ENTRIES_CAP", {
      value: testCap,
      configurable: true,
      writable: true
    });

    try {
      await seedPrimary(seedCount, baseAmount, tdsAmount, "preseed");

      const concurrentWrites = 50;
      const writeAmount = 100_00;
      const writeTds = 1_00;

      await Promise.all(
        Array.from({ length: concurrentWrites }, (_, i) =>
          service.recordTdsToLedger({
            tenantId: TENANT,
            vendorFingerprint: VENDOR,
            financialYear: FY,
            section: SECTION,
            invoiceId: `chaos-split-${i}`,
            invoiceDate: APRIL_15_IST,
            taxableAmountMinor: writeAmount,
            tdsAmountMinor: writeTds,
            rateSource: "rateTable",
            thresholdCrossed: false
          })
        )
      );

      const primary = await TdsVendorLedgerModel.findOne(KEY).lean();
      const overflowPages = await TdsVendorLedgerEntryOverflowModel.find(KEY).lean();

      const expectedBase = baseAmount * seedCount + writeAmount * concurrentWrites;
      const expectedTds = tdsAmount * seedCount + writeTds * concurrentWrites;

      expect(primary?.cumulativeBaseMinor).toBe(expectedBase);
      expect(primary?.cumulativeTdsMinor).toBe(expectedTds);
      expect(primary?.invoiceCount).toBe(seedCount + concurrentWrites);

      const primaryEntries = ((primary?.entries as Array<{ invoiceId: string }> | undefined) ?? []);
      const overflowEntries = overflowPages.flatMap(
        (page) => (page.entries as Array<{ invoiceId: string }> | undefined) ?? []
      );

      const totalEntries = primaryEntries.length + overflowEntries.length;
      expect(totalEntries).toBe(seedCount + concurrentWrites);

      const allIds = [...primaryEntries, ...overflowEntries].map((e) => e.invoiceId);
      expect(new Set(allIds).size).toBe(totalEntries);
    } finally {
      Object.defineProperty(env, "TDS_LEDGER_ENTRIES_CAP", {
        value: original,
        configurable: true,
        writable: true
      });
    }
  });
});

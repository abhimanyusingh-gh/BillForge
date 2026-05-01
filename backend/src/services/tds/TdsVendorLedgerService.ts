import { TdsVendorLedgerModel, type TdsVendorLedger } from "@/models/compliance/TdsVendorLedger.js";
import { TdsVendorLedgerArchiveModel, type TdsVendorLedgerArchive } from "@/models/compliance/TdsVendorLedgerArchive.js";
import {
  mergeOverflowEntries,
  splitEntriesIfOverflow,
  type LedgerKey
} from "@/services/tds/TdsVendorLedgerArchivalService.js";
import { determineQuarter, type TdsQuarter } from "@/services/tds/fiscalYearUtils.js";
import { env } from "@/config/env.js";
import type { TdsRateSource } from "@/types/invoice.js";

interface TdsCumulativeView {
  cumulativeBaseMinor: number;
  cumulativeTdsMinor: number;
  invoiceCount: number;
  thresholdCrossedAt: Date | null;
  quarter: TdsQuarter | null;
  entries: Array<{ rateBps: number }>;
}

const ZERO_VIEW: TdsCumulativeView = {
  cumulativeBaseMinor: 0,
  cumulativeTdsMinor: 0,
  invoiceCount: 0,
  thresholdCrossedAt: null,
  quarter: null,
  entries: []
};

interface RecordTdsToLedgerInput {
  tenantId: string;
  vendorFingerprint: string;
  financialYear: string;
  section: string;
  invoiceId: string;
  invoiceDate: Date;
  taxableAmountMinor: number;
  tdsAmountMinor: number;
  rateBps?: number;
  rateSource: TdsRateSource | string;
  thresholdCrossed: boolean;
  recordedAt?: Date;
}

function assertInteger(field: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`TdsVendorLedgerService: ${field} must be an integer (got ${value})`);
  }
}

export class TdsVendorLedgerService {
  async getCumulativeForVendor(
    tenantId: string,
    vendorFingerprint: string,
    financialYear: string,
    section: string
  ): Promise<TdsCumulativeView> {
    const key: LedgerKey = { tenantId, vendorFingerprint, financialYear, section };

    const primary = await TdsVendorLedgerModel.findOne(key).lean<TdsVendorLedger | null>().exec();
    if (primary) {
      return toView(primary, await maybeMergedEntries(key, primary));
    }

    const archive = await TdsVendorLedgerArchiveModel.findOne(key)
      .lean<TdsVendorLedgerArchive | null>()
      .exec();
    if (archive) {
      return toView(archive, await maybeMergedEntries(key, archive));
    }

    return { ...ZERO_VIEW };
  }

  async recordTdsToLedger(input: RecordTdsToLedgerInput): Promise<TdsCumulativeView> {
    assertInteger("taxableAmountMinor", input.taxableAmountMinor);
    assertInteger("tdsAmountMinor", input.tdsAmountMinor);
    const rateBps = input.rateBps ?? 0;
    assertInteger("rateBps", rateBps);

    const recordedAt = input.recordedAt ?? new Date();
    const quarter = determineQuarter(input.invoiceDate);

    const key: LedgerKey = {
      tenantId: input.tenantId,
      vendorFingerprint: input.vendorFingerprint,
      financialYear: input.financialYear,
      section: input.section
    };

    const setOnInsert: Record<string, unknown> = { ...key };

    const set: Record<string, unknown> = {
      lastUpdatedInvoiceId: input.invoiceId,
      quarter
    };
    if (input.thresholdCrossed) {
      set.thresholdCrossedAt = recordedAt;
    }

    const updated = await TdsVendorLedgerModel.findOneAndUpdate(
      key,
      {
        $setOnInsert: setOnInsert,
        $set: set,
        $inc: {
          cumulativeBaseMinor: input.taxableAmountMinor,
          cumulativeTdsMinor: input.tdsAmountMinor,
          invoiceCount: 1
        },
        $push: {
          entries: {
            invoiceId: input.invoiceId,
            invoiceDate: input.invoiceDate,
            taxableAmountMinor: input.taxableAmountMinor,
            tdsAmountMinor: input.tdsAmountMinor,
            rateBps,
            rateSource: input.rateSource,
            quarter,
            recordedAt
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .lean<TdsVendorLedger>()
      .exec();

    const updatedEntriesCount = ((updated.entries as Array<unknown> | undefined) ?? []).length;
    if (updatedEntriesCount > env.TDS_LEDGER_ENTRIES_CAP) {
      await splitEntriesIfOverflow(key, { cap: env.TDS_LEDGER_ENTRIES_CAP });
    }

    const refreshed = await TdsVendorLedgerModel.findOne(key).lean<TdsVendorLedger | null>().exec();
    const doc = refreshed ?? updated;
    return toView(doc, await maybeMergedEntries(key, doc));
  }
}

async function maybeMergedEntries(
  key: LedgerKey,
  doc: TdsVendorLedger | TdsVendorLedgerArchive
): Promise<Array<Record<string, unknown>>> {
  const baseEntries = ((doc.entries ?? []) as unknown as Array<Record<string, unknown>>);
  if (!doc.hasOverflow) return baseEntries;
  return mergeOverflowEntries(key, baseEntries);
}

function toView(
  doc: TdsVendorLedger | TdsVendorLedgerArchive,
  mergedEntries: Array<Record<string, unknown>>
): TdsCumulativeView {
  return {
    cumulativeBaseMinor: doc.cumulativeBaseMinor as number,
    cumulativeTdsMinor: doc.cumulativeTdsMinor as number,
    invoiceCount: doc.invoiceCount as number,
    thresholdCrossedAt: doc.thresholdCrossedAt ?? null,
    quarter: (doc.quarter as TdsQuarter | null) ?? null,
    entries: mergedEntries.map((e) => ({ rateBps: (e.rateBps as number | undefined) ?? 0 }))
  };
}

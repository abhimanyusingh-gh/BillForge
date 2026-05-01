import { TdsVendorLedgerModel, type TdsVendorLedger } from "@/models/compliance/TdsVendorLedger.js";
import { TdsVendorLedgerArchiveModel } from "@/models/compliance/TdsVendorLedgerArchive.js";
import { TdsVendorLedgerEntryOverflowModel } from "@/models/compliance/TdsVendorLedgerEntryOverflow.js";
import type { UUID } from "@/types/uuid.js";
import type { TdsSection } from "@/types/tdsSection.js";

export interface LedgerKey {
  tenantId: UUID;
  vendorFingerprint: string;
  financialYear: string;
  section: TdsSection;
}

interface SplitOptions {
  cap: number;
}

export async function archiveFyForVendor(
  key: LedgerKey,
  archivedAt: Date = new Date()
): Promise<{ archived: boolean }> {
  const finalSnapshot = await TdsVendorLedgerModel.findOneAndDelete(key)
    .lean<(TdsVendorLedger & { _id: unknown }) | null>()
    .exec();
  if (!finalSnapshot) return { archived: false };

  await TdsVendorLedgerArchiveModel.updateOne(
    key,
    {
      $set: {
        tenantId: finalSnapshot.tenantId,
        vendorFingerprint: finalSnapshot.vendorFingerprint,
        financialYear: finalSnapshot.financialYear,
        section: finalSnapshot.section,
        cumulativeBaseMinor: finalSnapshot.cumulativeBaseMinor as number,
        cumulativeTdsMinor: finalSnapshot.cumulativeTdsMinor as number,
        invoiceCount: finalSnapshot.invoiceCount as number,
        thresholdCrossedAt: finalSnapshot.thresholdCrossedAt ?? null,
        lastUpdatedInvoiceId: finalSnapshot.lastUpdatedInvoiceId ?? null,
        quarter: finalSnapshot.quarter ?? null,
        entries: finalSnapshot.entries ?? [],
        hasOverflow: Boolean(finalSnapshot.hasOverflow),
        archivedAt,
        archivedFromId: finalSnapshot._id
      }
    },
    { upsert: true }
  ).exec();

  return { archived: true };
}

export async function splitEntriesIfOverflow(
  key: LedgerKey,
  options: SplitOptions
): Promise<{ split: boolean; movedCount: number }> {
  const { cap } = options;
  if (cap < 1) return { split: false, movedCount: 0 };

  const before = await TdsVendorLedgerModel.findOneAndUpdate(
    { ...key, $expr: { $gt: [{ $size: { $ifNull: ["$entries", []] } }, cap] } },
    [{ $set: { entries: { $slice: ["$entries", cap] }, hasOverflow: true } }],
    { returnDocument: "before" }
  )
    .lean<TdsVendorLedger | null>()
    .exec();

  if (!before) return { split: false, movedCount: 0 };

  const entries = (before.entries ?? []) as unknown as Array<Record<string, unknown>>;
  const overflow = entries.slice(cap);
  if (overflow.length === 0) return { split: false, movedCount: 0 };

  await TdsVendorLedgerEntryOverflowModel.create({ ...key, entries: overflow });

  return { split: true, movedCount: overflow.length };
}

export async function mergeOverflowEntries(
  key: LedgerKey,
  primaryEntries: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const pages = await TdsVendorLedgerEntryOverflowModel.find(key)
    .sort({ _id: 1 })
    .lean<Array<{ entries?: Array<Record<string, unknown>> }>>()
    .exec();

  if (pages.length === 0) return primaryEntries;

  const merged: Array<Record<string, unknown>> = [...primaryEntries];
  for (const page of pages) {
    if (!page.entries) continue;
    for (const entry of page.entries) merged.push(entry);
  }
  return merged;
}

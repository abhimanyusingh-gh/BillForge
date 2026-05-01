import { Schema, model, type InferSchemaType } from "mongoose";
import { tdsVendorLedgerEntrySchema } from "@/models/compliance/tdsVendorLedger.entry.js";

const tdsVendorLedgerEntryOverflowSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    vendorFingerprint: { type: String, required: true },
    financialYear: { type: String, required: true },
    section: { type: String, required: true },
    entries: { type: [tdsVendorLedgerEntrySchema], default: [] }
  },
  { timestamps: true }
);

tdsVendorLedgerEntryOverflowSchema.index({
  tenantId: 1,
  vendorFingerprint: 1,
  financialYear: 1,
  section: 1
});

type TdsVendorLedgerEntryOverflow = InferSchemaType<
  typeof tdsVendorLedgerEntryOverflowSchema
>;

export const TdsVendorLedgerEntryOverflowModel = model<TdsVendorLedgerEntryOverflow>(
  "TdsVendorLedgerEntryOverflow",
  tdsVendorLedgerEntryOverflowSchema
);

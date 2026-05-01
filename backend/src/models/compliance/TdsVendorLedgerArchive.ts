import { Schema, model, type InferSchemaType } from "mongoose";
import { tdsVendorLedgerEntrySchema } from "@/models/compliance/tdsVendorLedger.entry.js";

const tdsVendorLedgerArchiveSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    vendorFingerprint: { type: String, required: true },
    financialYear: { type: String, required: true },
    section: { type: String, required: true },
    cumulativeBaseMinor: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "cumulativeBaseMinor must be an integer."
      }
    },
    cumulativeTdsMinor: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "cumulativeTdsMinor must be an integer."
      }
    },
    invoiceCount: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "invoiceCount must be an integer."
      }
    },
    thresholdCrossedAt: { type: Date, default: null },
    lastUpdatedInvoiceId: { type: String, default: null },
    quarter: {
      type: String,
      enum: ["Q1", "Q2", "Q3", "Q4"],
      default: null
    },
    entries: { type: [tdsVendorLedgerEntrySchema], default: [] },
    hasOverflow: { type: Boolean, default: false },
    archivedAt: { type: Date, required: true },
    archivedFromId: { type: Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

tdsVendorLedgerArchiveSchema.index(
  { tenantId: 1, vendorFingerprint: 1, financialYear: 1, section: 1 },
  { unique: true }
);
tdsVendorLedgerArchiveSchema.index({ tenantId: 1, financialYear: 1, section: 1 });
tdsVendorLedgerArchiveSchema.index({ tenantId: 1, archivedAt: 1 });

export type TdsVendorLedgerArchive = InferSchemaType<typeof tdsVendorLedgerArchiveSchema>;

export const TdsVendorLedgerArchiveModel = model<TdsVendorLedgerArchive>(
  "TdsVendorLedgerArchive",
  tdsVendorLedgerArchiveSchema
);

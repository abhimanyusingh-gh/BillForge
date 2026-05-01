import { Schema } from "mongoose";

export const EXPORT_BATCH_ITEM_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILURE: "failure"
} as const;

export const EXPORT_BATCH_VOUCHER_TYPE = {
  PURCHASE: "purchase",
  PAYMENT: "payment"
} as const;

const exportBatchItemTallyAttemptSchema = new Schema(
  {
    exportVersion: { type: Number, required: true },
    lineError: { type: String },
    lineErrorOrdinal: { type: Number },
    attemptedAt: { type: Date, required: true }
  },
  { _id: false }
);

const exportBatchItemTallyResponseSchema = new Schema(
  {
    lineError: { type: String },
    lineErrorOrdinal: { type: Number },
    attempts: { type: [exportBatchItemTallyAttemptSchema], default: undefined }
  },
  { _id: false }
);

export const exportBatchItemSchema = new Schema(
  {
    invoiceId: { type: String, required: true },
    paymentId: { type: String },
    voucherType: {
      type: String,
      required: true,
      enum: Object.values(EXPORT_BATCH_VOUCHER_TYPE)
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(EXPORT_BATCH_ITEM_STATUS)
    },
    tallyResponse: { type: exportBatchItemTallyResponseSchema },
    exportVersion: { type: Number, required: true, default: 0 },
    guid: { type: String, required: true },
    completedAt: { type: Date }
  },
  { _id: false }
);

import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const bankStatementSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    fileName: { type: String, required: true },
    bankName: { type: String, default: null },
    accountNumberMasked: { type: String, default: null },
    periodFrom: { type: String, default: null },
    periodTo: { type: String, default: null },
    transactionCount: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedCount: { type: Number, default: 0 },
    source: { type: String, enum: ["pdf-parsed", "csv-import"], required: true },
    uploadedBy: { type: String }
  },
  { timestamps: true }
);

bankStatementSchema.index({ tenantId: 1, createdAt: -1 });

type BankStatement = InferSchemaType<typeof bankStatementSchema>;
type BankStatementDocument = HydratedDocument<BankStatement>;

export const BankStatementModel = model<BankStatement>("BankStatement", bankStatementSchema);

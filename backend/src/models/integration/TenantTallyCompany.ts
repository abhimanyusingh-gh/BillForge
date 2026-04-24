import { Schema, model, type InferSchemaType } from "mongoose";

const tenantTallyCompanySchema = new Schema(
  {
    tenantId: { type: String, required: true },
    companyName: { type: String },
    companyGuid: { type: String },
    stateName: { type: String },
    f12OverwriteByGuidVerified: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

tenantTallyCompanySchema.index({ tenantId: 1 }, { unique: true });

type TenantTallyCompany = InferSchemaType<typeof tenantTallyCompanySchema>;

export const TenantTallyCompanyModel = model<TenantTallyCompany>(
  "TenantTallyCompany",
  tenantTallyCompanySchema
);

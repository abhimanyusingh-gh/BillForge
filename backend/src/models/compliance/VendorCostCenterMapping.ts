import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const vendorCostCenterMappingSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    vendorFingerprint: { type: String, required: true },
    costCenterCode: { type: String, required: true },
    costCenterName: { type: String, required: true },
    usageCount: { type: Number, required: true, default: 0 },
    lastUsedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

vendorCostCenterMappingSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

vendorCostCenterMappingSchema.index({ clientOrgId: 1, vendorFingerprint: 1, costCenterCode: 1 }, { unique: true });

type VendorCostCenterMapping = InferSchemaType<typeof vendorCostCenterMappingSchema>;
type VendorCostCenterMappingDocument = HydratedDocument<VendorCostCenterMapping>;

export const VendorCostCenterMappingModel = model<VendorCostCenterMapping>("VendorCostCenterMapping", vendorCostCenterMappingSchema);

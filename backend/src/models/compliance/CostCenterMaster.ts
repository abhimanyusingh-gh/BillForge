import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const costCenterMasterSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    department: { type: String, default: null },
    linkedGlCodes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

costCenterMasterSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

costCenterMasterSchema.index({ clientOrgId: 1, code: 1 }, { unique: true });

type CostCenterMaster = InferSchemaType<typeof costCenterMasterSchema>;
type CostCenterMasterDocument = HydratedDocument<CostCenterMaster>;

export const CostCenterMasterModel = model<CostCenterMaster>("CostCenterMaster", costCenterMasterSchema);

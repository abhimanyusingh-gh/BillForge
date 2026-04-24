import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const glCodeMasterSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    linkedTdsSection: { type: String, default: null },
    parentCode: { type: String, default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

glCodeMasterSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

glCodeMasterSchema.index({ clientOrgId: 1, code: 1 }, { unique: true });
glCodeMasterSchema.index({ clientOrgId: 1, category: 1 });

type GlCodeMaster = InferSchemaType<typeof glCodeMasterSchema>;
type GlCodeMasterDocument = HydratedDocument<GlCodeMaster>;

export const GlCodeMasterModel = model<GlCodeMaster>("GlCodeMaster", glCodeMasterSchema);

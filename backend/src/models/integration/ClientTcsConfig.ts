import { Schema, model, type InferSchemaType } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const tcsRateChangeSchema = new Schema(
  {
    previousRate: { type: Number, required: true },
    newRate: { type: Number, required: true },
    changedBy: { type: String, required: true },
    changedByName: { type: String, required: true, default: "" },
    changedAt: { type: Date, required: true },
    reason: { type: String, default: null },
    effectiveFrom: { type: Date, required: true }
  },
  { _id: false }
);

const clientTcsConfigSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    ratePercent: { type: Number, required: true, default: 0 },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    updatedBy: { type: String, required: true, default: "" },
    enabled: { type: Boolean, required: true, default: false },
    tcsModifyRoles: {
      type: [String],
      required: true,
      default: () => ["TENANT_ADMIN", "ap_clerk", "senior_accountant", "ca", "tax_specialist", "firm_partner", "ops_admin", "audit_clerk"]
    },
    history: { type: [tcsRateChangeSchema], default: [] }
  },
  { timestamps: true }
);

clientTcsConfigSchema.index({ tenantId: 1, clientOrgId: 1 }, { unique: true });

clientTcsConfigSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

type ClientTcsConfig = InferSchemaType<typeof clientTcsConfigSchema>;

export const ClientTcsConfigModel = model<ClientTcsConfig>("ClientTcsConfig", clientTcsConfigSchema);

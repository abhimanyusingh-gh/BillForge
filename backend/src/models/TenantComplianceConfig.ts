import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const tenantComplianceConfigSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    complianceEnabled: { type: Boolean, default: false },
    autoSuggestGlCodes: { type: Boolean, default: true },
    autoDetectTds: { type: Boolean, default: true },
    enabledSignals: { type: [String], default: [] },
    disabledSignals: { type: [String], default: [] },
    signalSeverityOverrides: { type: Map, of: String, default: {} },
    defaultTdsSection: { type: String, default: null },
    defaultTcsRateBps: { type: Number, default: null }
  },
  { timestamps: true }
);

tenantComplianceConfigSchema.index({ tenantId: 1 }, { unique: true });

type TenantComplianceConfig = InferSchemaType<typeof tenantComplianceConfigSchema>;
type TenantComplianceConfigDocument = HydratedDocument<TenantComplianceConfig>;

export const TenantComplianceConfigModel = model<TenantComplianceConfig>("TenantComplianceConfig", tenantComplianceConfigSchema);

import { Schema, model, type InferSchemaType } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const tdsRateEntrySchema = new Schema(
  {
    section: { type: String, required: true },
    description: { type: String, required: true },
    rateIndividual: { type: Number, required: true },
    rateCompany: { type: Number, required: true },
    rateNoPan: { type: Number, required: true },
    threshold: { type: Number, required: true },
    active: { type: Boolean, default: true }
  },
  { _id: false }
);

const clientComplianceConfigSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    complianceEnabled: { type: Boolean, default: false },
    autoSuggestGlCodes: { type: Boolean, default: true },
    autoDetectTds: { type: Boolean, default: true },
    tdsEnabled: { type: Boolean, default: false },
    tdsRates: { type: [tdsRateEntrySchema], default: [] },
    panValidationEnabled: { type: Boolean, default: false },
    panValidationLevel: { type: String, enum: ["format", "format_and_checksum", "disabled"], default: "disabled" },
    riskSignalsEnabled: { type: Boolean, default: false },
    activeRiskSignals: { type: [String], default: [] },
    disabledSignals: { type: [String], default: [] },
    signalSeverityOverrides: { type: Map, of: String, default: {} },
    defaultTdsSection: { type: String, default: null },
    defaultTcsRateBps: { type: Number, default: null },
    updatedBy: { type: String, default: null },

    maxInvoiceTotalMinor: { type: Number },
    maxDueDays: { type: Number },
    autoApprovalThreshold: { type: Number },
    eInvoiceThresholdMinor: { type: Number },
    msmePaymentWarningDays: { type: Number },
    msmePaymentOverdueDays: { type: Number },
    minimumExpectedTotalMinor: { type: Number },
    riskSignalPenaltyCap: { type: Number },
    ocrWeight: { type: Number },
    completenessWeight: { type: Number },
    warningPenalty: { type: Number },
    warningPenaltyCap: { type: Number },
    requiredFields: { type: [String] },
    confidencePenaltyOverrides: { type: Map, of: Number },
    reconciliationAutoMatchThreshold: { type: Number },
    reconciliationSuggestThreshold: { type: Number },
    reconciliationAmountToleranceMinor: { type: Number },
    invoiceDateWindowDays: { type: Number },
    defaultCurrency: { type: String },
    approvalLimitOverrides: { type: Map, of: Number },
    additionalFreemailDomains: { type: [String], default: undefined },
    learningMode: { type: String, enum: ["active", "assistive"], default: undefined },
    reconciliationWeightExactAmount: { type: Number, default: 50 },
    reconciliationWeightCloseAmount: { type: Number, default: 10 },
    reconciliationWeightInvoiceNumber: { type: Number, default: 30 },
    reconciliationWeightVendorName: { type: Number, default: 20 },
    reconciliationWeightDateProximity: { type: Number, default: 10 }
  },
  { timestamps: true }
);

clientComplianceConfigSchema.index({ tenantId: 1, clientOrgId: 1 }, { unique: true });

clientComplianceConfigSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

type ClientComplianceConfig = InferSchemaType<typeof clientComplianceConfigSchema>;

export interface ClientComplianceConfigFields {
  tenantId: string;
  clientOrgId: import("mongoose").Types.ObjectId;
  complianceEnabled?: boolean;
  autoSuggestGlCodes?: boolean;
  autoDetectTds?: boolean;
  tdsEnabled?: boolean;
  tdsRates?: Array<{
    section: string;
    description: string;
    rateIndividual: number;
    rateCompany: number;
    rateNoPan: number;
    threshold: number;
    active: boolean;
  }>;
  panValidationEnabled?: boolean;
  panValidationLevel?: "format" | "format_and_checksum" | "disabled";
  riskSignalsEnabled?: boolean;
  activeRiskSignals?: string[];
  disabledSignals?: string[];
  signalSeverityOverrides?: Record<string, string>;
  defaultTdsSection?: string | null;
  defaultTcsRateBps?: number | null;
  updatedBy?: string | null;

  maxInvoiceTotalMinor?: number;
  maxDueDays?: number;
  autoApprovalThreshold?: number;
  eInvoiceThresholdMinor?: number;
  msmePaymentWarningDays?: number;
  msmePaymentOverdueDays?: number;
  minimumExpectedTotalMinor?: number;
  riskSignalPenaltyCap?: number;
  ocrWeight?: number;
  completenessWeight?: number;
  warningPenalty?: number;
  warningPenaltyCap?: number;
  requiredFields?: string[];
  confidencePenaltyOverrides?: Record<string, number>;
  reconciliationAutoMatchThreshold?: number;
  reconciliationSuggestThreshold?: number;
  reconciliationAmountToleranceMinor?: number;
  invoiceDateWindowDays?: number;
  defaultCurrency?: string;
  approvalLimitOverrides?: Record<string, number>;
  additionalFreemailDomains?: string[];
  learningMode?: "active" | "assistive";
  reconciliationWeightExactAmount?: number;
  reconciliationWeightCloseAmount?: number;
  reconciliationWeightInvoiceNumber?: number;
  reconciliationWeightVendorName?: number;
  reconciliationWeightDateProximity?: number;
}

export const ClientComplianceConfigModel = model<ClientComplianceConfig>("ClientComplianceConfig", clientComplianceConfigSchema);

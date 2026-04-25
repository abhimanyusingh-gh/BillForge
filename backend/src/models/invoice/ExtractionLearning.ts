import { Schema, model, type InferSchemaType } from "mongoose";
import { validateClientOrgTenantInvariant } from "@/services/auth/tenantScope.js";

const correctionEntrySchema = new Schema(
  {
    field: { type: String, required: true },
    hint: { type: String, required: true, maxlength: 80 },
    count: { type: Number, default: 1 },
    lastSeen: { type: Date, default: Date.now }
  },
  { _id: false }
);

const extractionLearningSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    clientOrgId: { type: Schema.Types.ObjectId, ref: "ClientOrganization", required: true },
    groupKey: { type: String, required: true },
    groupType: { type: String, required: true, enum: ["invoice-type", "vendor"] },
    corrections: { type: [correctionEntrySchema], default: [] }
  },
  { timestamps: true }
);

extractionLearningSchema.pre("save", async function () {
  await validateClientOrgTenantInvariant(this.tenantId, this.clientOrgId);
});

extractionLearningSchema.index({ clientOrgId: 1, groupKey: 1, groupType: 1 }, { unique: true });
extractionLearningSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

type ExtractionLearning = InferSchemaType<typeof extractionLearningSchema>;
export const ExtractionLearningModel = model<ExtractionLearning>("ExtractionLearning", extractionLearningSchema);

import { Schema, model, type InferSchemaType } from "mongoose";

const ApprovalWorkflowModes = ["simple", "advanced"] as const;
const ApproverTypes = ["any_member", "role", "specific_users"] as const;
const ApprovalRules = ["any", "all"] as const;
const ConditionOperators = ["gt", "gte", "lt", "lte"] as const;

const workflowStepSchema = new Schema({
  order: { type: Number, required: true },
  name: { type: String, required: true },
  approverType: { type: String, enum: ApproverTypes, required: true },
  approverRole: { type: String },
  approverUserIds: { type: [String], default: [] },
  rule: { type: String, enum: ApprovalRules, required: true, default: "any" },
  condition: {
    field: { type: String },
    operator: { type: String, enum: ConditionOperators },
    value: { type: Number }
  }
}, { _id: false });

const approvalWorkflowSchema = new Schema({
  tenantId: { type: String, required: true },
  enabled: { type: Boolean, required: true, default: false },
  mode: { type: String, enum: ApprovalWorkflowModes, required: true, default: "simple" },
  simpleConfig: {
    requireManagerReview: { type: Boolean, default: false },
    requireFinalSignoff: { type: Boolean, default: false }
  },
  steps: { type: [workflowStepSchema], default: [] },
  updatedBy: { type: String }
}, { timestamps: true });

approvalWorkflowSchema.index({ tenantId: 1 }, { unique: true });

type ApprovalWorkflow = InferSchemaType<typeof approvalWorkflowSchema>;
export const ApprovalWorkflowModel = model<ApprovalWorkflow>("ApprovalWorkflow", approvalWorkflowSchema);

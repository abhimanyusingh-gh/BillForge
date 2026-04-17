export const APPROVAL_WORKFLOW_MODE = {
  SIMPLE: "simple",
  ADVANCED: "advanced",
} as const;

export type ApprovalWorkflowMode = (typeof APPROVAL_WORKFLOW_MODE)[keyof typeof APPROVAL_WORKFLOW_MODE];

export const APPROVAL_STEP_TYPE = {
  APPROVAL: "approval",
} as const;

export type ApprovalStepType = (typeof APPROVAL_STEP_TYPE)[keyof typeof APPROVAL_STEP_TYPE];

export const APPROVER_TYPE = {
  ANY_MEMBER: "any_member",
  ROLE: "role",
  SPECIFIC_USERS: "specific_users",
} as const;

export type ApproverType = (typeof APPROVER_TYPE)[keyof typeof APPROVER_TYPE];

export const APPROVAL_RULE = {
  ANY: "any",
  ALL: "all",
} as const;

export type ApprovalRule = (typeof APPROVAL_RULE)[keyof typeof APPROVAL_RULE];

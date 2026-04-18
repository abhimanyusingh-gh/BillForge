import type { TenantUser, WorkflowStep } from "@/types";
import { ApproverSelector } from "./ApproverSelector";
import { StepConditionEditor } from "./StepConditionEditor";

interface ComplianceSignoffUser {
  userId: string;
  role: string;
}

interface StepCardProps {
  step: WorkflowStep;
  stepCount: number;
  tenantUsers: TenantUser[];
  complianceSignoffUsers?: ComplianceSignoffUser[];
  onUpdate: (patch: Partial<WorkflowStep>) => void;
  onRemove: () => void;
}

function resolveEmail(userId: string, tenantUsers: TenantUser[]): string {
  const user = tenantUsers.find((u) => u.userId === userId);
  return user?.email ?? userId;
}

export function StepCard({ step, stepCount, tenantUsers, complianceSignoffUsers, onUpdate, onRemove }: StepCardProps) {
  const isComplianceSignoff = step.type === "compliance_signoff";
  const eligibleUsers = complianceSignoffUsers ?? [];

  return (
    <div className="workflow-step-card">
      <div className="workflow-step-card-header">
        <span>Step {step.order}</span>
        {isComplianceSignoff ? (
          <span style={{ fontSize: "0.72rem", padding: "0.1rem 0.4rem", background: "var(--accent)", color: "#fff", borderRadius: "0.2rem" }}>
            Compliance Sign-off
          </span>
        ) : null}
        {stepCount > 1 ? (
          <button
            type="button"
            className="app-button app-button-secondary"
            style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="workflow-step-card-body">
        <ApproverSelector
          approver={{
            approverType: step.approverType,
            approverRole: step.approverRole,
            approverUserIds: step.approverUserIds,
            approverPersona: step.approverPersona,
            approverCapability: step.approverCapability,
          }}
          tenantUsers={tenantUsers}
          onApproverChange={(approver) => onUpdate(approver)}
        />

        <label>
          Rule:
          <select
            value={step.rule}
            onChange={(e) => onUpdate({ rule: e.target.value as "any" | "all" })}
          >
            <option value="any">Any one approves</option>
            <option value="all">All must approve</option>
          </select>
        </label>

        <StepConditionEditor
          condition={step.condition}
          onChange={(condition: WorkflowStep["condition"]) => onUpdate({ condition })}
        />

        {isComplianceSignoff ? (
          <div style={{ marginTop: "0.75rem" }}>
            {eligibleUsers.length === 0 ? (
              <div
                role="alert"
                style={{
                  padding: "0.5rem 0.75rem",
                  background: "var(--warn-bg, #fef3cd)",
                  border: "1px solid var(--warn, #f59e0b)",
                  borderRadius: "0.25rem",
                  fontSize: "0.82rem",
                  color: "var(--ink, #333)",
                }}
              >
                No users have compliance sign-off capability.{" "}
                <a href="#users" style={{ color: "var(--accent)" }}>
                  Grant capability in Users section
                </a>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--ink-soft, #666)", marginBottom: "0.35rem" }}>
                  Eligible compliance sign-off users:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem" }}>
                  {eligibleUsers.map((u) => (
                    <li key={u.userId}>
                      {resolveEmail(u.userId, tenantUsers)} ({u.role})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

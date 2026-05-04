import { useState } from "react";
import type { TenantUser, WorkflowStep, WorkflowStepType } from "@/types";
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

const STEP_TYPE_OPTIONS: Array<{ value: WorkflowStepType; label: string }> = [
  { value: "approval", label: "Approval" },
  { value: "compliance_signoff", label: "Compliance Sign-off" },
  { value: "escalation", label: "Escalation" },
];

function hasAdvancedValues(step: WorkflowStep): boolean {
  if (step.type && step.type !== "approval") return true;
  if (step.timeoutHours !== undefined && step.timeoutHours !== null) return true;
  if (step.escalateTo !== undefined && step.escalateTo !== null) return true;
  return false;
}

function resolveEmail(userId: string, tenantUsers: TenantUser[]): string {
  const user = tenantUsers.find((u) => u.userId === userId);
  return user?.email ?? userId;
}

export function StepCard({ step, stepCount, tenantUsers, complianceSignoffUsers, onUpdate, onRemove }: StepCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedValues(step));
  const isComplianceSignoff = step.type === "compliance_signoff";
  const isEscalation = step.type === "escalation";
  const eligibleUsers = complianceSignoffUsers ?? [];

  return (
    <div className="workflow-step-card">
      <div className="workflow-step-card-header">
        <span>Step {step.order}</span>
        {isComplianceSignoff ? (
          <span className="approval-workflow-step-tag">
            Compliance Sign-off
          </span>
        ) : null}
        {isEscalation ? (
          <span className="approval-workflow-step-tag approval-workflow-step-tag-escalation">
            Escalation
          </span>
        ) : null}
        {stepCount > 1 ? (
          <button
            type="button"
            className="app-button app-button-secondary vendor-msme-row-action-btn"
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

        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="approval-workflow-advanced-toggle"
        >
          Advanced options {advancedOpen ? "▴" : "▾"}
        </button>

        {advancedOpen ? (
          <div className="approval-workflow-advanced-body">
            <label>
              Step type:
              <select
                value={step.type ?? "approval"}
                onChange={(e) => {
                  const newType = e.target.value as WorkflowStepType;
                  const patch: Partial<WorkflowStep> = { type: newType };
                  if (newType !== "escalation") {
                    patch.timeoutHours = null;
                    patch.escalateTo = null;
                  }
                  onUpdate(patch);
                }}
              >
                {STEP_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            {isEscalation ? (
              <>
                <label>
                  Timeout (hours):
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={step.timeoutHours ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      if (val !== null && (val < 1 || val > 720 || !Number.isInteger(val))) return;
                      onUpdate({ timeoutHours: val });
                    }}
                    className="approval-workflow-narrow-input"
                  />
                </label>
                <p className="approval-workflow-helper-text">
                  Time before this step auto-escalates. Uses wall-clock hours.
                </p>
                <label>
                  Escalate to:
                  <select
                    value={step.escalateTo ?? ""}
                    onChange={(e) => onUpdate({ escalateTo: e.target.value || null })}
                  >
                    <option value="">Select user or role</option>
                    {tenantUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>{u.email}</option>
                    ))}
                  </select>
                </label>
                {step.timeoutHours != null && !step.escalateTo ? (
                  <p role="alert" className="approval-workflow-warning-text">
                    Escalation target is required when a timeout is set.
                  </p>
                ) : null}
              </>
            ) : null}

            {isComplianceSignoff ? (
              <div className="approval-workflow-compliance-block">
                {eligibleUsers.length === 0 ? (
                  <div role="alert" className="approval-workflow-compliance-empty">
                    No users have compliance sign-off capability.{" "}
                    <a href="#users">
                      Grant capability in Users section
                    </a>
                  </div>
                ) : (
                  <div>
                    <p className="approval-workflow-eligible-heading">
                      Eligible compliance sign-off users:
                    </p>
                    <ul className="approval-workflow-eligible-list">
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
        ) : null}
      </div>
    </div>
  );
}

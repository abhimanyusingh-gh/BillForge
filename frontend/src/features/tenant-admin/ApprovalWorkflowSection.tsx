import { useState, useEffect, useCallback } from "react";
import type { ApprovalWorkflowConfig, TenantUser, WorkflowStep } from "@/types";
import { fetchApprovalWorkflow, saveApprovalWorkflow } from "@/api";
import { fetchApprovalLimits } from "@/api/admin";
import { getUserFacingErrorMessage } from "@/lib/common/apiError";
import { StepCard } from "./workflow/StepCard";

interface ApprovalWorkflowSectionProps {
  tenantUsers: TenantUser[];
}

function buildSimpleSteps(config: { requireManagerReview: boolean; requireFinalSignoff: boolean }): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    { order: 1, name: "Team member approval", approverType: "any_member", rule: "any", condition: null }
  ];
  if (config.requireManagerReview) {
    steps.push({ order: 2, name: "Manager review", approverType: "role", approverRole: "TENANT_ADMIN", rule: "any", condition: null });
  }
  if (config.requireFinalSignoff) {
    steps.push({ order: steps.length + 1, name: "Final sign-off", approverType: "role", approverRole: "TENANT_ADMIN", rule: "any", condition: null });
  }
  return steps;
}

export function ApprovalWorkflowSection({ tenantUsers }: ApprovalWorkflowSectionProps) {
  const [config, setConfig] = useState<ApprovalWorkflowConfig>({
    enabled: false,
    mode: "simple",
    simpleConfig: { requireManagerReview: false, requireFinalSignoff: false },
    steps: []
  });
  const [savedConfig, setSavedConfig] = useState<ApprovalWorkflowConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [complianceSignoffUsers, setComplianceSignoffUsers] = useState<Array<{ userId: string; role: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    fetchApprovalWorkflow()
      .then((data) => { if (!cancelled) { setConfig(data); setSavedConfig(data); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    fetchApprovalLimits()
      .then((data) => { if (!cancelled) setComplianceSignoffUsers(data.complianceSignoffUsers ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<ApprovalWorkflowConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setSuccess(false);
  }, []);

  const dirty = savedConfig !== null && JSON.stringify(config) !== JSON.stringify(savedConfig);

  const isValid = !config.enabled || config.mode === "simple" || config.steps.length > 0;

  const handleSave = useCallback(async () => {
    if (!isValid) {
      setError("Add at least one approval step.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await saveApprovalWorkflow(config);
      setConfig(result);
      setSavedConfig(result);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(getUserFacingErrorMessage(e, "Failed to save workflow."));
    } finally {
      setSaving(false);
    }
  }, [config, isValid]);

  const switchToAdvanced = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      mode: "advanced" as const,
      steps: prev.steps.length > 0 ? prev.steps : buildSimpleSteps(prev.simpleConfig)
    }));
  }, []);

  const addStep = useCallback(() => {
    setConfig((prev) => {
      const maxOrder = prev.steps.length > 0 ? Math.max(...prev.steps.map((s) => s.order)) : 0;
      const newStep: WorkflowStep = {
        order: maxOrder + 1,
        name: `Step ${maxOrder + 1}`,
        approverType: "any_member",
        rule: "any",
        condition: null
      };
      return { ...prev, steps: [...prev.steps, newStep] };
    });
  }, []);

  const removeStep = useCallback((order: number) => {
    setConfig((prev) => {
      const filtered = prev.steps.filter((s) => s.order !== order);
      const renumbered = filtered.map((s, i) => ({ ...s, order: i + 1, name: s.name.startsWith("Step ") ? `Step ${i + 1}` : s.name }));
      return { ...prev, steps: renumbered };
    });
  }, []);

  const updateStep = useCallback((order: number, patch: Partial<WorkflowStep>) => {
    setConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => s.order === order ? { ...s, ...patch } : s)
    }));
  }, []);

  if (!loaded) {
    return (
      <div className="editor-card">
        <div className="editor-header"><h3>Approval Workflow</h3></div>
        <p className="skeleton-row">Loading…</p>
      </div>
    );
  }

  const noUsers = tenantUsers.length === 0;

  return (
    <div className={`editor-card${noUsers ? " approval-workflow-disabled" : ""}`}>
      <div className="editor-header"><h3>Approval Workflow</h3></div>

      {noUsers ? (
        <p className="field-hint">Add team members before configuring approval workflows.</p>
      ) : (
        <>
      <div className="realm-pill-group">
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Require approval workflow
        </label>
      </div>
      <p className="field-hint">
        {config.enabled
          ? "Invoices will require step-by-step approval before export."
          : "Any member or admin can approve invoices directly."}
      </p>

      {config.enabled && config.mode === "simple" ? (
        <div className="field-row">
          <div className="field-row">
            <span className="material-symbols-outlined material-symbols-outlined">check_circle</span>
            <span>Step 1: Approved by any team member</span>
          </div>

          <div className="field-row">
            <label>
              <input
                type="checkbox"
                checked={config.simpleConfig.requireManagerReview}
                onChange={(e) => update({
                  simpleConfig: { ...config.simpleConfig, requireManagerReview: e.target.checked }
                })}
              />
              Require manager review
            </label>
            <small>(A Tenant Admin must approve after the team member)</small>
          </div>

          <div className="field-row">
            <label>
              <input
                type="checkbox"
                checked={config.simpleConfig.requireFinalSignoff}
                onChange={(e) => update({
                  simpleConfig: { ...config.simpleConfig, requireFinalSignoff: e.target.checked }
                })}
              />
              Require final sign-off
            </label>
            <small>(A second Tenant Admin confirms after manager review)</small>
          </div>

          <div className="field-row">
            <button type="button" className="realm-pill-group" onClick={switchToAdvanced}>
              Switch to Advanced Workflow →
            </button>
          </div>
        </div>
      ) : null}

      {config.enabled && config.mode === "advanced" ? (
        <div className="field-row">
          {config.steps.map((step, idx) => (
            <div key={step.order}>
              {idx > 0 ? <div className="workflow-connector">↓</div> : null}
              <StepCard
                step={step}
                stepCount={config.steps.length}
                tenantUsers={tenantUsers}
                complianceSignoffUsers={complianceSignoffUsers}
                onUpdate={(patch) => updateStep(step.order, patch)}
                onRemove={() => removeStep(step.order)}
              />
            </div>
          ))}

          <div className="field-row">
            <button type="button" className="btn primary" onClick={addStep}>
              + Add Step
            </button>
            <button type="button" className="realm-pill-group" onClick={() => update({ mode: "simple" })}>
              ← Back to Simple Mode
            </button>
          </div>
        </div>
      ) : null}

      {dirty && isValid ? (
        <div className="field-row">
          <button type="button" className="btn ghost" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save Workflow"}
          </button>
          {error ? <span className="alert warn">{error}</span> : null}
          {success ? <span className="alert ok">Saved</span> : null}
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}

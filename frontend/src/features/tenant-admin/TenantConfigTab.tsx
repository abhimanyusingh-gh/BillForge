import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GmailConnectionStatus, SessionRole } from "@/types";
import { TENANT_ROLE_OPTIONS, type TenantRole, type TenantUser, type UserCapabilities } from "@/types";
import { ApprovalWorkflowSection } from "@/features/tenant-admin/ApprovalWorkflowSection";
import { ApprovalLimitsSection } from "@/features/tenant-admin/ApprovalLimitsSection";
import { GlCodeManager } from "@/features/tenant-admin/GlCodeManager";
import { EmptyState } from "@/components/common/EmptyState";
import { TcsConfigPanel } from "@/features/tenant-admin/TcsConfigPanel";
import { ComplianceConfigPanel } from "@/features/tenant-admin/ComplianceConfigPanel";
import { ReconciliationWeightsSection } from "@/features/tenant-admin/ReconciliationWeightsSection";
import { NotificationPreferencesSection } from "@/features/tenant-admin/NotificationPreferencesSection";
import { VendorMsmeSection } from "@/features/tenant-admin/VendorMsmeSection";

type ConfigSectionId =
  | "workflow"
  | "approval-limits"
  | "gl-codes"
  | "compliance"
  | "reconciliation"
  | "tcs"
  | "vendor-msme"
  | "notifications"
  | "users";

interface ConfigSectionDescriptor {
  id: ConfigSectionId;
  label: string;
  icon: string;
  summary: string;
  visible: boolean;
  node: ReactNode;
}

const ACCORDION_STATE_KEY = "ledgerbuddy:tenant-config-accordion";

interface TenantConfigTabProps {
  currentUserId: string;
  currentUserRole: SessionRole;
  capabilities: UserCapabilities;
  gmailConnection: GmailConnectionStatus | null;
  onConnectGmail: () => void;
  inviteEmail: string;
  onInviteEmailChange: (email: string) => void;
  onInviteUser: () => void;
  tenantUsers: TenantUser[];
  onRoleChange: (userId: string, role: TenantRole) => void;
  onToggleUserEnabled: (userId: string, enabled: boolean) => void;
  onRemoveUser: (userId: string) => void;
}

function readAccordionState(): Partial<Record<ConfigSectionId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCORDION_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Partial<Record<ConfigSectionId, boolean>>;
  } catch {
    /* ignore corrupt JSON */
  }
  return {};
}

function writeAccordionState(state: Partial<Record<ConfigSectionId, boolean>>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCORDION_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function TenantConfigTab({
  currentUserId,
  currentUserRole,
  capabilities,
  gmailConnection,
  onConnectGmail,
  inviteEmail,
  onInviteEmailChange,
  onInviteUser,
  tenantUsers,
  onRoleChange,
  onToggleUserEnabled,
  onRemoveUser
}: TenantConfigTabProps) {
  const gmailConnectionState = gmailConnection?.connectionState ?? "DISCONNECTED";
  const gmailNeedsReauth = gmailConnectionState === "NEEDS_REAUTH";
  const canManageUsers = capabilities.canManageUsers === true;
  const canManageConnections = capabilities.canManageConnections === true;
  const canConfigureWorkflow = capabilities.canConfigureWorkflow === true;
  const canConfigureGlCodes = capabilities.canConfigureGlCodes === true;
  const canConfigureCompliance = capabilities.canConfigureCompliance === true;

  const teammateCount = tenantUsers.filter((u) => u.userId !== currentUserId).length;

  const sections = useMemo<ConfigSectionDescriptor[]>(() => [
    {
      id: "workflow",
      label: "Approval workflow",
      icon: "rule",
      summary: "Routing rules for who reviews and approves invoices.",
      visible: canConfigureWorkflow,
      node: <ApprovalWorkflowSection tenantUsers={tenantUsers} />,
    },
    {
      id: "approval-limits",
      label: "Approval limits",
      icon: "verified_user",
      summary: "Per-role spend ceilings and compliance sign-off list.",
      visible: canConfigureWorkflow,
      node: <ApprovalLimitsSection currentUserId={currentUserId} currentUserRole={currentUserRole} />,
    },
    {
      id: "gl-codes",
      label: "Chart of Accounts",
      icon: "account_tree",
      summary: "GL codes used to map invoice lines to ledgers.",
      visible: canConfigureGlCodes,
      node: (
        <div className="editor-card">
          <GlCodeManager />
        </div>
      ),
    },
    {
      id: "compliance",
      label: "Compliance config",
      icon: "policy",
      summary: "TDS sections, GST treatment defaults, statutory thresholds.",
      visible: canConfigureCompliance,
      node: <ComplianceConfigPanel canConfigureCompliance={canConfigureCompliance} />,
    },
    {
      id: "reconciliation",
      label: "Reconciliation weights",
      icon: "balance",
      summary: "Tunable scoring weights for invoice/payment matching.",
      visible: canConfigureCompliance || capabilities.canApproveInvoices,
      node: <ReconciliationWeightsSection />,
    },
    {
      id: "tcs",
      label: "TCS config",
      icon: "receipt_long",
      summary: "Tax Collected at Source rates and applicability rules.",
      visible: canConfigureCompliance,
      node: <TcsConfigPanel canConfigureCompliance={canConfigureCompliance} />,
    },
    {
      id: "vendor-msme",
      label: "Vendor MSME",
      icon: "store",
      summary: "MSME vendors and 45-day payment-window enforcement.",
      visible: canConfigureCompliance,
      node: <VendorMsmeSection />,
    },
    {
      id: "notifications",
      label: "Notification preferences",
      icon: "notifications",
      summary: "Per-event channel routing for the firm.",
      visible: canManageConnections,
      node: <NotificationPreferencesSection tenantUsers={tenantUsers} />,
    },
    {
      id: "users",
      label: "Team & access",
      icon: "groups",
      summary: teammateCount === 0
        ? "Invite teammates to collaborate on invoice processing."
        : `${teammateCount} teammate${teammateCount === 1 ? "" : "s"} · ${TENANT_ROLE_OPTIONS.length} roles`,
      visible: canManageUsers,
      node: (
        <div className="editor-card tenant-config-users-card">
          <div className="invite-row">
            <label className="invite-label">
              Invite by email
              <input
                value={inviteEmail}
                onChange={(event) => onInviteEmailChange(event.target.value)}
                placeholder="user@example.com"
              />
            </label>
            <button
              type="button"
              className="invite-send-button"
              onClick={onInviteUser}
              disabled={!inviteEmail.trim()}
            >
              Send Invite
            </button>
          </div>
          {teammateCount === 0 ? (
            <EmptyState icon="group" heading="No team members yet" description="Invite users by email to collaborate on invoice processing." />
          ) : (
            <div className="list-scroll tenant-config-users-scroll">
              <table className="lbtable">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantUsers.filter((user) => user.userId !== currentUserId).map((user) => (
                    <tr key={user.userId}>
                      <td>{user.email}</td>
                      <td>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={user.enabled} onChange={() => onToggleUserEnabled(user.userId, !user.enabled)} />
                          <span className="toggle-track" />
                        </label>
                      </td>
                      <td>
                        <select
                          value={user.role}
                          onChange={(event) => onRoleChange(user.userId, event.target.value as TenantRole)}
                          className="input"
                        >
                          {TENANT_ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="app-button app-button-secondary" onClick={() => onRemoveUser(user.userId)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    },
  ], [
    canConfigureWorkflow,
    canConfigureGlCodes,
    canConfigureCompliance,
    canManageConnections,
    canManageUsers,
    capabilities.canApproveInvoices,
    currentUserId,
    currentUserRole,
    inviteEmail,
    onInviteEmailChange,
    onInviteUser,
    onRemoveUser,
    onRoleChange,
    onToggleUserEnabled,
    teammateCount,
    tenantUsers,
  ]);

  const visibleSections = useMemo(() => sections.filter((s) => s.visible), [sections]);
  const totalCount = visibleSections.length;
  const configuredCount = totalCount;

  const [openMap, setOpenMap] = useState<Partial<Record<ConfigSectionId, boolean>>>(() => readAccordionState());
  useEffect(() => {
    writeAccordionState(openMap);
  }, [openMap]);

  const isOpen = useCallback((id: ConfigSectionId) => openMap[id] === true, [openMap]);
  const toggle = useCallback(
    (id: ConfigSectionId) => setOpenMap((prev) => ({ ...prev, [id]: !prev[id] })),
    []
  );

  return (
    <div className="tenant-config-shell">
      {gmailNeedsReauth && canManageConnections ? (
        <div className="mailbox-banner" role="alert">
          <strong>We lost access to your mailbox. Please reconnect.</strong>
          <button type="button" className="app-button app-button-primary" onClick={onConnectGmail}>
            Reconnect Gmail
          </button>
        </div>
      ) : null}

      <div className="page-header tenant-config-page-header">
        <h1>Configuration</h1>
        <span className="count">Firm setup · progressive</span>
        <div className="page-tools">
          <span className="tenant-config-progress-count">
            {configuredCount} / {totalCount} configured
          </span>
        </div>
      </div>

      <div className="tenant-config-progress-hero">
        <div className="tenant-config-progress-row">
          <div className="tenant-config-progress-title">Setup readiness</div>
          <div className="tenant-config-progress-pct">{totalCount === 0 ? "0%" : "100%"}</div>
        </div>
        <div className="tenant-config-progress-track">
          <div className="tenant-config-progress-fill" />
        </div>
        <div className="tenant-config-progress-caption">
          You can start using LedgerBuddy as soon as a single client org has a mailbox + Tally company mapped. Other settings expand as you need them.
        </div>
      </div>

      <div className="tenant-config-accordion">
        {visibleSections.map((section) => {
          const open = isOpen(section.id);
          return (
            <div
              key={section.id}
              className={"tenant-config-section" + (open ? " is-open" : "")}
              data-section-id={section.id}
            >
              <button
                type="button"
                className="tenant-config-section-head"
                aria-expanded={open}
                aria-controls={`tenant-config-section-body-${section.id}`}
                onClick={() => toggle(section.id)}
              >
                <span className="tenant-config-section-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">{section.icon}</span>
                </span>
                <span className="tenant-config-section-title-block">
                  <span className="tenant-config-section-label">{section.label}</span>
                  <span className="tenant-config-section-summary">{section.summary}</span>
                </span>
                <span
                  className="material-symbols-outlined tenant-config-section-chevron"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </button>
              {open ? (
                <div
                  className="tenant-config-section-body"
                  id={`tenant-config-section-body-${section.id}`}
                >
                  {section.node}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* reserved by W3-15 / R8 for post-MVP SSO (#385) and 2FA (#386) cards */}
      <div className="tenant-config-security-slot" data-testid="tenant-config-security-slot" />
    </div>
  );
}

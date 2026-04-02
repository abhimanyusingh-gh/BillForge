import type { GmailConnectionStatus } from "../../types";
import { TENANT_ROLE_OPTIONS, type TenantRole, type UserCapabilities } from "../../types";
import { ApprovalWorkflowSection } from "./ApprovalWorkflowSection";
import { GlCodeManager } from "./GlCodeManager";
import { EmptyState } from "../EmptyState";
import { TcsConfigPanel } from "./TcsConfigPanel";

interface TenantConfigTabProps {
  currentUserId: string;
  capabilities: UserCapabilities;
  gmailConnection: GmailConnectionStatus | null;
  onConnectGmail: () => void;
  inviteEmail: string;
  onInviteEmailChange: (email: string) => void;
  onInviteUser: () => void;
  tenantUsers: Array<{ userId: string; email: string; role: TenantRole; enabled: boolean }>;
  onRoleChange: (userId: string, role: TenantRole) => void;
  onToggleUserEnabled: (userId: string, enabled: boolean) => void;
  onRemoveUser: (userId: string) => void;
}

export function TenantConfigTab({
  currentUserId,
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

  return (
    <>
      {gmailNeedsReauth && canManageConnections ? (
        <div className="mailbox-banner" role="alert">
          <strong>We lost access to your mailbox. Please reconnect.</strong>
          <button type="button" className="app-button app-button-primary" onClick={onConnectGmail}>
            Reconnect Gmail
          </button>
        </div>
      ) : null}

      {canConfigureWorkflow ? <ApprovalWorkflowSection tenantUsers={tenantUsers} /> : null}

      {canConfigureGlCodes ? (
        <div className="editor-card" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem" }}>Chart of Accounts (GL Codes)</h3>
          <GlCodeManager />
        </div>
      ) : null}

      {canConfigureCompliance ? (
        <div className="editor-card" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem" }}>Compliance Settings</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft, #666)" }}>
            Enable compliance features (TDS calculation, PAN validation, risk signals) from the compliance configuration panel.
            GL codes and cost centers configured above will be used for automated suggestions.
          </p>
        </div>
      ) : null}

      <TcsConfigPanel canConfigureCompliance={canConfigureCompliance} />

      {canManageUsers ? (
        <div className="editor-card">
          <div className="editor-header">
            <h3>Users</h3>
          </div>
          <div className="invite-row" style={{ marginTop: "0.5rem" }}>
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
          {tenantUsers.filter((u) => u.userId !== currentUserId).length === 0 ? (
            <EmptyState icon="group" heading="No team members yet" description="Invite users by email to collaborate on invoice processing." />
          ) : (
            <div className="list-scroll" style={{ maxHeight: "200px", marginTop: "0.75rem" }}>
              <table>
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
                          style={{ minWidth: "220px" }}
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
      ) : null}
    </>
  );
}

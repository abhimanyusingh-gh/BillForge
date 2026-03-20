import type { GmailConnectionStatus } from "../../types";

interface TenantConfigTabProps {
  gmailConnection: GmailConnectionStatus | null;
  onConnectGmail: () => void;
  inviteEmail: string;
  onInviteEmailChange: (email: string) => void;
  onInviteUser: () => void;
  tenantUsers: Array<{ userId: string; email: string; role: "TENANT_ADMIN" | "MEMBER"; enabled: boolean }>;
  onRoleChange: (userId: string, role: "TENANT_ADMIN" | "MEMBER") => void;
  onToggleUserEnabled: (userId: string, enabled: boolean) => void;
  onRemoveUser: (userId: string) => void;
}

export function TenantConfigTab({
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
  const gmailConnected = gmailConnectionState === "CONNECTED";
  const gmailEmailAddress = gmailConnection?.emailAddress ?? "";

  return (
    <>
      {gmailNeedsReauth ? (
        <div className="mailbox-banner" role="alert">
          <strong>We lost access to your mailbox. Please reconnect.</strong>
          <button type="button" className="app-button app-button-primary" onClick={onConnectGmail}>
            Reconnect Gmail
          </button>
        </div>
      ) : null}

      <div className="mailbox-connection-card">
        <span
          className={gmailConnected ? "mailbox-state mailbox-state-connected" : "mailbox-state mailbox-state-idle"}
        >
          {gmailConnected ? "Mailbox Connected" : "Mailbox Not Connected"}
        </span>
        {gmailConnected && gmailEmailAddress ? <span className="mailbox-email">{gmailEmailAddress}</span> : null}
        {!gmailConnected ? (
          <button type="button" className="app-button app-button-secondary" onClick={onConnectGmail}>
            {gmailNeedsReauth ? "Reconnect Gmail" : "Connect Gmail"}
          </button>
        ) : null}
      </div>

      <div className="editor-card">
        <div className="editor-header">
          <h3>Tenant Settings</h3>
        </div>
        <div className="invite-row">
          <label className="invite-label">
            Invite User Email
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
        <div className="list-scroll" style={{ maxHeight: "160px" }}>
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
              {tenantUsers.map((user) => (
                <tr key={user.userId}>
                  <td>{user.email}</td>
                  <td>
                    <button
                      type="button"
                      className={`app-button ${user.enabled ? "app-button-secondary" : "app-button-danger"}`}
                      style={{ fontSize: 12, padding: "2px 10px", minWidth: 72 }}
                      onClick={() => onToggleUserEnabled(user.userId, !user.enabled)}
                    >
                      {user.enabled ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(event) =>
                        onRoleChange(user.userId, event.target.value as "TENANT_ADMIN" | "MEMBER")
                      }
                    >
                      <option value="TENANT_ADMIN">Tenant Admin</option>
                      <option value="MEMBER">Member</option>
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
      </div>
    </>
  );
}

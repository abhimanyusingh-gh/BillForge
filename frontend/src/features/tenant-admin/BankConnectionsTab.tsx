import { useState, type ReactNode } from "react";
import type { BankAccount, TenantMailbox, TenantUser } from "@/types";
import { EmptyState } from "@/components/common/EmptyState";
import { useReorderableSections } from "@/hooks/useReorderableSections";

const CONNECTIONS_SECTION_IDS = ["gmail", "bank-accounts"] as const;
const STORAGE_KEY = "ledgerbuddy:connections-section-order";

interface BankConnectionsTabProps {
  mailboxes: TenantMailbox[];
  tenantUsers: TenantUser[];
  onAddGmailInbox: () => void;
  onAssignMailboxUser: (integrationId: string, userId: string) => void;
  onRemoveMailboxAssignment: (integrationId: string, userId: string) => void;
  onRemoveMailbox: (integrationId: string) => void;
  bankAccounts: BankAccount[];
  onAddBankAccount: (aaAddress: string, displayName: string) => void;
  onRefreshBankBalance: (id: string) => void;
  onRevokeBankAccount: (id: string) => void;
}

function fmtInr(minor: number): string {
  return (minor / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function BankStatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bank-status-badge bank-status-active"
      : status === "pending_consent"
        ? "bank-status-badge bank-status-pending"
        : "bank-status-badge bank-status-error";
  return <span className={cls}>{status.replace("_", " ")}</span>;
}

export function BankConnectionsTab({
  mailboxes,
  tenantUsers,
  onAddGmailInbox,
  onAssignMailboxUser,
  onRemoveMailboxAssignment,
  onRemoveMailbox,
  bankAccounts,
  onAddBankAccount,
  onRefreshBankBalance,
  onRevokeBankAccount
}: BankConnectionsTabProps) {
  const [aaAddress, setAaAddress] = useState("");
  const [displayName, setDisplayName] = useState("");

  const { order, dragHandlers, dragOverId, draggingId } = useReorderableSections(
    STORAGE_KEY,
    [...CONNECTIONS_SECTION_IDS]
  );

  function handleAddBank() {
    if (!aaAddress.trim()) return;
    onAddBankAccount(aaAddress.trim(), displayName.trim());
    setAaAddress("");
    setDisplayName("");
  }

  const sectionMap: Record<string, ReactNode> = {
    gmail: (
      <div className="editor-card">
        <div className="editor-header">
          <h3>Email Inboxes</h3>
          <button type="button" className="app-button app-button-secondary app-button-sm" onClick={onAddGmailInbox}>
            <span className="material-symbols-outlined connections-icon-inline">add</span>
            Add Gmail inbox
          </button>
        </div>
        {mailboxes.length === 0 ? (
          <EmptyState icon="mail" heading="No inboxes connected" description="Connect a Gmail inbox to automatically receive and process invoices." />
        ) : (
          <div className="connections-mailbox-list">
            {mailboxes.map((mailbox) => (
              <div key={mailbox._id} className="connections-mailbox-card">
                <div className="connections-mailbox-row">
                  <span className="material-symbols-outlined connections-mailbox-icon">mail</span>
                  <span className="connections-mailbox-email">{mailbox.emailAddress ?? "(unknown)"}</span>
                  <span className={`bank-status-badge ${mailbox.status === "connected" ? "bank-status-active" : "bank-status-error"}`}>
                    {mailbox.status}
                  </span>
                  {mailbox.lastSyncedAt ? (
                    <span className="connections-mailbox-meta">
                      Last synced: {new Date(mailbox.lastSyncedAt).toLocaleString()}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="app-button app-button-danger app-button-sm connections-mailbox-remove"
                    onClick={() => onRemoveMailbox(mailbox._id)}
                  >
                    Remove inbox
                  </button>
                </div>
                <div className="connections-mailbox-assignments">
                  <span className="connections-mailbox-meta">
                    Assigned to:{" "}
                    {mailbox.assignments === "all" ? (
                      <strong>All users</strong>
                    ) : mailbox.assignments.length === 0 ? (
                      <em>No one</em>
                    ) : (
                      mailbox.assignments.map((a) => (
                        <span key={a.userId} className="connections-assignment-pill">
                          {a.email}
                          <button
                            type="button"
                            className="connections-assignment-remove"
                            onClick={() => onRemoveMailboxAssignment(mailbox._id, a.userId)}
                            aria-label={`Remove ${a.email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </span>
                  {mailbox.assignments !== "all" && (
                    <select
                      className="connections-assignment-add"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) onAssignMailboxUser(mailbox._id, e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>Add user…</option>
                      {tenantUsers
                        .filter((u) => {
                          const assigned = mailbox.assignments as Array<{ userId: string }>;
                          return !assigned.some((a) => a.userId === u.userId);
                        })
                        .map((u) => (
                          <option key={u.userId} value={u.userId}>{u.email}</option>
                        ))}
                    </select>
                  )}
                  {mailbox.assignments === "all" && (
                    <button
                      type="button"
                      className="app-button app-button-secondary app-button-sm"
                      onClick={() => onRemoveMailboxAssignment(mailbox._id, "all")}
                    >
                      Restrict to specific users
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    "bank-accounts": (
      <div className="editor-card">
        <div className="editor-header">
          <h3>Bank Accounts</h3>
        </div>
        <div className="connections-bank-form">
          <input
            value={aaAddress}
            onChange={(e) => setAaAddress(e.target.value)}
            placeholder="AA address (e.g. user@bankaa)"
            className="connections-bank-input connections-bank-input-aa"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional)"
            className="connections-bank-input connections-bank-input-name"
          />
          <button
            type="button"
            className="app-button app-button-secondary app-button-sm"
            disabled={!aaAddress.trim()}
            onClick={handleAddBank}
          >
            Add bank account
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <EmptyState icon="account_balance" heading="No bank accounts connected" description="Link a bank account via Account Aggregator to view balances." />
        ) : (
          <div className="connections-bank-list">
            {bankAccounts.map((account) => (
              <div key={account._id} className="bank-account-card">
                <span className="connections-bank-icon">
                  <span className="material-symbols-outlined">account_balance</span>
                </span>
                <div className="connections-bank-body">
                  <div className="connections-bank-headline">
                    <span className="connections-bank-name">{account.displayName ?? account.aaAddress}</span>
                    {account.bankName ? <span className="bank-account-meta">{account.bankName}</span> : null}
                    {account.maskedAccNumber ? <span className="bank-account-meta">{account.maskedAccNumber}</span> : null}
                    <BankStatusBadge status={account.status} />
                  </div>
                  {account.balanceMinor != null ? (
                    <div className="connections-bank-balance-row">
                      <span className="bank-account-balance">{fmtInr(account.balanceMinor)}</span>
                      {account.balanceFetchedAt ? (
                        <span className="bank-account-meta connections-bank-asof">
                          as of {new Date(account.balanceFetchedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {account.lastErrorReason ? (
                    <div className="connections-bank-error">{account.lastErrorReason}</div>
                  ) : null}
                </div>
                <div className="connections-bank-actions">
                  <button
                    type="button"
                    className="app-button app-button-secondary app-button-sm"
                    onClick={() => onRefreshBankBalance(account._id)}
                    disabled={account.status !== "active"}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="app-button app-button-danger app-button-sm"
                    onClick={() => onRevokeBankAccount(account._id)}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  };

  return (
    <div className="bank-connections">
      {order.map((sectionId) => {
        const node = sectionMap[sectionId];
        if (!node) return null;
        const handlers = dragHandlers(sectionId);
        return (
          <div
            key={sectionId}
            className={
              "reorderable-section" +
              (draggingId === sectionId ? " section-dragging" : "") +
              (dragOverId === sectionId ? " section-drag-over" : "")
            }
            {...handlers}
          >
            <span className="section-drag-handle material-symbols-outlined" aria-label="Drag to reorder">drag_indicator</span>
            {node}
          </div>
        );
      })}
    </div>
  );
}

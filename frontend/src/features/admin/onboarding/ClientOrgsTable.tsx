import { useMemo } from "react";
import type { ClientOrganization } from "@/api/clientOrgs";

const TALLY_TONE = {
  ok: "ok",
  warn: "warn",
  fail: "fail"
} as const;

type TallyTone = (typeof TALLY_TONE)[keyof typeof TALLY_TONE];

interface ClientOrgsTableProps {
  items: ClientOrganization[];
  searchTerm: string;
  activeClientOrgId: string | null;
  onEdit: (clientOrg: ClientOrganization) => void;
  onArchive: (clientOrg: ClientOrganization) => void;
  onSelect: (clientOrg: ClientOrganization) => void;
}

function matchesSearch(item: ClientOrganization, term: string): boolean {
  if (term.length === 0) return true;
  const haystack = `${item.companyName} ${item.gstin}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

function tallyTone(verified: boolean): TallyTone {
  return verified ? TALLY_TONE.ok : TALLY_TONE.warn;
}

function tallyLabel(tone: TallyTone): string {
  if (tone === TALLY_TONE.ok) return "Tally · synced";
  if (tone === TALLY_TONE.warn) return "Tally · pending F12 verification";
  return "Tally · auth failed";
}

function statusLabel(verified: boolean, isOnboarding: boolean): string {
  if (isOnboarding) return "ONBOARDING";
  return verified ? "ACTIVE" : "INCOMPLETE";
}

function statusSpillClass(verified: boolean, isOnboarding: boolean): string {
  if (isOnboarding) return "spill s-parsed";
  return verified ? "spill s-approved" : "spill s-needs_review";
}

export function ClientOrgsTable({
  items,
  searchTerm,
  activeClientOrgId,
  onEdit,
  onArchive,
  onSelect
}: ClientOrgsTableProps) {
  const visible = useMemo(() => {
    return items
      .filter((item) => matchesSearch(item, searchTerm))
      .slice()
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [items, searchTerm]);

  if (visible.length === 0) {
    return (
      <div className="client-orgs-r10-state" data-testid="client-orgs-table-empty-search">
        <p>No client organizations match &ldquo;{searchTerm}&rdquo;.</p>
      </div>
    );
  }

  return (
    <div
      className="client-orgs-r10-cards"
      data-testid="client-orgs-table"
      role="list"
      aria-label="Client organizations"
    >
      {visible.map((item) => {
        const isActive = item._id === activeClientOrgId;
        const isOnboarding = !item.f12OverwriteByGuidVerified;
        const tone = tallyTone(item.f12OverwriteByGuidVerified);
        const gstinMissing = !item.gstin || item.gstin === "—";
        return (
          <div
            key={item._id}
            className="client-orgs-r10-card"
            data-testid="client-orgs-table-row"
            data-active={isActive ? "true" : undefined}
          >
            <div className="client-orgs-r10-card-head">
              <span className="client-orgs-r10-card-avatar" aria-hidden="true">
                {initials(item.companyName)}
              </span>
              <div className="client-orgs-r10-card-title">
                <div className="client-orgs-r10-card-name">{item.companyName}</div>
                <div
                  className="client-orgs-r10-card-gstin mono-cell"
                  data-missing={gstinMissing ? "true" : undefined}
                >
                  {item.gstin || "—"}
                </div>
              </div>
              <span
                className={statusSpillClass(item.f12OverwriteByGuidVerified, isOnboarding)}
                aria-label={statusLabel(item.f12OverwriteByGuidVerified, isOnboarding)}
              >
                <span className="dot" />
                {statusLabel(item.f12OverwriteByGuidVerified, isOnboarding)}
              </span>
            </div>

            <div className="client-orgs-r10-card-kpis">
              <div className="client-orgs-r10-kpi">
                <div className="client-orgs-r10-kpi-label">State</div>
                <div className="client-orgs-r10-kpi-value">
                  {item.stateName ?? "—"}
                </div>
              </div>
              <div className="client-orgs-r10-kpi">
                <div className="client-orgs-r10-kpi-label">F12</div>
                <div
                  className="client-orgs-r10-kpi-value"
                  data-tone={item.f12OverwriteByGuidVerified ? undefined : "warn"}
                >
                  {item.f12OverwriteByGuidVerified ? "Verified" : "Pending"}
                </div>
              </div>
              <div className="client-orgs-r10-kpi">
                <div className="client-orgs-r10-kpi-label">Detected</div>
                <div className="client-orgs-r10-kpi-value">
                  {item.detectedVersion ?? "—"}
                </div>
              </div>
            </div>

            <div className="client-orgs-r10-card-foot">
              <span>
                <span
                  aria-hidden="true"
                  data-tone={tone}
                />
                {tallyLabel(tone)}
              </span>
              <div className="client-orgs-r10-card-actions">
                {isActive ? (
                  <span data-active-target="true">Active</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    data-testid="client-orgs-table-select"
                  >
                    Select
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  data-testid="client-orgs-table-edit"
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-destructive="true"
                  onClick={() => onArchive(item)}
                  data-testid="client-orgs-table-archive"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

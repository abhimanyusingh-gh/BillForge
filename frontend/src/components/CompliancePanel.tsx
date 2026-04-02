import { type Invoice, type GlCode, type TdsRate } from "../types";
import { minorUnitsToMajorString } from "../currency";

interface CompliancePanelProps {
  invoice: Invoice;
  glCodes: GlCode[];
  tdsRates: TdsRate[];
  canOverrideGlCode?: boolean;
  canOverrideTds?: boolean;
  onOverrideGlCode: (glCode: string) => void;
  onOverrideTdsSection: (section: string) => void;
  isReadOnly: boolean;
}

export function CompliancePanel({
  invoice,
  glCodes,
  tdsRates,
  canOverrideGlCode = false,
  canOverrideTds = false,
  onOverrideGlCode,
  onOverrideTdsSection,
  isReadOnly
}: CompliancePanelProps) {
  const compliance = invoice.compliance;
  if (!compliance) return null;

  const hasTds = compliance.tds?.section;
  const hasGl = compliance.glCode?.code;
  const hasPan = compliance.pan?.value;
  const hasReconciliation = compliance.reconciliation != null;

  if (!hasTds && !hasGl && !hasPan && !hasReconciliation) return null;

  const currency = invoice.parsed?.currency ?? "INR";
  const tdsReadOnly = isReadOnly || !canOverrideTds;
  const glReadOnly = isReadOnly || !canOverrideGlCode;

  return (
    <div className="compliance-panel" style={{ borderTop: "1px solid var(--border-color, #e0e0e0)", padding: "0.75rem 0" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, #666)" }}>
        Compliance
      </div>

      {compliance.tds && compliance.tds.section && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
          <span style={{ fontWeight: 500 }}>TDS:</span>
          {tdsReadOnly ? (
            <span>{compliance.tds.section} @ {(compliance.tds.rate ?? 0) / 100}%</span>
          ) : (
            <select
              value={compliance.tds.section}
              onChange={(e) => onOverrideTdsSection(e.target.value)}
              style={{ fontSize: "0.85rem", padding: "0.15rem 0.25rem" }}
            >
              {tdsRates.map((r) => (
                <option key={r.section} value={r.section}>
                  {r.section} — {r.description}
                </option>
              ))}
            </select>
          )}
          {compliance.tds.amountMinor != null && compliance.tds.amountMinor > 0 && (
            <span style={{ color: "var(--text-secondary, #666)" }}>
              = {minorUnitsToMajorString(compliance.tds.amountMinor, currency)}
            </span>
          )}
        </div>
      )}

      {compliance.glCode && compliance.glCode.code && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
          <span style={{ fontWeight: 500 }}>GL:</span>
          {glReadOnly ? (
            <span>{compliance.glCode.name} ({compliance.glCode.code})</span>
          ) : (
            <select
              value={compliance.glCode.code}
              onChange={(e) => onOverrideGlCode(e.target.value)}
              style={{ fontSize: "0.85rem", padding: "0.15rem 0.25rem" }}
            >
              {glCodes.filter((g) => g.isActive).map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          )}
          {compliance.glCode.confidence != null && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary, #999)" }}>
              {compliance.glCode.confidence}% — {compliance.glCode.source}
            </span>
          )}
        </div>
      )}

      {compliance.pan && compliance.pan.value && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
          <span style={{ fontWeight: 500 }}>PAN:</span>
          <span>{compliance.pan.value}</span>
          {compliance.pan.validationResult === "valid" && (
            <span style={{ color: "var(--color-success, #22c55e)" }} title={compliance.pan.gstinCrossRef ? "Matches GSTIN" : "Format valid"}>
              {compliance.pan.gstinCrossRef ? "L2" : "L1"}
            </span>
          )}
          {compliance.pan.validationResult === "format-invalid" && (
            <span style={{ color: "var(--color-warning, #f59e0b)" }} title="PAN format invalid">invalid</span>
          )}
          {compliance.pan.validationResult === "gstin-mismatch" && (
            <span style={{ color: "var(--color-warning, #f59e0b)" }} title="PAN does not match GSTIN">mismatch</span>
          )}
        </div>
      )}

      {compliance.tds?.netPayableMinor != null && compliance.tds.netPayableMinor > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 500 }}>
          <span>Net Payable:</span>
          <span>{minorUnitsToMajorString(compliance.tds.netPayableMinor, currency)}</span>
        </div>
      )}

      {hasReconciliation && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem", fontSize: "0.85rem" }}>
          <span style={{ fontWeight: 500 }}>Bank Payment:</span>
          {compliance.reconciliation?.verifiedByStatement ? (
            <>
              <span style={{ color: "var(--color-success, #166534)", fontWeight: 600 }}>Verified</span>
              {compliance.reconciliation.matchedAt ? (
                <span style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
                  {new Date(compliance.reconciliation.matchedAt).toLocaleString()}
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>Not yet reconciled</span>
          )}
        </div>
      )}
    </div>
  );
}

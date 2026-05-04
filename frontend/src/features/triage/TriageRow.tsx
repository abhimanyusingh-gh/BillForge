import type { TriageInvoice } from "@/api/triage";
import { formatMinorAmountWithCurrency } from "@/lib/common/currency";

interface TriageRowProps {
  invoice: TriageInvoice;
  selected: boolean;
  onToggleSelected: () => void;
  onAssign: () => void;
  onReject: () => void;
  isMutating: boolean;
}

function formatReceivedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function valueOrPlaceholder(value: string | null | undefined): string {
  if (typeof value !== "string") return "—";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

export function TriageRow({
  invoice,
  selected,
  onToggleSelected,
  onAssign,
  onReject,
  isMutating
}: TriageRowProps) {
  return (
    <tr
      className={selected ? "triage-row triage-row-selected" : "triage-row"}
      data-testid={`triage-row-${invoice._id}`}
      data-mutating={isMutating ? "true" : undefined}
    >
      <td className="triage-cell-select">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select invoice ${valueOrPlaceholder(invoice.invoiceNumber)}`}
          data-testid={`triage-row-checkbox-${invoice._id}`}
          disabled={isMutating}
        />
      </td>
      <td className="mono-cell">{valueOrPlaceholder(invoice.invoiceNumber)}</td>
      <td>
        <div className="triage-cell-stacked">
          <span className="triage-cell-primary">{valueOrPlaceholder(invoice.vendorName)}</span>
          <span className="triage-cell-secondary lb-mono">
            {valueOrPlaceholder(invoice.vendorGstin)}
          </span>
        </div>
      </td>
      <td>
        <div className="triage-cell-stacked">
          <span className="triage-cell-primary">{valueOrPlaceholder(invoice.customerName)}</span>
          <span className="triage-cell-secondary lb-mono">
            {valueOrPlaceholder(invoice.customerGstin)}
          </span>
        </div>
      </td>
      <td className="num-cell">
        {invoice.totalAmountMinor === null
          ? "—"
          : formatMinorAmountWithCurrency(invoice.totalAmountMinor, invoice.currency ?? undefined)}
      </td>
      <td className="mono-cell">{valueOrPlaceholder(invoice.sourceMailbox)}</td>
      <td className="mono-cell">{formatReceivedAt(invoice.receivedAt)}</td>
      <td className="triage-cell-actions">
        <div className="triage-row-actions">
          <button
            type="button"
            className="app-button app-button-primary app-button-sm"
            onClick={onAssign}
            disabled={isMutating}
            data-testid={`triage-row-assign-${invoice._id}`}
          >
            Assign
          </button>
          <button
            type="button"
            className="app-button app-button-secondary app-button-sm"
            onClick={onReject}
            disabled={isMutating}
            data-testid={`triage-row-reject-${invoice._id}`}
          >
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}

import { useMemo, useState } from "react";
import {
  asInvoiceId,
  type Invoice,
  type InvoiceId
} from "@/domain/invoice/invoice";
import { invoiceService } from "@/api/invoiceService";
import { useInvoice } from "@/features/invoices/detail/useInvoice";
import { InvoiceFieldsPanel } from "@/features/invoices/detail/InvoiceFieldsPanel";
import { useApproveInvoices } from "@/features/invoices/actions/useApproveInvoices";
import { useRejectInvoice } from "@/features/invoices/actions/useRejectInvoice";
import { formatDate, INVOICE_STATUS_LABEL } from "@/features/invoices/format";
import { useSessionStore } from "@/state/sessionStore";

interface InvoiceDetailPageProps {
  invoiceIdRaw: string;
}

function navigateBack(): void {
  if (typeof window === "undefined") return;
  window.location.hash = "#/invoices";
}

export function InvoiceDetailPage({ invoiceIdRaw }: InvoiceDetailPageProps) {
  const invoiceId: InvoiceId = useMemo(() => asInvoiceId(invoiceIdRaw), [invoiceIdRaw]);
  const { invoice, isLoading, error, reload } = useInvoice(invoiceId);

  if (isLoading && invoice === null) {
    return (
      <section className="invoice-detail-page" aria-label="Invoice detail">
        <p>Loading invoice…</p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="invoice-detail-page" aria-label="Invoice detail">
        <header className="invoice-detail-breadcrumb">
          <button type="button" onClick={navigateBack}>← Back to invoices</button>
        </header>
        <div role="alert" className="invoice-list-error">{error}</div>
      </section>
    );
  }

  if (invoice === null) {
    return (
      <section className="invoice-detail-page" aria-label="Invoice detail">
        <header className="invoice-detail-breadcrumb">
          <button type="button" onClick={navigateBack}>← Back to invoices</button>
        </header>
        <p>Invoice not found.</p>
      </section>
    );
  }

  return <InvoiceDetailContent invoice={invoice} reload={reload} />;
}

interface InvoiceDetailContentProps {
  invoice: Invoice;
  reload: () => void;
}

function InvoiceDetailContent({ invoice, reload }: InvoiceDetailContentProps) {
  const tenantId = useSessionStore((state) => state.tenant?.id ?? null);
  const clientOrgId = useSessionStore((state) => state.currentClientOrgId);
  const approve = useApproveInvoices(reload);
  const reject = useRejectInvoice(reload);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [showReject, setShowReject] = useState<boolean>(false);

  const previewSrc = useMemo(() => {
    if (tenantId === null || clientOrgId === null) return null;
    return invoiceService.previewUrl(tenantId, clientOrgId, invoice.id);
  }, [tenantId, clientOrgId, invoice.id]);

  const onApprove = async () => {
    await approve.workflowApprove(invoice.id);
  };

  const onReject = async () => {
    if (!showReject) {
      setShowReject(true);
      return;
    }
    const ok = await reject.reject(invoice.id, rejectReason);
    if (ok) {
      setRejectReason("");
      setShowReject(false);
    }
  };

  return (
    <section className="invoice-detail-page" aria-label="Invoice detail">
      <header className="invoice-detail-breadcrumb">
        <button type="button" onClick={navigateBack} className="invoice-detail-back">
          <span className="material-symbols-outlined">arrow_back</span> Back
        </button>
        <span className="invoice-detail-trail">
          <button type="button" onClick={navigateBack} className="invoice-detail-trail-link">
            Invoices
          </button>
          <span className="invoice-detail-trail-sep">›</span>
          <span className="lb-mono">{invoice.invoiceNumber}</span>
          <span className="invoice-detail-trail-sep">·</span>
          <span>{invoice.vendor}</span>
        </span>
      </header>

      <div className="invoice-detail-actions">
        <span className={`spill s-${invoice.status}`}>
          <span className="dot" />
          {INVOICE_STATUS_LABEL[invoice.status].toUpperCase()}
        </span>
        <button
          type="button"
          className="btn-secondary"
          onClick={onReject}
          disabled={reject.isRejecting}
        >
          {reject.isRejecting ? "Rejecting…" : showReject ? "Confirm reject" : "Reject"}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onApprove}
          disabled={approve.isApproving}
        >
          {approve.isApproving ? "Approving…" : "Approve"}
        </button>
      </div>

      {showReject ? (
        <div className="invoice-detail-reject">
          <label htmlFor="reject-reason">Rejection reason</label>
          <input
            id="reject-reason"
            type="text"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain why this invoice is being rejected"
          />
          {reject.error ? <span className="invoice-field-error">{reject.error}</span> : null}
        </div>
      ) : null}

      <div className="invoice-detail-split">
        <div className="invoice-detail-source">
          <header className="invoice-section-header">
            <h3>Source document</h3>
          </header>
          {previewSrc ? (
            <iframe
              title={`Source for invoice ${invoice.invoiceNumber}`}
              src={previewSrc}
              className="invoice-detail-source-frame"
            />
          ) : (
            <p>Preview unavailable.</p>
          )}
        </div>

        <div className="invoice-detail-meta">
          <InvoiceFieldsPanel invoice={invoice} onSaved={reload} />

          <section className="invoice-risk-panel" aria-label="Risk signals">
            <header className="invoice-section-header">
              <h3>Risk signals</h3>
              <span className="lb-caption">{invoice.riskSignals.length} signal(s)</span>
            </header>
            {invoice.riskSignals.length === 0 ? (
              <p className="invoice-empty-line">No active risk signals.</p>
            ) : (
              <ul className="invoice-risk-list">
                {invoice.riskSignals.map((signal) => (
                  <li key={`${signal.code}-${signal.status}`} className={`risk-row ${signal.severity}`}>
                    <span className="risk-code">{signal.code}</span>
                    <span className="risk-msg">{signal.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="invoice-timeline-panel" aria-label="Approval timeline">
            <header className="invoice-section-header">
              <h3>Workflow</h3>
              {invoice.workflowStep !== null && invoice.workflowTotalSteps !== null ? (
                <span className="lb-caption">
                  Step {invoice.workflowStep} of {invoice.workflowTotalSteps}
                </span>
              ) : null}
            </header>
            {invoice.timeline.length === 0 ? (
              <p className="invoice-empty-line">No timeline entries yet.</p>
            ) : (
              <ol className="invoice-timeline-list">
                {invoice.timeline.map((entry, index) => (
                  <li key={`${entry.step}-${index}`} className={`tl-step ${entry.state}`}>
                    <strong>{entry.step}</strong>
                    {entry.actor ? <span> · {entry.actor}</span> : null}
                    <span className="ts">{formatDate(entry.occurredAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="invoice-compliance-panel" aria-label="Compliance">
            <header className="invoice-section-header">
              <h3>Compliance</h3>
            </header>
            <dl className="invoice-compliance-grid">
              <dt>GL code</dt>
              <dd className="mono-cell">{invoice.parsed.glCode ?? "—"}</dd>
              <dt>GL name</dt>
              <dd>{invoice.parsed.glName ?? "—"}</dd>
              <dt>TDS section</dt>
              <dd className="mono-cell">{invoice.parsed.tdsSection ?? "—"}</dd>
              <dt>Cost center</dt>
              <dd>{invoice.parsed.costCenter ?? "—"}</dd>
            </dl>
          </section>
        </div>
      </div>
    </section>
  );
}

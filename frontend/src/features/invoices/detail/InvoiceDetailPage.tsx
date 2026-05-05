import { useMemo, useState } from "react";
import {
  asInvoiceId,
  type Invoice,
  type InvoiceId
} from "@/domain/invoice/invoice";
import { useInvoice } from "@/features/invoices/detail/useInvoice";
import { InvoiceFieldsPanel } from "@/features/invoices/detail/InvoiceFieldsPanel";
import { useApproveInvoices } from "@/features/invoices/actions/useApproveInvoices";
import { useRejectInvoice } from "@/features/invoices/actions/useRejectInvoice";
import { formatDate, INVOICE_STATUS_LABEL } from "@/features/invoices/format";

interface InvoiceDetailPageProps {
  invoiceIdRaw: string;
}

function navigateBack(): void {
  if (typeof window === "undefined") return;
  window.location.hash = "#/invoices";
}

export function InvoiceDetailPage({ invoiceIdRaw }: InvoiceDetailPageProps) {
  const invoiceId: InvoiceId = useMemo(() => asInvoiceId(invoiceIdRaw), [invoiceIdRaw]);
  const { invoice, isLoading, error, reload, previewUrl } = useInvoice(invoiceId);

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
          <button type="button" className="invoice-detail-back" onClick={navigateBack}>
            <span className="material-symbols-outlined">arrow_back</span> Back
          </button>
        </header>
        <div role="alert" className="invoice-list-error">{error}</div>
      </section>
    );
  }

  if (invoice === null) {
    return (
      <section className="invoice-detail-page" aria-label="Invoice detail">
        <header className="invoice-detail-breadcrumb">
          <button type="button" className="invoice-detail-back" onClick={navigateBack}>
            <span className="material-symbols-outlined">arrow_back</span> Back
          </button>
        </header>
        <p>Invoice not found.</p>
      </section>
    );
  }

  return <InvoiceDetailContent invoice={invoice} reload={reload} previewUrl={previewUrl} />;
}

interface InvoiceDetailContentProps {
  invoice: Invoice;
  reload: () => void;
  previewUrl: string | null;
}

function InvoiceDetailContent({ invoice, reload, previewUrl }: InvoiceDetailContentProps) {
  const approve = useApproveInvoices(reload);
  const reject = useRejectInvoice(reload);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [showReject, setShowReject] = useState<boolean>(false);

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
        <button type="button" className="invoice-detail-back" onClick={navigateBack}>
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

      <div className="split">
        <div className="col">
          <SourcePane invoice={invoice} previewUrl={previewUrl} />
        </div>
        <div className="col-divider" />
        <div className="col detail">
          <div className="detail-head">
            <div>
              <h2>{invoice.vendor}</h2>
              <span className="sub">
                <span className="lb-mono">{invoice.invoiceNumber}</span>
                <span>·</span>
                <span>{formatDate(invoice.invoiceDate)}</span>
                <span>·</span>
                <span className={`spill s-${invoice.status}`}>
                  <span className="dot" />
                  {INVOICE_STATUS_LABEL[invoice.status].toUpperCase()}
                </span>
              </span>
            </div>
            <div className="detail-head-actions">
              <button
                type="button"
                className="iconbtn"
                title="Reject"
                onClick={onReject}
                disabled={reject.isRejecting}
              >
                <span className="material-symbols-outlined">close</span>
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
          </div>

          <InvoiceFieldsPanel invoice={invoice} onSaved={reload} />

          <section className="section invoice-risk-panel" aria-label="Risk signals">
            <div className="stitle">
              <h3>Risk signals</h3>
              <span className="lb-caption">{invoice.riskSignals.length} signal(s)</span>
            </div>
            {invoice.riskSignals.length === 0 ? (
              <p className="invoice-empty-line">No active risk signals.</p>
            ) : (
              <ul className="invoice-risk-list">
                {invoice.riskSignals.map((signal) => (
                  <li key={`${signal.code}-${signal.status}`} className={`risk-row ${signal.severity}`}>
                    <span className="icon">
                      <span className="material-symbols-outlined">
                        {signal.severity === "critical"
                          ? "priority_high"
                          : signal.severity === "warning"
                            ? "warning"
                            : "info"}
                      </span>
                    </span>
                    <div className="body">
                      <div className="risk-code">{signal.code}</div>
                      <div className="risk-msg">{signal.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section invoice-timeline-panel" aria-label="Approval timeline">
            <div className="stitle">
              <h3>Workflow</h3>
              {invoice.workflowStep !== null && invoice.workflowTotalSteps !== null ? (
                <span className="lb-caption">
                  Step {invoice.workflowStep} of {invoice.workflowTotalSteps}
                </span>
              ) : null}
            </div>
            {invoice.timeline.length === 0 ? (
              <p className="invoice-empty-line">No timeline entries yet.</p>
            ) : (
              <ol className="timeline">
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

          <section className="section invoice-compliance-panel" aria-label="Compliance">
            <div className="stitle">
              <h3>Compliance</h3>
            </div>
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

interface SourcePaneProps {
  invoice: Invoice;
  previewUrl: string | null;
}

function SourcePane({ invoice, previewUrl }: SourcePaneProps) {
  const fileLabel = invoice.fileName ?? `${invoice.invoiceNumber}.pdf`;
  return (
    <div className="source-pane">
      <div className="source-pane-head">
        <span className="file-name">
          <span className="material-symbols-outlined">description</span>
          {fileLabel}
        </span>
        {invoice.confidence !== null ? (
          <span className="lb-mono">conf {(invoice.confidence * 100).toFixed(0)}%</span>
        ) : null}
      </div>
      {previewUrl ? (
        <iframe
          title={`Source for invoice ${invoice.invoiceNumber}`}
          src={previewUrl}
          className="source-pane-frame"
        />
      ) : (
        <div className="source-pane-empty">Preview unavailable.</div>
      )}
      <div className="source-pane-tools">
        <button type="button" className="iconbtn" title="Zoom in" disabled>
          <span className="material-symbols-outlined">zoom_in</span>
        </button>
        <button type="button" className="iconbtn" title="Zoom out" disabled>
          <span className="material-symbols-outlined">zoom_out</span>
        </button>
        <button type="button" className="iconbtn" title="Rotate" disabled>
          <span className="material-symbols-outlined">rotate_right</span>
        </button>
        <span className="source-pane-tools-spacer" />
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="iconbtn"
            title="Open in new tab"
          >
            <span className="material-symbols-outlined">open_in_new</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

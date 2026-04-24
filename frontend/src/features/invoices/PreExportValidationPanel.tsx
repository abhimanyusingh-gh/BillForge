import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, BADGE_SIZE } from "@/components/ds/Badge";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "@/components/ds/Button";
import { SlideOverPanel } from "@/components/ds/SlideOverPanel";
import type { Invoice } from "@/types";
import {
  buildPreExportFailureGroups,
  totalPreExportFailures,
  type PreExportFailure,
  type PreExportFailureGroup
} from "@/lib/invoice/preExportFailures";

export const PRE_EXPORT_VIEW = {
  Loading: "Loading",
  Error: "Error",
  Empty: "Empty",
  Data: "Data"
} as const;

type PreExportView = (typeof PRE_EXPORT_VIEW)[keyof typeof PRE_EXPORT_VIEW];

interface PreExportValidationPanelProps {
  open: boolean;
  invoices: readonly Invoice[];
  onCancel: () => void;
  onConfirm: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  panelId?: string;
  retryLoadingMs?: number;
  initialError?: boolean;
}

const DEFAULT_RETRY_LOADING_MS = 220;

function resolveView(args: {
  isLoading: boolean;
  isError: boolean;
  failureCount: number;
}): PreExportView {
  if (args.isLoading) return PRE_EXPORT_VIEW.Loading;
  if (args.isError) return PRE_EXPORT_VIEW.Error;
  if (args.failureCount === 0) return PRE_EXPORT_VIEW.Empty;
  return PRE_EXPORT_VIEW.Data;
}

function SkeletonRow() {
  return <div aria-hidden="true" className="pre-export-skeleton-row" />;
}

function LoadingState() {
  return (
    <div data-testid="pre-export-loading" aria-busy="true" aria-live="polite">
      <p className="pre-export-loading-label">Validating invoices…</p>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="pre-export-error" role="alert" className="pre-export-error">
      <p className="pre-export-error-title">Validation failed to run.</p>
      <Button variant={BUTTON_VARIANT.secondary} size={BUTTON_SIZE.sm} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <div data-testid="pre-export-empty" className="pre-export-empty">
      <span className="material-symbols-outlined pre-export-empty-icon" aria-hidden="true">
        task_alt
      </span>
      <p className="pre-export-empty-title">
        Ready to export {count} invoice{count === 1 ? "" : "s"}
      </p>
      <p className="pre-export-empty-detail">No validation issues detected.</p>
    </div>
  );
}

function FailureRow({
  failure,
  tone,
  onFixNow
}: {
  failure: PreExportFailure;
  tone: PreExportFailureGroup["tone"];
  onFixNow: (invoiceId: string) => void;
}) {
  return (
    <div
      data-testid="pre-export-failure"
      data-invoice-id={failure.invoiceId}
      className="pre-export-row"
    >
      <div className="pre-export-row-main">
        <span className="pre-export-row-heading">
          <Badge tone={tone} size={BADGE_SIZE.sm}>
            {failure.invoiceNumber || "—"}
          </Badge>
          <span className="pre-export-row-vendor">
            {failure.vendorName || "Unknown vendor"}
          </span>
        </span>
        <span className="pre-export-row-detail">{failure.detail}</span>
      </div>
      <Button
        variant={BUTTON_VARIANT.secondary}
        size={BUTTON_SIZE.sm}
        data-testid={`pre-export-fix-now-${failure.invoiceId}`}
        onClick={() => onFixNow(failure.invoiceId)}
      >
        Fix now
      </Button>
    </div>
  );
}

function FailureGroupSection({
  group,
  onFixNow
}: {
  group: PreExportFailureGroup;
  onFixNow: (invoiceId: string) => void;
}) {
  return (
    <section
      data-testid="pre-export-group"
      data-reason={group.reason}
      className="pre-export-group"
    >
      <header className="pre-export-group-header">
        <h3 className="pre-export-group-title">{group.label}</h3>
        <Badge tone={group.tone} size={BADGE_SIZE.sm}>
          {group.failures.length}
        </Badge>
      </header>
      {group.failures.map((failure) => (
        <FailureRow
          key={failure.invoiceId}
          failure={failure}
          tone={group.tone}
          onFixNow={onFixNow}
        />
      ))}
    </section>
  );
}

export function PreExportValidationPanel({
  open,
  invoices,
  onCancel,
  onConfirm,
  onSelectInvoice,
  panelId,
  retryLoadingMs = DEFAULT_RETRY_LOADING_MS,
  initialError = false
}: PreExportValidationPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(initialError);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsError(initialError);
    setIsLoading(false);
  }, [open, invoices, initialError]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const groups = useMemo(() => buildPreExportFailureGroups(invoices), [invoices]);
  const failureCount = totalPreExportFailures(groups);
  const view = resolveView({ isLoading, isError, failureCount });

  const handleFixNow = (invoiceId: string) => {
    onSelectInvoice(invoiceId);
    onCancel();
  };

  const handleRetry = () => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }
    setIsError(false);
    setIsLoading(true);
    retryTimerRef.current = window.setTimeout(() => {
      setIsLoading(false);
      retryTimerRef.current = null;
    }, retryLoadingMs);
  };

  const footer =
    view === PRE_EXPORT_VIEW.Empty ? (
      <>
        <Button variant={BUTTON_VARIANT.secondary} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={BUTTON_VARIANT.primary}
          data-testid="pre-export-confirm"
          onClick={onConfirm}
        >
          Export {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
        </Button>
      </>
    ) : view === PRE_EXPORT_VIEW.Data ? (
      <>
        <Button variant={BUTTON_VARIANT.secondary} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={BUTTON_VARIANT.destructive}
          data-testid="pre-export-export-anyway"
          onClick={onConfirm}
        >
          Export anyway ({invoices.length})
        </Button>
      </>
    ) : (
      <Button variant={BUTTON_VARIANT.secondary} onClick={onCancel}>
        Cancel
      </Button>
    );

  return (
    <SlideOverPanel
      open={open}
      onClose={onCancel}
      title="Pre-export validation"
      width="lg"
      id={panelId}
      footer={footer}
    >
      <div data-testid="pre-export-body" data-view={view}>
        {view === PRE_EXPORT_VIEW.Loading ? <LoadingState /> : null}
        {view === PRE_EXPORT_VIEW.Error ? <ErrorState onRetry={handleRetry} /> : null}
        {view === PRE_EXPORT_VIEW.Empty ? <EmptyState count={invoices.length} /> : null}
        {view === PRE_EXPORT_VIEW.Data ? (
          <>
            <p data-testid="pre-export-summary" className="pre-export-summary">
              {failureCount} of {invoices.length} invoice{invoices.length === 1 ? "" : "s"} have
              validation issues.
            </p>
            {groups.map((group) => (
              <FailureGroupSection key={group.reason} group={group} onFixNow={handleFixNow} />
            ))}
          </>
        ) : null}
      </div>
    </SlideOverPanel>
  );
}

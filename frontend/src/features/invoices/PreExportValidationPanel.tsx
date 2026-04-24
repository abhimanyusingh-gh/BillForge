import { useEffect, useMemo, useState } from "react";
import { Badge, BADGE_SIZE } from "@/components/ds/Badge";
import { Button, BUTTON_VARIANT, BUTTON_SIZE } from "@/components/ds/Button";
import { SlideOverPanel } from "@/components/ds/SlideOverPanel";
import { tokens } from "@/components/ds/tokens";
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
  loadingMs?: number;
  initialError?: boolean;
}

const DEFAULT_LOADING_MS = 220;

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
  return (
    <div
      aria-hidden="true"
      style={{
        height: "2.5rem",
        borderRadius: tokens.radius.sm,
        background: tokens.color.bg.main,
        border: `1px solid ${tokens.color.line}`,
        marginBottom: tokens.space.s2
      }}
    />
  );
}

function LoadingState() {
  return (
    <div data-testid="pre-export-loading" aria-busy="true" aria-live="polite">
      <p style={{ margin: `0 0 ${tokens.space.s3}`, color: tokens.color.ink.soft }}>
        Validating invoices…
      </p>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="pre-export-error"
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.space.s3,
        padding: tokens.space.s4,
        border: `1px solid ${tokens.color.line}`,
        borderRadius: tokens.radius.sm,
        background: tokens.color.bg.main
      }}
    >
      <p style={{ margin: 0, fontWeight: tokens.font.weight.semibold }}>
        Validation failed to run.
      </p>
      <Button variant={BUTTON_VARIANT.secondary} size={BUTTON_SIZE.sm} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <div
      data-testid="pre-export-empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${tokens.space.s6} ${tokens.space.s4}`,
        textAlign: "center",
        color: tokens.color.ink.soft
      }}
    >
      <span
        className="material-symbols-outlined"
        aria-hidden="true"
        style={{
          fontSize: "2.25rem",
          color: tokens.color.status.approved,
          marginBottom: tokens.space.s3
        }}
      >
        task_alt
      </span>
      <p style={{ margin: 0, fontWeight: tokens.font.weight.semibold, color: tokens.color.ink.base }}>
        Ready to export {count} invoice{count === 1 ? "" : "s"}
      </p>
      <p style={{ margin: `${tokens.space.s2} 0 0`, fontSize: tokens.font.size.sm }}>
        No validation issues detected.
      </p>
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
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: tokens.space.s3,
        padding: `${tokens.space.s2} ${tokens.space.s3}`,
        marginBottom: tokens.space.s2,
        border: `1px solid ${tokens.color.line}`,
        borderRadius: tokens.radius.sm,
        background: tokens.color.bg.panel,
        color: tokens.color.ink.base
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.space.s1, minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: tokens.space.s2 }}>
          <Badge tone={tone} size={BADGE_SIZE.sm}>
            {failure.invoiceNumber || "—"}
          </Badge>
          <span style={{ fontWeight: tokens.font.weight.semibold }}>
            {failure.vendorName || "Unknown vendor"}
          </span>
        </span>
        <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.ink.soft }}>
          {failure.detail}
        </span>
      </div>
      <Button
        variant={BUTTON_VARIANT.secondary}
        size={BUTTON_SIZE.sm}
        data-testid="pre-export-fix-now"
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
      style={{ marginBottom: tokens.space.s4 }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.space.s2,
          marginBottom: tokens.space.s2
        }}
      >
        <h3 style={{ margin: 0, fontSize: tokens.font.size.md, fontWeight: tokens.font.weight.semibold }}>
          {group.label}
        </h3>
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
  loadingMs = DEFAULT_LOADING_MS,
  initialError = false
}: PreExportValidationPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(initialError);

  useEffect(() => {
    if (!open) return;
    setIsError(initialError);
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), loadingMs);
    return () => window.clearTimeout(timer);
  }, [open, invoices, loadingMs, initialError]);

  const groups = useMemo(() => buildPreExportFailureGroups(invoices), [invoices]);
  const failureCount = totalPreExportFailures(groups);
  const view = resolveView({ isLoading, isError, failureCount });

  const handleFixNow = (invoiceId: string) => {
    onSelectInvoice(invoiceId);
    onCancel();
  };

  const handleRetry = () => {
    setIsError(false);
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), loadingMs);
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
            <p
              data-testid="pre-export-summary"
              style={{ margin: `0 0 ${tokens.space.s3}`, color: tokens.color.ink.soft }}
            >
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

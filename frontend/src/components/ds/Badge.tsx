import type { ReactNode } from "react";
import { BADGE_STATUS_LABEL, type BadgeStatus } from "@/types/badgeStatus";
import { cssVar, tokens } from "./tokens";

export const BADGE_TONE = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  accent: "accent"
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

export const BADGE_SIZE = {
  sm: "sm",
  md: "md"
} as const;

type BadgeSize = keyof typeof BADGE_SIZE;

interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: string;
  title?: string;
  className?: string;
  status?: BadgeStatus;
  showStatusDot?: boolean;
  children?: ReactNode;
}

const STATUS_CLASSNAME: Record<BadgeStatus, string> = {
  PENDING: "lb-badge-status-pending",
  PARSED: "lb-badge-status-parsed",
  NEEDS_REVIEW: "lb-badge-status-needs-review",
  AWAITING_APPROVAL: "lb-badge-status-awaiting-approval",
  APPROVED: "lb-badge-status-approved",
  EXPORTED: "lb-badge-status-exported",
  FAILED_OCR: "lb-badge-status-failed-ocr",
  FAILED_PARSE: "lb-badge-status-failed-parse"
};

const TONE_STYLE: Record<BadgeTone, { background: string; color: string; border?: string }> = {
  neutral: {
    background: cssVar("color.bg.main"),
    color: cssVar("color.ink.soft"),
    border: `1px solid ${cssVar("color.line")}`
  },
  info: {
    background: cssVar("color.badge.crossChecked.bg"),
    color: cssVar("color.badge.crossChecked.fg")
  },
  success: {
    background: cssVar("color.badge.valid.bg"),
    color: cssVar("color.badge.valid.fg")
  },
  warning: {
    background: cssVar("color.warn.softBg"),
    color: cssVar("color.status.parsed")
  },
  danger: {
    background: cssVar("color.badge.invalid.bg"),
    color: cssVar("color.badge.invalid.fg")
  },
  accent: {
    background: cssVar("color.accent.softBg"),
    color: cssVar("color.accent")
  }
};

const SIZE_STYLE: Record<BadgeSize, { padding: string; fontSize: string; gap: string }> = {
  sm: { padding: "0.1rem 0.4rem", fontSize: tokens.font.size.xs, gap: "0.2rem" },
  md: { padding: "0.18rem 0.55rem", fontSize: tokens.font.size.sm, gap: "0.3rem" }
};

export function Badge({
  tone = "neutral",
  size = "md",
  icon,
  title,
  className,
  status,
  showStatusDot = true,
  children
}: BadgeProps) {
  const sizeStyle = SIZE_STYLE[size];
  const statusLabel = status ? BADGE_STATUS_LABEL[status] : undefined;
  const resolvedTitle = title ?? statusLabel;
  const resolvedChildren = children ?? (status ? statusLabel : undefined);
  const hasChildren =
    resolvedChildren !== undefined && resolvedChildren !== null && resolvedChildren !== false;
  const ariaLabel = !hasChildren && resolvedTitle ? resolvedTitle : undefined;
  const role = ariaLabel ? "img" : undefined;

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: sizeStyle.gap,
    padding: sizeStyle.padding,
    borderRadius: "999px",
    fontSize: sizeStyle.fontSize,
    fontWeight: tokens.font.weight.medium,
    lineHeight: 1,
    whiteSpace: "nowrap"
  } as const;

  if (status) {
    const statusClass = STATUS_CLASSNAME[status];
    const composedClassName = ["lb-badge-status", statusClass, className]
      .filter(Boolean)
      .join(" ");
    return (
      <span
        className={composedClassName}
        role={role}
        aria-label={ariaLabel}
        title={resolvedTitle || undefined}
        data-status={status}
        style={baseStyle}
      >
        {showStatusDot ? (
          <span className="lb-badge-status-dot" aria-hidden="true" />
        ) : null}
        {icon ? (
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontSize: sizeStyle.fontSize }}
          >
            {icon}
          </span>
        ) : null}
        {resolvedChildren}
      </span>
    );
  }

  const toneStyle = TONE_STYLE[tone];
  return (
    <span
      className={className}
      role={role}
      aria-label={ariaLabel}
      title={resolvedTitle || undefined}
      style={{
        ...baseStyle,
        ...toneStyle
      }}
    >
      {icon ? (
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: sizeStyle.fontSize }}
        >
          {icon}
        </span>
      ) : null}
      {resolvedChildren}
    </span>
  );
}

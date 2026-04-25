import type { ReactNode } from "react";
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
  children?: ReactNode;
}

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
  children
}: BadgeProps) {
  const toneStyle = TONE_STYLE[tone];
  const sizeStyle = SIZE_STYLE[size];
  const hasChildren = children !== undefined && children !== null && children !== false;
  const ariaLabel = !hasChildren && title ? title : undefined;
  const role = ariaLabel ? "img" : undefined;
  return (
    <span
      className={className}
      role={role}
      aria-label={ariaLabel}
      title={title || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sizeStyle.gap,
        padding: sizeStyle.padding,
        borderRadius: "999px",
        fontSize: sizeStyle.fontSize,
        fontWeight: tokens.font.weight.medium,
        lineHeight: 1,
        whiteSpace: "nowrap",
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
      {children}
    </span>
  );
}

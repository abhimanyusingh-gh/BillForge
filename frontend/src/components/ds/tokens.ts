export const TOKEN_CSS_VAR = {
  "color.bg.main": "--bg-main",
  "color.bg.panel": "--bg-panel",
  "color.ink": "--ink",
  "color.ink.soft": "--ink-soft",
  "color.accent": "--accent",
  "color.accent.hover": "--accent-2",
  "color.accent.softBg": "--badge-accent-soft-bg",
  "color.warn": "--warn",
  "color.warn.softBg": "--badge-warning-soft-bg",
  "color.line": "--line",
  "color.status.approved": "--status-approved",
  "color.status.exported": "--status-exported",
  "color.status.parsed": "--status-parsed",
  "color.status.needsReview": "--status-needs-review",
  "color.status.pending": "--status-pending",
  "color.status.failedOcr": "--status-failed-ocr",
  "color.status.failedParse": "--status-failed-parse",
  "color.chart.blue": "--chart-blue",
  "color.chart.emerald": "--chart-emerald",
  "color.chart.amber": "--chart-amber",
  "color.chart.rose": "--chart-rose",
  "color.chart.violet": "--chart-violet",
  "color.chart.cyan": "--chart-cyan",
  "color.badge.valid.bg": "--badge-valid-bg",
  "color.badge.valid.fg": "--badge-valid-fg",
  "color.badge.invalid.bg": "--badge-invalid-bg",
  "color.badge.invalid.fg": "--badge-invalid-fg",
  "color.badge.crossChecked.bg": "--badge-cross-checked-bg",
  "color.badge.crossChecked.fg": "--badge-cross-checked-fg",
  "color.badge.tenantMatch.bg": "--badge-tenant-match-bg",
  "color.badge.tenantMatch.fg": "--badge-tenant-match-fg",
  "color.badge.tenantMatch.border": "--badge-tenant-match-border",
  "space.1": "--sp-1",
  "space.2": "--sp-2",
  "space.3": "--sp-3",
  "space.4": "--sp-4",
  "space.5": "--sp-5",
  "space.6": "--sp-6",
  "space.8": "--sp-8",
  "radius.sm": "--radius-sm",
  "radius.md": "--radius-md",
  "radius.lg": "--radius-lg",
  "shadow.sm": "--shadow-sm",
  "shadow.md": "--shadow-md",
  "shadow.lg": "--shadow-lg"
} as const;

export type TokenPath = keyof typeof TOKEN_CSS_VAR;

export function cssVar(path: TokenPath): string {
  return `var(${TOKEN_CSS_VAR[path]})`;
}

export const tokens = {
  color: {
    bg: { main: cssVar("color.bg.main"), panel: cssVar("color.bg.panel") },
    ink: { base: cssVar("color.ink"), soft: cssVar("color.ink.soft") },
    accent: {
      base: cssVar("color.accent"),
      hover: cssVar("color.accent.hover"),
      softBg: cssVar("color.accent.softBg")
    },
    warn: { base: cssVar("color.warn"), softBg: cssVar("color.warn.softBg") },
    line: cssVar("color.line"),
    status: {
      approved: cssVar("color.status.approved"),
      exported: cssVar("color.status.exported"),
      parsed: cssVar("color.status.parsed"),
      needsReview: cssVar("color.status.needsReview"),
      pending: cssVar("color.status.pending"),
      failedOcr: cssVar("color.status.failedOcr"),
      failedParse: cssVar("color.status.failedParse")
    }
  },
  space: {
    s1: cssVar("space.1"),
    s2: cssVar("space.2"),
    s3: cssVar("space.3"),
    s4: cssVar("space.4"),
    s5: cssVar("space.5"),
    s6: cssVar("space.6"),
    s8: cssVar("space.8")
  },
  radius: {
    sm: cssVar("radius.sm"),
    md: cssVar("radius.md"),
    lg: cssVar("radius.lg")
  },
  shadow: {
    sm: cssVar("shadow.sm"),
    md: cssVar("shadow.md"),
    lg: cssVar("shadow.lg")
  },
  font: {
    family: '"Inter", system-ui, -apple-system, sans-serif',
    size: {
      xs: "0.75rem",
      sm: "0.82rem",
      base: "0.9rem",
      md: "1rem",
      lg: "1.15rem",
      xl: "1.4rem"
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5
    }
  }
} as const;

export type Tokens = typeof tokens;

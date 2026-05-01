# LedgerBuddy Design System

> Design system for **LedgerBuddy** — a multi-tenant accounting-operations platform for Indian Chartered Accountant (CA) firms and in-house accounting teams. Source of truth is the LedgerBuddy frontend codebase; this folder extracts and organises the foundations so design agents can produce on-brand artefacts.

## What is LedgerBuddy?

LedgerBuddy ingests purchase invoices (Gmail mailboxes, S3 drops, manual upload), runs OCR + a small language model to extract structured fields with bounding-box-level provenance, layers India-specific compliance (GSTIN/PAN cross-check, TDS section + rate detection, TCS, MSME, e-invoice IRN, vendor bank-change fraud signals), shepherds invoices through a configurable approval workflow, computes net payable after TDS/TCS, and exports Tally-compatible XML — including new native Payment vouchers + ledger sync — into Tally Prime / Tally ERP 9.

One **tenant** (CA firm) services many **client organizations** (each its own isolated workspace). Staff switch between client orgs dozens of times a day; the realm switcher is constantly used.

### Audience and tone of the product
LedgerBuddy is an **accounting power tool for India**, not a consumer app. The audience is AP Clerks (100–200 invoices/day), Senior Accountants, CAs, Tax Specialists and Firm Partners. Design tone is closer to Linear / Superhuman / Stripe Dashboard / Plaid / Tally Prime than to a generic SaaS dashboard:

- Density first. Tables of 100s of invoices are normal. Default row height is ~32 px (Gmail / Linear), not Notion.
- Keyboard primary, mouse secondary. Vim-like (`j/k/Space/Enter/a/e/?`) plus chord shortcuts. Every primary action shows its shortcut hint inline.
- Dark mode is in active daily use; **light and dark must be equally polished**.
- Indian number + date formatting: lakh/crore grouping (`₹ 12,34,567`), `dd-MMM-yyyy`, FY as `2025-26`, GST `9%` not `9.00%`.
- Tally-export surfaces look like accounting documents: fixed-width columns, debit/credit aligned, ledger names verbatim.
- No marketing chrome. No hero illustrations, no gradient blobs, no decorative emoji, no glassmorphism, no AI sparkle gimmickry.

## Sources used to build this system

All foundations were lifted from the LedgerBuddy GitHub repo:

- **Repo**: `abhimanyusingh-gh/LedgerBuddy` (`main` branch)
- **Design tokens**: `frontend/src/components/ds/tokens.ts`
- **Global styles + theme variables**: `frontend/src/styles.css` (~5 200 lines)
- **DS primitives**: `frontend/src/components/ds/{Badge,Button,SlideOverPanel,Spinner}.tsx`
- **Logo / favicon**: `frontend/public/{logo,favicon}.svg`
- **Domain components**: `frontend/src/components/invoice/*`, `frontend/src/components/workspace/HierarchyBadges.tsx`
- **Brief**: the LedgerBuddy redesign brief shared by the user (priorities, anti-patterns, vocabulary, IA gaps, roadmap).

The reader is not assumed to have access; everything load-bearing is captured here.

## Index

| File / folder | Purpose |
|---|---|
| `colors_and_type.css` | All CSS variables (colors, spacing, type, density) for both themes; semantic typography classes (`.lb-h1`, `.lb-amount`, `.lb-kbd`, …). |
| `assets/` | Logo, favicon, and any captured visual assets. |
| `preview/` | Per-card design-system previews (cards rendered in the Design System tab). |
| `ui_kits/app/` | High-fidelity React+JSX recreations of the LedgerBuddy app (Action Required queue, Invoice Detail, Realm Switcher, Tally Export, Reconciliation, Vendors, Triage). |
| `SKILL.md` | Skill manifest for use as an Agent Skill. |

## Content fundamentals

LedgerBuddy copy is **terse, declarative, and accountant-literal**. It does not editorialise. It uses domain vocabulary verbatim — the user thinks in these terms, so the UI must use them too.

- **Voice**: third-person, system-led, neutral. "Approve invoice" not "Let's approve this invoice". "TDS deducted" not "Tax that's been pulled out". When the user is addressed, it's "you" — never "we".
- **Casing**: `Title Case` for nav items (`Action Required`, `Bank Statements`, `Tally Export`, `Client Orgs`). `UPPERCASE_SNAKE` for invoice statuses (`NEEDS_REVIEW`, `AWAITING_APPROVAL`, `EXPORTED`). `lower_snake` for filter keys (`status:awaiting_approval`). UPPERCASE for statutory codes (`PAN`, `GSTIN`, `TDS`, `IRN`, `MSME`, `194C`, `194J`, `26Q`).
- **Numbers**: Indian grouping (`₹ 12,34,567.89`, never `1,234,567.89`). Currency symbol `₹` (or `Rs` in fallback fonts). Amounts always tabular-mono (JetBrains Mono). GST percentages without trailing zeroes (`9%`, `18%`, `0.1%`).
- **Dates**: `dd-MMM-yyyy` (`15-Apr-2026`). FY written `2025-26`. Times always 24-hour `15:42 IST`.
- **Domain terms — never translate**: `Tenant`, `Client Org`, `Realm`, `Voucher`, `GSTIN`, `PAN`, `CGST/SGST/IGST`, `HSN/SAC`, `TDS`, `TDS Section` (e.g. `194C`, `194J`, `194H`, `194I`, `194Q`), `TCS`, `Section 206AA penalty rate`, `Net Payable`, `GL Code`, `Cost Center`, `IRN`, `MSME / Udyam`, `AlterID`, `F12 settings`, `GUID`, `BILLALLOCATIONS`, `Approval Workflow`, `Risk Signal`, `Provenance`, `FY`.
- **Empty states**: one line of plain text + a single primary action. No murals, no encouragement. e.g. *"No invoices need review. Try Inbox or All invoices."*
- **Errors / risk signals**: name the rule, then the consequence. *"PAN missing. TDS will apply at Section 206AA penalty rate (20%)."*
- **Action labels**: single verb where possible — `Approve`, `Reject`, `Export`, `Retry`, `Reconcile`, `Switch`. Pair with the keyboard hint: `Approve  A`, `Switch realm  ⌘K`.
- **Emoji**: never used. Iconography is **Material Symbols Outlined** only.

## Visual foundations

### Colors
- Two themes: light (`--bg-main: #f6f6f8`, `--bg-panel: #fff`) and dark (`--bg-main: #0f172a`, `--bg-panel: #1e293b`). The dark page body deepens to `#0b1120` and adds a faint accent radial — the only chromatic flourish anywhere.
- Accent is **LedgerBuddy blue**: `#1152d4` light / `#3b82f6` dark. Hover steps to `#1d4ed8` / `#2563eb`. Soft accent backgrounds (`rgba(17, 82, 212, 0.10)`) carry sidebar-active and accent badges.
- **Compliance is the only place color is allowed to shout**. Severity colors (info / warning / critical) map to `#1152d4` / `#f59e0b` / `#e11d48`. Soft variants for badge backgrounds. Never decorative.
- Invoice lifecycle states each get a tone (slate / amber / rose / violet / green / blue / red / orange) — see `colors_and_type.css` `--status-*`.
- Charts use a six-tone palette (blue / emerald / amber / rose / violet / cyan) tuned for both themes.

### Type
- **Inter** for the entire UI. Weights 400 / 500 / 600 / 700; rare 800 for brand wordmark.
- **JetBrains Mono** for amounts, GSTIN, PAN, IRN, GUID, AlterID, voucher codes, and any tabular numerics. `tabular-nums lining-nums` always on so columns align perfectly.
- Type scale is data-dense: 11 / 12 / 13 / 14 / 16 / 18 / 22 px. The default body in tables is **13 px** (`--fs-sm`). Section bodies use 14 px. Page headers are 22 px. Display is rare.
- Material Symbols Outlined is the icon family (variable font, weight 100–700). Used at 1 rem inline beside labels and buttons.

### Spacing & density
- 4-pt baseline: `--sp-1 … --sp-12` = 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 px.
- Default row height is **32 px (compact)**. Comfortable variant is 44 px. Density toggle is per-surface.
- Padding inside table cells: `0.5rem 0.65rem` compact, `0.7rem 0.75rem` comfortable.
- Page gutter: 12 px on the layout shell, 16 px inside panels.

### Backgrounds & surfaces
- Three-tier: `--bg-main` (page), `--bg-panel` (cards/tables), `--bg-sunken` (table headers, code blocks).
- A near-invisible page accent: a radial gradient from top-left (`rgba(17, 82, 212, 0.08)`) and bottom-right (`rgba(15, 23, 42, 0.06)`) painted onto the body. This is the **only** decorative gradient. No blobs, no full-bleed imagery, no patterns.
- Cards: 1 px solid `--line` border, 10 px radius (`--radius-md`), `--shadow-sm` (1 px ambient). No drop shadows on the page itself.
- Pills / badges: 999 px (`--radius-pill`).
- Buttons: 8 px radius.

### Borders
- Hairline: 1 px solid `--line` (`#e2e8f0` / `#334155`). Section dividers use the same.
- Dashed `--accent` 1.5 px is reserved for the file-dropzone affordance only.
- Focus ring: 2 px `--accent` outline + 2 px offset, plus `--shadow-focus` halo on form controls.

### Shadows
- Three steps: `--shadow-sm` (cards, top-nav), `--shadow-md` (popups, slide-overs), `--shadow-lg` (command palette, modals). No coloured shadows. Dark mode multiplies opacity, never tints.

### Animation
- Tiny, mostly 120 ms ease. `transition: border-color 120ms, background 120ms, box-shadow 120ms`. Buttons: `:hover` lifts 1 px (`translateY(-1px)`), `:active` shrinks `scale(0.97)`. No bouncing, no parallax, no entrance animations on tables.

### Hover & press
- Rows: hover background → `rgba(59, 130, 246, 0.08)` (dark) / very faint blue tint (light). Active row: `--badge-accent-soft-bg`.
- Sidebar links: hover background `--bg-main`, active background `--badge-accent-soft-bg` + `--accent` text.
- Buttons: primary darkens (accent → accent-2). Secondary borders darken to `--ink-soft` and opacity drops to 0.85.
- Focus is always visible (2 px ring); `:active` shrinks slightly.

### Transparency & blur
- Used sparingly. The file-dropzone uses a 4 % accent fill. Severity badges use `rgba(…, 0.18)` fills. **No backdrop blur anywhere** — it costs renders and signals consumer.

### Imagery
- LedgerBuddy carries no photography or illustration. The product is text + tables + PDFs + accounting documents. The only "imagery" in the system is the source PDF rendered inside the Provenance Viewer.

### Layout rules
- Fixed layout shell at `max-width: 112.5rem`, `padding: 0.75rem 1rem`. Top nav is sticky and never collapses. Sidebar is sticky on left.
- The Realm Switcher (tenant + client-org breadcrumb) is permanently top-right; switching is a `⌘K` palette.
- The detail panel is right-of-list with a draggable divider — preserved across surfaces.

### Corner radii
- 4 px (kbd glyphs), 6 px (`--radius-sm`, small chips), 10 px (`--radius-md`, default cards/buttons), 16 px (`--radius-lg`, large surfaces), 999 px (pills/badges).

## Iconography

LedgerBuddy uses **Material Symbols Outlined** (Google) as a webfont — already loaded by the global stylesheet. The variable axis lets the same glyph appear at weights 100–700. Used inline at body size (~16 px) before action labels and inside badges. Stroke is consistently outlined (no filled variant) — keeps with the calm, professional feel.

- **No emoji.** Decision is hard — no exceptions even in casual UI text.
- **No custom SVG icons.** If a glyph is missing from Material Symbols, pick the closest match rather than draw new artwork.
- **No duotone / multi-colour icons.** Icons inherit `currentColor`; the only colour they ever take is the foreground of their containing badge or button.
- **Logo / brand mark**: `assets/logo.svg` and `assets/favicon.svg` — a rounded blue square containing the rupee glyph (`₹`), with the wordmark **LedgerBuddy** in Inter 800. The logo carries the only branded chromatic mark in the product.

A short list of Material Symbols routinely used in product copy: `inbox`, `inventory_2`, `receipt_long`, `account_balance`, `payments`, `description`, `task_alt`, `priority_high`, `error`, `warning`, `flag`, `hourglass_empty`, `keyboard_command_key`, `sync`, `cloud_upload`, `account_tree`, `business`.

## How to use this design system

1. Drop `colors_and_type.css` into the head of any artefact: `<link rel="stylesheet" href="colors_and_type.css" />`.
2. Pull components from `ui_kits/app/` rather than reinventing them.
3. Use semantic vars (`var(--ink)`, `var(--accent)`, `var(--status-needs-review)`) — they handle dark mode automatically when `data-theme="dark"` is set on `html`.
4. Never use inline `style={{…}}` in production — extend the DS instead. (This is a hard repo rule.)
5. When in doubt, lean *more compact* and *less colourful*.

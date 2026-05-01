---
name: ledgerbuddy-design
description: Use this skill to generate well-branded interfaces and assets for LedgerBuddy, an Indian accounting-operations platform for CA firms. Contains design tokens (colors, type, spacing), Material Symbols iconography, the LedgerBuddy logo, and a UI kit covering the priority surfaces (Action Required queue, Invoice Detail, Realm Switcher, Tally Export, Reconciliation, Vendors, Triage). Use whenever building production code or throwaway prototypes/mocks for LedgerBuddy.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key files:
- `README.md` — product context, content fundamentals, visual foundations, iconography, file index.
- `colors_and_type.css` — full token sheet (colors, type, spacing, radii, shadows, semantic vars). Light + dark.
- `assets/` — logo, favicon, README of icon usage.
- `ui_kits/app/` — JSX recreations of priority surfaces. Open `ui_kits/app/index.html` for an interactive click-thru.
- `preview/` — atomic design-system cards (used in the Design System tab).

Hard rules from the brief:
- Density first. Default table rows ~32px. No marketing-site spacing.
- Keyboard primary. Every primary action shows a shortcut hint (`<kbd>`).
- Indian number formatting — `₹ 12,34,567.89`. Tabular numerals (JetBrains Mono) for amounts and statutory codes (`194C`, `194J`, GSTIN).
- Status taxonomy is fixed: PENDING / PARSED / NEEDS_REVIEW / AWAITING_APPROVAL / APPROVED / EXPORTED / FAILED_OCR / FAILED_PARSE.
- Severity tokens: `--severity-info | --severity-warning | --severity-critical` — used both as dot color and pill background.
- Realm switcher (tenant + client-org) is the most-frequent action. Always on top-nav, ⌘K opens command palette.
- No emoji, no decorative SVG illustrations, no glassmorphism, no animated gradients.
- Light + dark must be equally polished. Test both.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build, ask 3–5 sharp questions (which surface, light/dark, density, etc.), and act as an expert designer who outputs HTML artifacts or production-style React code.

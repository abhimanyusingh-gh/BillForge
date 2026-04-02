# UI Overhaul Plan: From Confidence Scores to Direct Compliance Feedback

> Last updated: 2026-03-30
>
> **Problem:** The confidence score (0-100, red/yellow/green) collapses 15+ discrete compliance signals into one number.
> A reviewer can't act on "87" but can act on "PAN missing — TDS at 20% penalty rate."
> The score was designed for 2 risk flags. With a full compliance layer, it hides more than it reveals.

---

## 1. Design Principles (from AI-Native AP Tools Research)

### What the best tools do differently

| Pattern | Source | Application to BillForge |
|---------|--------|-------------------------|
| **Exception-based workflow** | Vic.ai (85% no-touch rate by month 6) | Default state is "auto-approved." Only surface invoices that need human attention. The list should filter to exceptions by default, not show all invoices. |
| **High-confidence auto-post, low-confidence surface** | Botkeeper ("AI posts to GL only when confidence is high — 97% accuracy. Anything lower gets surfaced.") | Replace the green/yellow/red badge with a binary: "Ready" (no action needed) vs "Needs Attention" (specific issues listed). |
| **AI suggests, human confirms** | Cashflo, Stampli, Tipalti | Show GL code and TDS section as pre-filled dropdowns, not as read-only text. The reviewer's job is to confirm or change — not to decode a score. |
| **Direct field-level indicators** | Rossum (learns from every keystroke) | Each field gets its own status indicator — not a single score for the whole invoice. Vendor name: ✓. PAN: ⚠ mismatch. TDS: ✓ 194J @ 10%. GL: ✓ Office Supplies. |
| **Decision transparency** | Hypatos ("explainable decisions powered by knowledge") | Every suggestion must show WHY. "GL: Office Supplies — based on 12 prior invoices from this vendor" or "TDS: 194J — linked to GL category Professional Services." |
| **Skill-based modules** | Hypatos (skill-based purchasing) | Compliance features are modular — tenant enables what they need. The UI only shows sections the tenant has configured. |

### Core shift

**Before:** Reviewer scans a confidence score → opens detail panel → hunts for what's wrong → fixes it.

**After:** Reviewer sees specific issues directly in the table → clicks to confirm/fix → moves on. No hunting.

---

## 2. Invoice List View Redesign

### Current state
```
| ☐ | File          | Vendor       | Invoice# | Date       | Total      | Confidence | Status  |
|---|---------------|-------------|----------|------------|------------|------------|---------|
| ☐ | inv-001.pdf   | Sharma Ltd  | INV-2026 | 2026-03-15 | ₹1,18,000  | 87 🟡      | PARSED  |
```

### Target state
```
| ☐ | File          | Vendor       | Invoice# | Date       | Total      | GL Code        | TDS     | Signals | Status       |
|---|---------------|-------------|----------|------------|------------|----------------|---------|---------|--------------|
| ☐ | inv-001.pdf   | Sharma Ltd  | INV-2026 | 2026-03-15 | ₹1,18,000  | Office (5010)  | 194J 10%| ⚠ 1    | Needs Review |
```

### Key changes

1. **Confidence score column removed** from default view. Available as optional column for power users.

2. **GL Code column** — shows suggested GL code name + number. Color-coded: green if high confidence (>80%), amber if low, gray if no suggestion.

3. **TDS column** — shows section + rate. Red if no-PAN penalty rate applies. Gray if below threshold or no section detected.

4. **Signals column** — count badge with severity color:
   - Red badge = has critical signals (bank change, no-PAN penalty)
   - Amber badge = warnings only (PAN mismatch, ambiguous TDS)
   - Blue badge = info only (first-time sender, below threshold)
   - No badge = clean invoice

5. **Status column** — replace `PARSED` / `NEEDS_REVIEW` with:
   - **Ready** — all fields extracted, no critical/warning signals, GL and TDS pre-filled
   - **Needs Review** — has warnings or missing fields
   - **Action Required** — has critical signals that must be resolved before approval
   - **Approved** / **Exported** — unchanged

6. **Default filter** — show "Needs Review" + "Action Required" by default. "Ready" invoices go to batch approval. This is the Vic.ai exception-based pattern.

### Batch approval enhancement

- "Approve All Ready" button — approves all invoices in "Ready" state (no critical/warning signals)
- Replaces "Select All Green" which was confidence-based
- Count badge on button: "Approve 38 Ready Invoices"

---

## 3. Invoice Detail Panel Redesign

### Current layout
```
┌────────────────────────────────┐
│ Extracted Fields               │
│  Vendor: Sharma Ltd            │
│  Invoice#: INV-2026            │
│  Date: 2026-03-15              │
│  Total: ₹1,18,000              │
│  Confidence: 87 🟡              │
├────────────────────────────────┤
│ Source Evidence (crops)        │
└────────────────────────────────┘
```

### Target layout
```
┌────────────────────────────────────────────────────────┐
│ ┌──────────────────────┐  ┌──────────────────────────┐ │
│ │ Document Preview      │  │ Fields & Compliance      │ │
│ │                       │  │                          │ │
│ │  [invoice image]      │  │ EXTRACTED                │ │
│ │                       │  │ Vendor   Sharma Ltd    ✓ │ │
│ │  page 1/2  zoom       │  │ Invoice# INV-2026     ✓ │ │
│ │                       │  │ Date     2026-03-15   ✓ │ │
│ │                       │  │ Total    ₹1,18,000    ✓ │ │
│ │                       │  │ PAN      ABCPK1234F  L2 │ │
│ │                       │  │ GSTIN    29ABCPK...   ✓ │ │
│ │                       │  │                          │ │
│ │                       │  │ COMPLIANCE               │ │
│ │                       │  │ GL Code  [Office ▾] 92%  │ │
│ │                       │  │   ↳ based on 12 invoices │ │
│ │                       │  │ TDS      [194J ▾] @ 10%  │ │
│ │                       │  │   ↳ linked to GL category│ │
│ │                       │  │ TDS Amt  ₹10,000         │ │
│ │                       │  │ Net Pay  ₹1,08,000       │ │
│ │                       │  │                          │ │
│ │                       │  │ SIGNALS                  │ │
│ │                       │  │ ⚠ PAN-GSTIN mismatch    │ │
│ │                       │  │   PAN ABCPK... ≠ GSTIN  │ │
│ │                       │  │   [Dismiss]              │ │
│ │                       │  │                          │ │
│ │                       │  │ [Approve] [Skip]         │ │
│ └──────────────────────┘  └──────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Key changes

1. **Two-panel layout** — document preview (left) + fields & compliance (right). This is the Rossum/Nanonets pattern. Currently BillForge has this but the right panel is just extracted fields.

2. **Per-field status indicators** — each field shows ✓ (valid), ⚠ (warning), ✗ (error), or a validation badge (L1/L2 for PAN).

3. **Compliance section is primary** — not hidden below extracted fields. GL code and TDS are the reviewer's main decision points.

4. **Inline explanation** — each AI suggestion shows WHY in small text: "based on 12 invoices from this vendor" or "linked to GL category Professional Services."

5. **Signals section replaces risk flags** — grouped by severity with dismiss buttons. Critical signals have red left border.

6. **Approve/Skip buttons** at bottom of panel — approve this invoice or skip to next. Keyboard shortcuts: Enter = approve, Tab = next.

7. **Confidence score** — moved to a small secondary indicator in the header. Not prominently displayed.

---

## 4. New Dashboard Tab: Compliance Overview

Replace the current analytics-focused overview with a compliance-first dashboard for TENANT_ADMIN.

### Layout
```
┌─────────────────────────────────────────────────────┐
│ TODAY                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ │ Ready    │ │ Needs    │ │ Action   │ │ Total   │ │
│ │ 38       │ │ Review   │ │ Required │ │ TDS     │ │
│ │          │ │ 6        │ │ 3        │ │ ₹1.2L   │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│                                                     │
│ ACTION REQUIRED (3)                                 │
│ ┌─ inv-047.pdf  VENDOR BANK CHANGED  ₹50,000    ──┐│
│ ├─ inv-051.pdf  TDS NO PAN           ₹1,18,000  ──┤│
│ └─ inv-053.pdf  DUPLICATE INV NUMBER ₹25,000    ──┘│
│                                                     │
│ GL DISTRIBUTION          │ TDS BY SECTION           │
│ ┌────────────────────┐   │ ┌─────────────────────┐  │
│ │ ████ Office (23)   │   │ │ 194J  45%           │  │
│ │ ███  Prof Svc (18) │   │ │ 194C  30%           │  │
│ │ ██   Rent (12)     │   │ │ 194H  15%           │  │
│ │ █    Other (8)     │   │ │ Other 10%           │  │
│ └────────────────────┘   │ └─────────────────────┘  │
│                                                     │
│ VENDOR HEALTH                                       │
│  12 vendors missing PAN · 2 bank changes · 3 MSME  │
└─────────────────────────────────────────────────────┘
```

### Key elements

1. **Top KPI cards** — action-oriented, not volume-oriented. "Action Required: 3" is more useful than "Total Invoices: 47."

2. **Action Required queue** — the critical invoices that need immediate attention. Click to jump to detail panel.

3. **GL Distribution + TDS breakdown** — visual summary of coding patterns. Helps admin spot miscoding trends.

4. **Vendor Health** — at-a-glance compliance status across vendor base.

---

## 5. Implementation Approach

### Phase 1: Foundation (with m21 compliance)

1. Add `complianceSummary` to list response (already done in SM contracts)
2. Add GL Code, TDS, Signals columns to invoice table (toggle-able)
3. Move confidence score to secondary position
4. Add compliance section to detail panel (CompliancePanel.tsx — already created)
5. Integrate RiskSignalList into detail panel (already created)

### Phase 2: Layout Redesign (m22)

1. Two-panel detail view (document + fields/compliance side-by-side)
2. Per-field status indicators (✓/⚠/✗)
3. Inline explanation text for AI suggestions
4. "Ready" / "Needs Review" / "Action Required" status replacement
5. "Approve All Ready" batch action
6. Keyboard shortcuts (Enter = approve, Tab = next)

### Phase 3: Dashboard Overhaul (m23)

1. Compliance Overview dashboard tab
2. Action Required queue
3. GL Distribution + TDS breakdown charts
4. Vendor Health scorecard
5. Downloadable compliance reports (linked from dashboard)

---

## 6. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Keep confidence score? | Yes, but secondary | Power users and debugging. Not the primary review signal. |
| Replace status labels? | Yes — Ready/Needs Review/Action Required | Maps to reviewer actions, not system states |
| Default filter? | Needs Review + Action Required | Exception-based workflow (Vic.ai pattern) |
| GL/TDS in table? | Yes, as default columns | These are the reviewer's primary decision points |
| Inline explanations? | Yes, under each suggestion | "Based on 12 invoices" builds trust (Hypatos transparency pattern) |
| Keyboard nav? | Yes, Enter/Tab/Esc | High-volume reviewers (150 invoices/day) need keyboard-first UX |

---

## 7. What This Means for the State Machine

The existing invoice statuses (`PARSED`, `NEEDS_REVIEW`) remain in the backend. The frontend maps them to display labels:

| Backend Status | Frontend Display | Condition |
|---------------|-----------------|-----------|
| `PARSED` | **Ready** | No critical/warning risk signals |
| `PARSED` | **Needs Review** | Has warning signals but no critical |
| `NEEDS_REVIEW` | **Needs Review** | Default |
| `NEEDS_REVIEW` | **Action Required** | Has critical risk signals |
| `AWAITING_APPROVAL` | Awaiting Approval | Unchanged |
| `APPROVED` | Approved | Unchanged |
| `EXPORTED` | Exported | Unchanged |
| `FAILED_OCR` / `FAILED_PARSE` | Failed | Unchanged |

No backend state machine changes needed. The mapping is purely frontend display logic based on `compliance.riskSignals` severity.

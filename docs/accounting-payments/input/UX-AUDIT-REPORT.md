I now have a thorough understanding of the entire BillForge frontend. Here is the comprehensive UX audit report.

---

# BillForge UX Audit Report

## 1. Executive Summary

**Overall UX Maturity Score: 5.5 / 10**

The application has strong engineering foundations -- dark mode, keyboard shortcuts, drag-and-drop, collapsible sections, density controls -- but the information architecture is organized around *data objects* (invoices, statements, connections) rather than *accountant workflows* (receive, verify, approve, pay, reconcile, file). This is the single most impactful gap.

### Top 5 UX Strengths
1. **Source preview with bounding-box highlighting** -- Clicking a field chip shows the OCR crop inline, directly aiding verification. This matches what Stampli and Tipalti do and is a genuine differentiator over Indian tools like Tally Prime and Zoho Books.
2. **Approval workflow builder with simple/advanced modes** -- The progressive disclosure from simple checkboxes to a fully configurable multi-step workflow with conditions (`totalAmountMinor > X`) is well-designed and production-ready.
3. **Keyboard-driven navigation** -- `j/k` for movement, Space for selection, `a` for approve, `e` for export, `?` for help. This follows Vim conventions that power users in accounting firms expect (modeled after Gmail/Superhuman patterns).
4. **Draggable, minimizable ingestion overlay** with position persistence -- A genuinely thoughtful touch that prevents blocking the workspace during long-running batch jobs.
5. **Comprehensive compliance configuration** -- TDS sections with individual/company/no-PAN rates, PAN validation levels, risk signal toggling, GL code import via CSV, TCS with audit history. This is deeper compliance config than Zoho Books or ClearTax offer.

### Top 5 UX Weaknesses
1. **No workflow-based navigation** -- Tabs are `Overview | Invoices | Exports | Statements | Tenant Config | Connections`. An accountant thinks: "What needs my attention now?" There is no "Inbox" or "Action Required" view. Zoho Books' left nav (`Dashboard > Invoices > Payments > Banking > Reports`) and Tally Prime's Gateway hierarchy both organize by workflow stage, not data type.
2. **Confidence score is the primary quality signal** -- A single numeric badge (`ConfidenceBadge`) with red/yellow/green tone is the main indicator of invoice quality. Per the project's own `feedback_confidence_score_overhaul.md`, this "whitewashes compliance data" and hides TDS/PAN/GL/risk signals behind a click. The detail panel shows compliance data, but the invoice table row does not.
3. **No vendor-centric view** -- There is no vendor master list, no vendor detail page, no way to see "all invoices from vendor X" or "TDS deducted for vendor Y this FY." Indian accounting is vendor-centric due to TDS/GST compliance. Tally Prime's entire data model is organized around ledger accounts (vendors).
4. **Bank reconciliation is statement-centric, not transaction-centric** -- The `BankStatementsTab` requires drilling into each statement, then viewing transactions. There is no unified "unreconciled transactions" view. Tally's bank reconciliation and Zoho Books' bank matching both present a split-pane view: unmatched bank entries on the left, candidate invoices on the right.
5. **Export is fire-and-forget** -- The export flow is `select invoices -> Export Tally XML -> download file`. There is no pre-export validation checklist, no mapping preview, no post-export verification. The `TallyMappingTable` exists in the popup detail but is collapsed by default (`popupMappingExpanded` starts `false`).

### Biggest UX Risk for Demo
The **absence of an "action required" queue**. When demonstrating to an accountant, the first question is "what do I need to do right now?" The current UI opens to the Overview dashboard (charts and KPIs), which is a reporting view, not an operational view. The accountant must navigate to `Invoices`, set the status filter to `NEEDS_REVIEW` or `AWAITING_APPROVAL`, and begin working. In Zoho Books, the dashboard itself shows actionable items. In Tally Prime, the Gateway presents the most-used voucher types front and center.

---

## 2. Current State Assessment

### 2A. Information Architecture

**Tab structure** (from `TenantViewTabs.tsx`):
```
Overview | Invoices | Exports | Statements | Tenant Config | Connections
```

**Problems:**
- "Statements" and "Connections" are only visible to users with `canViewConnections`. Regular members see only `Overview | Invoices | Exports`. Three tabs is too flat for a growing application.
- "Tenant Config" is the only admin-only tab, but it bundles *five* heterogeneous sections: Approval Workflow, GL Codes, Compliance (TDS/PAN/Risk Signals), TCS, and Users. These are reorderable via drag-and-drop (`useReorderableSections`), which is clever but signals the config surface is growing beyond a single tab.
- There is no "Vendors" tab, no "Payments" tab, no "Reconciliation" tab as a first-class destination. Reconciliation is buried inside `Statements > [expand statement] > transactions`.

**Comparison with Tally Prime:**
Tally's Gateway of India: `Vouchers (Purchase/Payment/Receipt/Journal) > Masters (Ledgers/Stock/Cost Centres) > Reports (Balance Sheet/P&L/Outstanding)`. The key insight: Tally separates *entry* (Vouchers), *reference data* (Masters), and *reporting* (Reports). BillForge conflates entry and reporting in the Overview tab, and has no Masters equivalent.

**Comparison with Zoho Books:**
Zoho's left sidebar: `Dashboard > Invoices > Payments Received > Expenses > Bills > Payments Made > Banking > Accountant > Reports`. Each workflow stage gets its own nav item.

**Recommendation:** Restructure navigation around workflow phases:
```
Dashboard | Inbox | Invoices | Vendors | Payments | Reconciliation | Exports | Settings
```
Where "Inbox" is the action-required queue (NEEDS_REVIEW + AWAITING_APPROVAL), "Vendors" is the vendor master with TDS tracking, and "Reconciliation" is a first-class destination.

### 2B. Invoice Lifecycle UX

The invoice status lifecycle is: `PENDING -> PARSED -> NEEDS_REVIEW -> AWAITING_APPROVAL -> APPROVED -> EXPORTED`, with failure branches `FAILED_OCR` and `FAILED_PARSE`.

**Status visibility:**
- The toolbar has status filter tabs (`TenantInvoicesToolbar.tsx` lines 132-143) with counts. This is good.
- Status icons are defined in `STATUS_ICONS` map (line 74-83 of ViewImpl) but these are only used in the table rows, not in a status progression visualization.
- The `ApprovalTimeline` component shows workflow step progression with dot indicators (done/current/pending/rejected/skipped). This is well-implemented but only visible in the popup detail view -- not in the side panel or the table.

**Problems:**
- There is no visual pipeline/funnel showing invoices flowing through stages. The Overview dashboard has a `StatusDonut` chart, but this is a snapshot, not a flow visualization.
- The user cannot see what action is needed at each state without opening the detail. The table row shows status as a CSS class (`status-approved`, `status-needs_review`) but no action hint. Zoho Books and Bill.com show the required action ("Review and Approve", "Waiting for John's approval") inline.
- Bulk operations are hidden in toolbar icon buttons (`approve`, `delete`, `retry`). The m13 plan mentions a "floating bulk action bar" (item 4) but it has not been implemented. The current icons with labels below are easy to miss.

**Recommendation:** Add an "action badge" to table rows. For `AWAITING_APPROVAL`, show "Approve (Step 2/3)". For `NEEDS_REVIEW`, show "Review: 2 risk signals". For `PARSED`, show "Ready for review". This turns the table from a data dump into a work queue.

### 2C. Data Entry & Editing

**Inline editing implementation:**
The `ExtractedFieldsTable` (lines 29-48) and `TenantInvoiceDetailPanel` (lines 86-115) both implement click-to-edit with a pencil icon, input field, and checkmark save button. Date fields use `type="date"` and text fields use `type="text"`. Enter commits, Escape cancels.

The `TenantInvoicesViewImpl` also supports inline editing in the table itself (`editingListCell` state at line 138), allowing users to edit vendor name, invoice number, and amount directly in the list view without opening the detail panel.

**Strengths:**
- Field-level source crops are shown alongside extracted values in `ExtractedFieldsTable`, letting the user compare the detected value against the original document.
- The `InvoiceSourceViewer` allows clicking field chips to highlight the source region on the document image. The bounding box overlay is computed from OCR coordinates.

**Problems:**
- No batch editing. If 10 invoices have the wrong vendor name "ACME" (should be "Acme Corp Ltd"), the user must edit each one individually.
- No undo/revert. Once a field is saved via `updateInvoiceParsedFields`, there is no way to restore the original OCR-detected value.
- The `confidence` column in the extracted fields table shows OCR confidence per field, but there is no visual link between low-confidence fields and the source crop. A low-confidence field should automatically expand its source crop for verification.
- GL code assignment is available as a dropdown in the table and in the `CompliancePanel`, but the dropdown (`GlCodeDropdown`) appears as a floating absolute-positioned panel (line 103 of `CompliancePanel.tsx`: `position: absolute; top: 1.5rem; left: 2rem`). This can be clipped by scroll containers.

**Recommendation:** Add a "Suggested corrections" feature -- when OCR confidence is below threshold, show the field pre-highlighted with the source crop expanded. Add batch field update for vendor name normalization.

### 2D. Reconciliation UX

The reconciliation system is built around bank statements (`BankStatementsTab.tsx`). The flow:
1. Upload bank statement (CSV/PDF/PNG/JPEG)
2. Backend parses transactions via SSE progress stream
3. View statement list with transaction counts
4. Expand statement to see transactions
5. Click "Reconcile" to auto-match
6. Review suggested matches (confirm/reject)
7. Manual link via `InvoiceSearchPicker` modal

**Strengths:**
- The `MatchStatusBadge` component clearly shows Matched/Suggested/Manual/Unmatched states with color coding.
- Transaction actions are contextual: suggested matches show confirm/reject buttons, matched transactions show an unlink button, unmatched debit transactions show a "Link Invoice" button.
- GSTIN mapping per statement allows scoping invoice search to the correct entity.
- Global filters (account name, date range, search, match status) enable cross-statement analysis.

**Problems:**
- **No split-pane reconciliation view.** Tally Prime's bank reconciliation shows bank entries and book entries side-by-side. Zoho Books' bank matching shows the bank transaction with a list of candidate invoices below it. BillForge forces the user to click "Link Invoice", which opens a full-screen modal (`InvoiceSearchPicker`) with a text search. There is no visual proximity between the bank entry and candidate invoices.
- **No amount difference explanation.** When a bank debit is INR 8,500 and the invoice is INR 10,000, the user sees both numbers but no explanation. Indian AP reconciliation commonly has TDS deductions (the bank pays invoice minus TDS). The system needs to show: "Invoice: 10,000 | TDS (194C @ 1%): 100 | Expected bank debit: 9,900 | Actual: 8,500 | Difference: 1,400."
- **No split mapping.** One bank transaction cannot be mapped to multiple invoices. One invoice cannot be mapped to multiple transactions. The API (`matchTransactionToInvoice`) is 1:1.
- **No reconciliation summary dashboard.** The "summary" (matched/suggested/unmatched counts) is per-statement. There is no cross-statement view: "this month, 85% reconciled, 12 pending, 3 discrepancies."

**Recommendation:** Build a dedicated Reconciliation tab with a two-column layout: bank transactions on the left, candidate invoices on the right with amount-difference breakdown and TDS explanation.

### 2E. Export & Tally Integration UX

**Export flow (from ViewImpl lines 870-903):**
1. Select exportable invoices (status APPROVED)
2. Click "Export Tally XML" (in the toolbar or via the `handleExport` function)
3. Backend generates XML, browser downloads the file
4. Export history shows in `ExportHistoryDashboard`

**TallyMappingTable** shows field-level mapping: Extracted Value -> Tally Field -> Mapped Value, with hints explaining Tally XML paths. This is visible in the popup detail but collapsed by default.

**Problems:**
- **No pre-export validation.** The user clicks "Export" and hopes everything is correct. There should be a pre-flight checklist: "3 invoices missing GL code", "1 invoice has no PAN", "vendor 'ACME' not in Tally vendor master."
- **No post-export feedback per voucher.** The export history (`ExportHistoryDashboard`) shows batch totals (success/failure counts) but no per-invoice breakdown. If 2 of 50 invoices failed, the user cannot see which ones without downloading and inspecting the XML.
- **Tally mapping is view-only.** The `TallyMappingTable` shows the mapping but the user cannot override individual mappings. If BillForge maps "CGST" to the wrong Tally ledger, the user must change the tenant-level Tally configuration, not fix it per invoice.
- **No Tally import confirmation.** After exporting XML and importing into Tally, there is no feedback loop. Bill.com and Xero have direct integrations that confirm import status. BillForge exports a file; the user imports it manually.

**Recommendation:** Add a "Pre-export checklist" modal that validates all selected invoices against Tally requirements (GL code assigned, vendor exists, PAN present if TDS-applicable). Show pass/fail per invoice with the option to exclude failing ones.

### 2F. Compliance & Risk Signals

**CompliancePanel** (`compliance/CompliancePanel.tsx`) shows:
- TDS section + rate + amount + net payable
- GL code with override dropdown
- PAN with L1/L2 validation badge
- Bank payment reconciliation status

**RiskSignalList** (`compliance/RiskSignalList.tsx`) shows severity-sorted risk signals with dismiss buttons. Signals are collapsible, defaulting to collapsed.

**Problems:**
- **Compliance data is buried in the detail panel.** The invoice table row shows: checkbox, filename, vendor, invoice#, date, amount, tax, status, confidence, GL, approver, actions. Compliance fields (TDS, PAN, risk signals) are not visible at the table level. An accountant must click each invoice to see compliance status.
- **Risk signals default to collapsed.** The `expanded` state defaults to `false` (line 21 of `RiskSignalList.tsx`). A critical risk signal on an invoice requiring review is hidden until the user clicks "expand." This defeats the purpose of risk signals.
- **No compliance summary column in the table.** There is no single icon/badge in the table row that summarizes "this invoice has 2 open risk signals, 1 critical." The `ConfidenceBadge` was meant to serve this purpose but is numerically opaque.
- **PAN validation levels (L1/L2) are not self-explanatory.** The labels "L1" and "L2" with hover tooltips are industry jargon that even accountants may not recognize. "Format valid" and "Matches GSTIN" would be clearer.

**Recommendation:** Add a "Risk" column to the invoice table that shows a colored dot (red/yellow/green) based on the highest-severity open risk signal. Expand risk signals by default when the invoice status is NEEDS_REVIEW. Replace L1/L2 with descriptive labels.

### 2G. Configuration UX

**TenantConfigTab** bundles 5 sections in a reorderable list:
1. Approval Workflow (`ApprovalWorkflowSection`)
2. GL Codes (`GlCodeManager`)
3. Compliance (TDS/PAN/Risk Signals via `ComplianceConfigPanel`)
4. TCS (`TcsConfigPanel`)
5. Users

**Strengths:**
- Drag-to-reorder via `useReorderableSections` with `drag_indicator` handles.
- Dirty state detection with save-only-when-changed pattern across all three compliance sub-panels.
- Reset-to-defaults for TDS sections.
- CSV import for GL codes with error reporting.
- TCS rate change history with audit trail.

**Problems:**
- **No progressive disclosure.** All sections render at full complexity. The compliance config panel alone is 583 lines with 22 state variables. New users see TDS sections, PAN validation levels, and risk signal checkboxes all at once.
- **No guided setup wizard.** When a new tenant is onboarded, they see the full config page. There is no "Getting Started" flow: "First, configure your TDS sections. Then add your GL codes. Finally, set up your approval workflow."
- **Config is siloed from its effect.** Changing a TDS rate does not show which existing invoices would be affected. Changing a GL code mapping does not preview the impact.
- **No import/export of configuration.** If a firm manages multiple tenants, they cannot clone configuration from one to another.

**Recommendation:** Add a setup wizard for new tenants with 4 steps: (1) Company details + currency, (2) TDS/TCS configuration, (3) GL code import, (4) Approval workflow. Show "affected invoices" count when changing compliance rules.

### 2H. Responsive & Accessibility

**Responsive:**
- The layout uses CSS grid (`content` class with `gridTemplateColumns`). The split between list panel and detail panel is user-adjustable via drag divider (`handleDividerMouseDown`).
- The toolbar has `flex-wrap` and the dropzone is responsive.
- The m12 memory notes "rem conversion (px to rem across all CSS)" and "mobile responsive" for the ingestion card.

**Problems:**
- The main layout (`layout` class) is `height: 100vh` with `overflow: hidden` -- this creates a rigid full-screen shell. On mobile, the detail panel becomes unusable.
- The invoice table has many columns (checkbox, file, vendor, invoice#, date, amount, tax, status, confidence, GL, approver, actions). On narrow screens, the horizontal scroll (`list-scroll`) is the only adaptation. There is no column prioritization or card view for mobile.
- No `@media` breakpoints were found for responsive table layout.

**Accessibility:**
- ARIA roles are used: `role="tablist"` on `TenantViewTabs`, `role="alertdialog"` and `aria-modal` on `ConfirmDialog`, `role="status"` and `aria-live="polite"` on `IngestionProgressCard`.
- Focus management: `ConfirmDialog` focuses the cancel button on open. `GlCodeDropdown` focuses the search input. Popup focuses via `popupRef.current?.focus()`.
- Keyboard navigation: full keyboard shortcut system.

**Problems:**
- Color-only differentiation for status badges (green/yellow/red confidence, green/amber/red risk signals). No pattern or icon differentiation for colorblind users.
- The status filter tabs in the toolbar use `className` toggling but no `aria-selected` attribute. The `role="tablist"` is on `TenantViewTabs` but not on the status filter row.
- No skip-to-content link.
- Inline styles are used extensively (especially in `ComplianceConfigPanel`, `GlCodeManager`, `BankConnectionsTab`). This makes it harder to ensure consistent color contrast across themes.

---

## 3. Competitive Comparison

### vs Tally Prime
| Feature | Tally Prime | BillForge | Gap |
|---------|------------|-----------|-----|
| Navigation | Gateway hierarchy (Vouchers > Masters > Reports) | Flat tab bar | BillForge lacks workflow-based hierarchy |
| Vendor master | First-class ledger accounts with full history | None | Critical gap for Indian market |
| Bank reconciliation | Split-pane with auto-date-matching | Statement-drill-down with search modal | BillForge lacks visual proximity |
| TDS compliance | Per-vendor cumulative tracking with threshold alerts | Per-invoice section assignment | No cumulative view, no threshold crossing alerts |
| Keyboard-first | All operations via keyboard from Gateway | j/k/Space/Enter/a/e shortcuts | BillForge is comparable for navigation |
| GST filing integration | Direct e-filing | None | Out of scope currently |

### vs Zoho Books
| Feature | Zoho Books | BillForge | Gap |
|---------|------------|-----------|-----|
| Navigation | Left sidebar with 15+ workflow categories | 6 flat tabs | BillForge needs more granular nav |
| Payment recording | Full payment-to-bill matching with partial payments | None | Critical gap for upcoming PRD |
| Banking module | Auto-imported bank feeds with rule-based matching | Manual upload + AI matching | BillForge has OCR advantage |
| Vendor portal | Self-service vendor onboarding and invoice submission | None | Future consideration |
| Multi-currency | Full with exchange rate management | Currency field on invoices but no rate management | Gap |

### vs Bill.com
| Feature | Bill.com | BillForge | Gap |
|---------|---------|-----------|-----|
| Inbox workflow | Dedicated inbox with smart routing | Invoice list with status filters | BillForge lacks "inbox" metaphor |
| Approval chains | Configurable with delegation | Configurable with conditions | Comparable |
| Payment execution | Direct ACH/check/wire payment | Export to Tally (manual payment) | Fundamental architecture difference |
| Audit trail | Full with IP/timestamp per action | Workflow step results with timestamps | BillForge is adequate |
| Sync status | Real-time with QuickBooks/Xero/Sage | Manual Tally XML import | Gap in feedback loop |

### vs ClearTax
| Feature | ClearTax | BillForge | Gap |
|---------|----------|-----------|-----|
| GST compliance | GSTR-1/2/3B auto-filing | GST field extraction only | ClearTax has filing; BillForge has extraction |
| TDS compliance | Section-wise filing with Form 26Q generation | Per-invoice TDS calculation with rates config | ClearTax has filing; BillForge has per-invoice |
| e-Invoice | IRN generation and QR validation | None | Gap |
| PAN validation | Database lookup | Format + GSTIN cross-reference | BillForge's L2 is good |

---

## 4. UX Requirements for Upcoming Features

### 4A. Payment Recording UX

**Context:** BillForge currently has no payment recording. Invoices go from APPROVED to EXPORTED. The PRD requires recording payments against invoices.

**Recommended design:**

**Partial payment entry:**
- Add a "Record Payment" button visible on APPROVED invoices in the detail panel (next to the existing "Approve" and "Reject" buttons at line 198-215 of `TenantInvoiceDetailPanel.tsx`)
- Payment form: Amount (default: net payable after TDS), Date, Payment Method (UPI/NEFT/RTGS/Cheque/Cash), Reference Number, Deducted TDS Amount (auto-calculated from compliance data), Notes
- Show remaining balance prominently: "Invoice: INR 1,00,000 | TDS: INR 1,000 | Already Paid: INR 50,000 | Remaining: INR 49,000"

**Payment-to-invoice mapping:**
- In the invoice detail panel, add a "Payment History" section below the existing `CompliancePanel` position
- Each payment row: Date, Amount, Method, Reference, Recorded By
- Visual: horizontal progress bar showing percentage paid

**Payment history per invoice:**
```
[Invoice Detail Panel]
  ...existing sections...
  
  Payment History
  +-----------+----------+--------+---------+-------------+
  | Date      | Amount   | Method | Ref     | By          |
  +-----------+----------+--------+---------+-------------+
  | 15-Apr-26 | 49,000   | NEFT   | UTR-123 | amit@co.in  |
  | 01-Apr-26 | 50,000   | NEFT   | UTR-098 | amit@co.in  |
  +-----------+----------+--------+---------+-------------+
  Total Paid: 99,000 / 99,000 (TDS: 1,000)  [FULLY PAID]
```

### 4B. Bank Reconciliation UX (Enhanced)

**Split mapping (one transaction -> many invoices):**
- Replace the current "Link Invoice" button with a "Split & Match" action
- Open a panel showing the bank transaction amount on top, and a list of candidate invoices below with checkboxes and individual allocation amounts
- Auto-suggest: if bank debit is INR 25,000 and there are 3 invoices from the same vendor totaling INR 25,000, pre-check all three
- Wireframe:
```
  Bank Transaction: INR 25,000  |  Vendor: Acme Corp
  ----------------------------------------
  [ ] INV-001  INR 10,000  Allocate: [10,000]
  [x] INV-002  INR  8,000  Allocate: [ 8,000]
  [x] INV-003  INR  7,000  Allocate: [ 7,000]
  ----------------------------------------
  Allocated: 15,000 / 25,000    Unallocated: 10,000
  [Save]  [Cancel]
```

**Aggregate mapping (many transactions -> one invoice):**
- For an invoice of INR 1,00,000 paid in installments, show all linked transactions
- Add "Link Additional Payment" to an already-partially-matched invoice
- Show cumulative matching progress on the invoice row

**Match confidence explanation:**
- When the system suggests a match, show *why*: amount proximity, date proximity, vendor GSTIN match, reference number match
- Show the TDS-adjusted expected amount: "Expected bank debit: INR 9,900 (invoice 10,000 minus 194C TDS INR 100). Actual: INR 9,900. Match: 100%"

### 4C. Vendor Management UX

**Vendor sync status indicator:**
Add a new "Vendors" tab between Invoices and Exports. The vendor list:
```
  Vendor Name        | PAN         | GSTIN           | TDS Section | Tally Status | Invoices
  Acme Corp Ltd      | AADCA1234K  | 06AADCA1234K1ZP | 194C        | Synced       | 12
  Beta Services      | BBBPB5678L  | -               | 194J        | Pending      | 3
  Gamma Traders      | -           | -               | -           | Not in Tally | 1
```
Status badges: "Synced" (green), "Pending" (amber, in Tally but fields mismatch), "Not in Tally" (gray, needs creation).

**Duplicate detection UI:**
When uploading an invoice with vendor name "ACME Corp" and the system already has "Acme Corp Ltd":
- Show a yellow banner in the detail panel: "Similar vendor found: Acme Corp Ltd (PAN: AADCA1234K). Use existing vendor?"
- Two buttons: "Use Acme Corp Ltd" (merges) and "Keep as new vendor"

**Vendor creation from invoice context:**
In the invoice detail panel, if vendor does not exist in vendor master:
- Show "New vendor" chip next to vendor name
- Click to open vendor creation form pre-filled with extracted PAN, GSTIN, address
- On save, auto-link the invoice to the new vendor record

### 4D. TDS Dashboard UX

**Cumulative TDS tracking per vendor:**
A new section in the Vendors tab (or a sub-tab):
```
  Vendor              | Section | FY Total   | Threshold  | YTD Deducted | Status
  Acme Corp Ltd       | 194C    | 12,50,000  | 30,000     | 12,500       | Above threshold
  Beta Services       | 194J    | 28,000     | 30,000     | 0            | Below threshold
  Gamma Traders       | 194H    | 1,45,000   | 50,000     | 1,450        | Above threshold
```

**Threshold crossing indicator:**
- When a vendor's YTD payments cross the TDS threshold, show a red alert badge on the vendor row and a notification toast
- In the Overview dashboard, add a KPI card: "TDS Threshold Crossings This Month: 3"

**TDS payment reconciliation:**
For each vendor, show TDS deducted vs TDS deposited (linked to bank transactions tagged as TDS payments):
```
  Acme Corp Ltd  |  194C
  Q1: Deducted 3,000  |  Deposited: 3,000  |  Balance: 0
  Q2: Deducted 4,500  |  Deposited: 0      |  Balance: 4,500 [DUE BY 7-Jul]
```

### 4E. Tally Integration UX

**Pre-export checklist:**
Before generating XML, show a modal:
```
  Pre-Export Validation  (15 invoices selected)
  
  [PASS] All invoices have GL codes assigned       15/15
  [PASS] All vendors have PAN numbers              15/15
  [FAIL] 2 vendors not in Tally vendor master      13/15
         - "New Vendor LLC" (INV-045)
         - "Fresh Supplies" (INV-051)
  [WARN] 1 invoice has unresolved risk signals      14/15
         - INV-023: DUPLICATE_AMOUNT (warning)
  
  [Export 13 valid]  [Export all 15]  [Cancel]
```

**Export progress indicator:**
Replace the current instant-download with a progress view for large batches:
```
  Generating Tally XML...  [=========>     ] 67%
  Processing: INV-034 (34 of 50)
  Successful: 33  |  Failed: 1  |  Remaining: 16
```

**Post-export verification:**
In `ExportHistoryDashboard`, add an expandable per-invoice breakdown:
```
  Batch 2026-04-16 14:30  |  50 total  |  48 success  |  2 failed
  [Expand]
    INV-045: FAILED - Vendor "New Vendor LLC" not found in Tally master
    INV-051: FAILED - Missing GL code
    INV-001: SUCCESS - Voucher #TM-2026-001
    ...
```

---

## 5. Design Recommendations

### Quick Wins (less than 1 day each)

1. **Expand risk signals by default for NEEDS_REVIEW invoices.** In `TenantInvoiceDetailPanel.tsx`, initialize `RiskSignalList` expanded when `invoice.status === "NEEDS_REVIEW"`. Change: pass `defaultExpanded={invoice.status === "NEEDS_REVIEW"}` prop.

2. **Add risk indicator column to invoice table.** In the table header/rows of `TenantInvoicesViewImpl.tsx`, add a column that shows a colored dot based on `invoice.compliance?.riskSignals` max severity. Red dot for critical, amber for warning, green for clean.

3. **Replace PAN L1/L2 labels with descriptive text.** In `CompliancePanel.tsx` lines 132-143, change "L1" to a checkmark with "Format valid" and "L2" to a double-checkmark with "GSTIN cross-checked."

4. **Default to "Invoices" tab instead of "Overview".** In the `useTenantWorkspace` hook, set `activeTab: "dashboard"` as default for non-admin users. The Overview is a reporting view; the Invoices tab is the workspace.

5. **Show action hint in status badge.** In the table row, append action text to status: "Awaiting Approval (Step 2)" or "Needs Review (2 signals)". Use existing `workflowState.currentStep` and `compliance.riskSignals.length`.

6. **Add `aria-selected` to status filter tabs.** In `TenantInvoicesToolbar.tsx`, add `role="tab"` and `aria-selected={status === statusFilter}` to each status button.

### Medium Effort (1-3 days each)

7. **Build an "Action Required" queue.** New component that filters invoices to NEEDS_REVIEW + AWAITING_APPROVAL, sorted by age (oldest first). Show as the default view when navigating to the Invoices tab. Include a count in the tab label: "Invoices (12)".

8. **Add pre-export validation modal.** Before calling `generateTallyXmlFile`, iterate selected invoices client-side and check: GL code present, vendor PAN present (if TDS enabled), no critical risk signals. Show pass/fail per invoice in a checklist dialog.

9. **Build a payment recording form.** Add a "Record Payment" section to `TenantInvoiceDetailPanel`. New API endpoint `POST /invoices/:id/payments`. Form fields: amount, date, method, reference, TDS deducted. Show payment history below.

10. **Add vendor name normalization UI.** When multiple invoices have similar vendor names (Levenshtein distance < 3), show a merge suggestion banner: "3 invoices have vendor 'ACME Corp'. Merge with existing 'Acme Corp Ltd'?"

11. **Build a reconciliation split-pane view.** New `ReconciliationTab` component with left panel showing unmatched bank transactions and right panel showing candidate invoices with amount-difference breakdown and TDS explanation.

12. **Add TDS cumulative tracking to the Overview dashboard.** New KPI card showing FY-to-date TDS deducted per section with threshold crossing count. Pull from a new analytics endpoint.

### Major Redesigns (1+ week each)

13. **Restructure navigation to workflow-based hierarchy.** Replace the current 6-tab structure with an 8-item sidebar: Dashboard, Inbox, Invoices, Vendors, Payments, Reconciliation, Exports, Settings. This requires refactoring `App.tsx` routing, `TenantViewTabs.tsx`, and splitting `TenantConfigTab` into a dedicated Settings section.

14. **Build a Vendor Master module.** New `VendorsTab` with: vendor list with search/filter, vendor detail page (all invoices, TDS history, bank details, Tally sync status), vendor creation from invoice context, duplicate detection, and merge functionality.

15. **Implement a TDS Dashboard.** Dedicated view showing: per-vendor cumulative TDS, threshold tracking, quarterly payment schedule, Form 26Q data preview. This requires backend aggregation endpoints and a new chart-heavy frontend component.

16. **Redesign the compliance data presentation.** Per `feedback_confidence_score_overhaul.md`: move TDS/GL/PAN/risk signals from the detail panel into the table as first-class columns. Replace the confidence badge as the primary signal with a composite "compliance status" indicator. This is a structural change to the table schema and requires responsive design consideration for the additional columns.

---

## 6. Wireframe Specifications

### 6A. Action Required Queue (Quick Win #7)

```
+-----------------------------------------------------------+
| INBOX (12 items need attention)                           |
+-----------------------------------------------------------+
| [Needs Review - 8]  [Awaiting Approval - 4]  [All - 12]  |
+-----------------------------------------------------------+
| # | Vendor        | Amount    | Age  | Risk    | Action   |
+---+---------------+-----------+------+---------+----------+
| 1 | Acme Corp     | 1,25,000  | 5d   | !! CRIT | [Review] |
| 2 | Beta LLC      | 45,000    | 3d   | ! WARN  | [Review] |
| 3 | Gamma Inc     | 8,50,000  | 1d   | OK      | [Approve]|
| 4 | Delta Co      | 12,000    | 1d   | OK      | [Approve]|
+---+---------------+-----------+------+---------+----------+
```

### 6B. Pre-Export Validation Modal

```
+--------------------------------------------------+
|  Pre-Export Validation  (15 invoices)             |
+--------------------------------------------------+
|                                                    |
|  [PASS] GL codes assigned              15/15      |
|  [PASS] Vendor PAN present             15/15      |
|  [FAIL] Vendor exists in Tally         13/15      |
|         > New Vendor LLC (INV-045)                |
|         > Fresh Supplies (INV-051)                |
|  [WARN] Risk signals unresolved         1/15      |
|         > INV-023: DUPLICATE_AMOUNT               |
|                                                    |
|  [Export 13 valid]  [Export all 15]  [Cancel]     |
+--------------------------------------------------+
```

### 6C. Payment Recording in Detail Panel

```
+--------------------------------------------------+
|  Payment History                                  |
+--------------------------------------------------+
|  Invoice Total: INR 1,00,000                      |
|  TDS (194C @ 1%): INR 1,000                      |
|  Net Payable: INR 99,000                          |
|                                                    |
|  [====================>     ] 75% paid            |
|                                                    |
|  15-Apr  INR 50,000  NEFT  UTR-123  amit@co      |
|  01-Apr  INR 24,000  NEFT  UTR-098  amit@co      |
|  -----------------------------------------------  |
|  Paid: 74,000 | Remaining: 25,000                 |
|                                                    |
|  [+ Record Payment]                               |
|    Amount: [25,000]  Date: [2026-04-16]           |
|    Method: [NEFT v]  Ref: [UTR-456]              |
|    TDS Deducted: [0]                              |
|    [Save Payment]  [Cancel]                       |
+--------------------------------------------------+
```

### 6D. Reconciliation Split Pane

```
+-------------------------------+---------------------------+
| BANK TRANSACTIONS             | CANDIDATE INVOICES        |
+-------------------------------+---------------------------+
| 15-Apr  Acme Corp  -25,000   | INV-001  Acme  10,000    |
| [Unmatched]                   | INV-002  Acme   8,000    |
|                               | INV-003  Acme   7,000    |
|                               |                           |
| Amount difference:            | Total: 25,000             |
| Bank: 25,000                  | TDS: 0                    |
| Invoices: 25,000              | Expected: 25,000          |
| Diff: 0 (exact match)        | [Match All 3]             |
|                               |                           |
+-------------------------------+---------------------------+
| 10-Apr  Beta Svc   -9,900    | INV-010  Beta  10,000    |
| [Suggested 95%]               |                           |
|                               | TDS (194J @ 10%): 1,000  |
| Bank: 9,900                   | Expected: 9,000           |
| Expected: 9,000               | Diff: +900               |
| Diff: +900 (overpayment?)    | [Confirm]  [Reject]       |
+-------------------------------+---------------------------+
```

### 6E. Vendor Detail Page

```
+--------------------------------------------------+
| ACME CORP LTD                      [Edit] [Sync] |
+--------------------------------------------------+
| PAN: AADCA1234K (Valid)   GSTIN: 06AADCA1234K1ZP |
| TDS Section: 194C         Tally Status: [Synced]  |
| Bank: HDFC ***4567        Contact: ar@acme.co.in  |
+--------------------------------------------------+
| [Invoices - 12]  [TDS History]  [Payments]        |
+--------------------------------------------------+
|                                                    |
| TDS Summary (FY 2025-26)                          |
| Threshold: INR 30,000   YTD Paid: INR 12,50,000  |
| TDS Deducted: INR 12,500  Deposited: INR 9,000   |
| Balance Due: INR 3,500   Due By: 7-Jul-2026      |
|                                                    |
| Recent Invoices                                    |
| INV-045  15-Apr  INR 1,25,000  Approved  Paid    |
| INV-038  01-Apr  INR 85,000    Exported  Partial |
| INV-029  15-Mar  INR 1,50,000  Exported  Paid    |
+--------------------------------------------------+
```

---

### Critical Files for Implementation
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/frontend/src/App.tsx` - Central routing and tab management; must be restructured for new navigation architecture
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/frontend/src/features/tenant-admin/TenantInvoicesViewImpl.tsx` - Largest component (1150+ lines); owns the invoice table, selection, actions, and detail panel orchestration; needs risk column, action hints, and payment recording
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/frontend/src/features/tenant-admin/BankStatementsTab.tsx` - Current reconciliation UI; must be replaced/augmented with split-pane reconciliation view and TDS-aware amount matching
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/frontend/src/components/compliance/CompliancePanel.tsx` - Compliance data presentation; needs redesign to surface TDS/PAN/GL as primary review signals per the confidence score overhaul plan
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/frontend/src/features/tenant-admin/TenantViewTabs.tsx` - Tab navigation component; must be replaced with workflow-based sidebar navigation when restructuring information architecture
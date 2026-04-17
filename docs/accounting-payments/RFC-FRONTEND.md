# BillForge Frontend UX RFC

## 1. RFC Metadata

- **Title**: BillForge Frontend UX Redesign -- Navigation, Invoice Workflows, Vendor Management, TDS Dashboard, Tally Export & Reconciliation
- **Date**: 2026-04-16
- **Status**: Draft
- **Authors**: Frontend Engineering Team
- **Depends On**: [PRD.md](./PRD.md) (v1.2), [MASTER-SYNTHESIS.md](./MASTER-SYNTHESIS.md), [UX-AUDIT-REPORT.md](./input/UX-AUDIT-REPORT.md)
- **Scope**: All frontend changes required for Phases 0-6 of the accounting, payments, and Tally integration roadmap
- **Last Updated**: 2026-04-17 (aligned to PRD v1.2)

---

## 2. Executive Summary

This RFC specifies the complete frontend redesign for BillForge, covering navigation restructuring, invoice table enrichments, payment recording UI, compliance data presentation, vendor management, TDS dashboard, Tally export validation, reconciliation redesign, and tenant onboarding. It consolidates findings from four independent design workstreams into a single implementation plan.

**Key outcomes:**

1. **Navigation evolves from 6 flat tabs to 8-item sidebar** organized around accountant workflows (Dashboard, Inbox, Invoices, Vendors, Payments, Reconciliation, Exports, Settings), delivered incrementally across three phases.
2. **Seven quick-win UX changes** (risk signal expansion, risk dot column, PAN label fix, action hints, ARIA fixes, action queue, pre-export validation) ship immediately with zero backend dependency.
3. **Payment recording UI** supports single-invoice, multi-invoice, advance, and reversal flows with per-method validation and TDS-adjusted breakdowns.
4. **Vendor Management tab** introduces a first-class vendor master with CRUD, merge, TDS history, MSME tracking, and Section 197 certificate management.
5. **TDS Dashboard** provides cumulative threshold tracking, per-section breakdown, and 26Q export preparation.
6. **Tally export UX** adds pre-export validation, per-invoice batch detail, export progress, and payment voucher export.
7. **Reconciliation redesign** introduces a split-pane view with split/aggregate matching, match confidence visualization, and TDS-adjusted amount explanation.
8. **New shared component library** (Section 14) defines 25+ reusable components used across all feature areas.
9. **GL Code Auto-Suggestion UX** (Added per PRD v1.2) provides vendor-history-based GL code suggestions with confidence scoring, alternative suggestions, and progressive learning feedback.
10. **Vendor Communication UI** (Added per PRD v1.2) supports templated email draft generation for compliance issues (missing PAN, IRN, bank changes, invalid GSTIN) with preview-before-send flow.
11. **Tally Mapping Preview** (Added per PRD v1.2) provides a field-by-field mapping table (Detected Value, Tally Field, Export Value) inline in the pre-export flow.
12. **CSV Export** (Added per PRD v1.2) adds a CSV export button alongside Tally XML export for non-Tally accounting systems.
13. **8-Role UI Visibility Matrix** (Added per PRD v1.2) extends role-based UI gating from 4 roles to 8 firm-specific roles (Firm Partner, Tenant Admin, Senior Accountant, CA, Tax Specialist, AP Clerk, IT/Ops Admin, Audit Clerk).
14. **Confidence Score Breakdown** (Added per PRD v1.2) surfaces the 65% OCR / 35% completeness formula as a tooltip on the detail panel.
15. **New Risk Signal UI Treatments** (Added per PRD v1.2) adds visual treatments for 4 new fraud/financial risk signals.

**Total estimated effort**: 62-93 engineering days across 7 delivery phases (implementation: ~62d, testing: ~31d; see Section 17 for breakdown).

---

## 3. Current State Analysis

### 3.1 Tab Structure

The navigation is a flat horizontal tab bar rendered by `TenantViewTabs` (`frontend/src/features/tenant-admin/TenantViewTabs.tsx`). The `TenantViewTab` type is defined as a union in `frontend/src/types.ts`:

```
"overview" | "dashboard" | "config" | "exports" | "statements" | "connections"
```

The visible tabs depend on role-based capability flags:

| Tab Label | Internal Key | Visible To | Content Component |
|---|---|---|---|
| Overview | `overview` | All roles | `OverviewDashboard` |
| Invoices | `dashboard` | All roles | `TenantInvoicesView` (wraps `TenantInvoicesViewImpl`) |
| Exports | `exports` | All roles | `ExportHistoryDashboard` |
| Statements | `statements` | `canViewConnections` only | `BankStatementsTab` |
| Tenant Config | `config` | `canViewConfig` only | `TenantConfigTab` |
| Connections | `connections` | `canViewConnections` only | `BankConnectionsTab` |

A MEMBER role user sees only three tabs (Overview, Invoices, Exports). A VIEWER sees the same three but with write actions hidden. An admin sees all six. The naming mismatch between internal keys and display labels (e.g., `dashboard` renders as "Invoices") is a maintenance hazard that should be corrected during the restructure.

### 3.2 Layout System

The primary layout is a `height: 100vh` flex-column container (`.layout` class in `frontend/src/styles.css`, line 248) with `overflow: hidden`. The invoice workspace uses a CSS grid (`.content` class, line 1252):

```css
.content {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(22.5rem, 1fr);
}
```

When the detail panel is open, `TenantInvoicesViewImpl` overrides the grid with an inline style: `gridTemplateColumns: ${listPanelPercent}% 6px 1fr` (line 495), where the 6px column is the draggable divider. The `listPanelPercent` value persists to `localStorage` under `billforge:panel-split` (default 58%). Dragging is implemented via raw `mousemove`/`mouseup` event listeners in `handleDividerMouseDown` (lines 564-588), clamped between 25% and 75%.

### 3.3 Current Responsive Behavior

Three media breakpoints exist:

| Breakpoint | What Changes | What Breaks |
|---|---|---|
| `max-width: 980px` (line 2844) | Layout switches to `height: auto`, grid collapses to `1fr`, top nav stacks vertically | Detail panel stacks below list panel with no way to toggle. Both panels render full-width, doubling page height. The draggable divider becomes meaningless. |
| `max-width: 640px` (line 3640) | Tab bar becomes horizontally scrollable, nav stats hidden, smaller font sizes | Invoice table columns remain unchanged -- horizontal scroll is the only adaptation. No column prioritization. No card view. The table with 11+ columns is unusable on phone screens. |
| `min-width: 1441px` (line 3885) | Layout max-width adjustments | N/A |

Critical responsive gaps:
- The invoice table has no `@media`-driven column hiding or responsive card layout.
- The detail panel on mobile renders below the list with no overlay/drawer pattern -- it simply appends, pushing the list panel off-screen.
- The `TenantConfigTab` sections render at full width with no responsive adaptation for their internal form grids.
- The draggable panel divider has no touch event support (`onTouchStart`/`onTouchMove`/`onTouchEnd`) -- it silently breaks on mobile.

### 3.4 Invoice Table State

The current table header (line 1274 of `TenantInvoicesViewImpl.tsx`) defines 13+ data columns:

```
Checkbox | File | Vendor | Invoice # | Invoice Date | Total | Tax | GL Code | TDS | Signals | Score | Status | Approved By | Received | Actions
```

Compliance data (TDS, PAN, risk signals) is only visible in the detail panel. An accountant must click each invoice to discover compliance issues. The `ConfidenceBadge` is a numeric score that "whitewashes compliance data behind a number" (per `feedback_confidence_score_overhaul.md`).

### 3.5 Reconciliation State

The reconciliation system in `BankStatementsTab.tsx` (1003 lines) is statement-centric:
1. Upload bank statement (CSV/PDF/PNG/JPEG)
2. View statements as expandable table rows
3. Expand a statement to see transactions
4. Click "Reconcile" to trigger server-side auto-matching
5. Suggested matches show confirm/reject buttons
6. Manual matching opens `InvoiceSearchPicker` -- a full-screen modal with text search

Problems: no split-pane view, no amount difference explanation (TDS deductions), 1:1 mapping only (no split/aggregate), no reconciliation summary dashboard.

### 3.6 Export State

The export flow is `select invoices -> Export Tally XML -> download file`. No pre-export validation checklist, no per-invoice breakdown in export history, no payment voucher export. The `TallyMappingTable` exists in the popup detail but is collapsed by default.

### 3.7 Configuration State

`TenantConfigTab` bundles 5 heterogeneous sections (Approval Workflow, GL Codes, Compliance, TCS, Users) with no progressive disclosure, no guided setup wizard, and no impact preview when changing rules. The compliance config panel alone is 583 lines with 22 state variables.

### 3.8 What Works Well (Preserve)

1. **Keyboard shortcuts system** (`useKeyboardShortcuts` hook) -- j/k navigation, Space selection, `a` approve, `e` export, `?` help overlay.
2. **Draggable panel split** with `localStorage` persistence -- correct UX pattern for desktop.
3. **Column resize persistence** (`handleColumnResize`, storing to `billforge:col-widths`) -- a power-user feature competitors lack.
4. **Status filter tabs with counts** in `TenantInvoicesToolbar` -- effective pattern to replicate in new tabs.
5. **Reorderable config sections** (`useReorderableSections` hook).
6. **Theme toggle** (dark/light) with CSS custom properties throughout.
7. **Toast notification system** (`useToast` hook + `ToastContainer`).
8. **Source preview with bounding-box highlighting** -- clicking a field chip shows the OCR crop inline.
9. **Approval workflow builder** with simple/advanced modes and progressive disclosure.

---

### 3.9 Prerequisites: Hook Extraction from TenantInvoicesViewImpl

**Blocking requirement**: Before any new column or feature is added to `TenantInvoicesViewImpl`, the existing 30+ `useState` calls must be extracted into focused hooks. This prevents the component from becoming unmaintainable as new columns (Risk, Payment, Aging) and features (pre-export validation, action queue) are added.

**Required hooks:**

```typescript
interface UseInvoiceTableStateReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  selectedIds: Set<string>;
  activeInvoiceId: string | null;
  page: number;
  pageSize: number;
  totalCount: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (field: string, dir: "asc" | "desc") => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setActiveInvoice: (id: string | null) => void;
  refetch: () => void;
}

interface UseInvoiceFiltersReturn {
  statusFilter: string;
  searchQuery: string;
  dateRange: { from: string | null; to: string | null };
  approvedByFilter: string | null;
  setStatusFilter: (status: string) => void;
  setSearchQuery: (query: string) => void;
  setDateRange: (range: { from: string | null; to: string | null }) => void;
  setApprovedByFilter: (userId: string | null) => void;
  activeFilterCount: number;
  clearAllFilters: () => void;
}
```

`useInvoiceTableState` owns fetching, pagination, selection, sorting, and active row state. `useInvoiceFilters` owns all filter dimensions. Both hooks are consumed by `TenantInvoicesViewImpl`, which becomes a thin rendering shell. This extraction is Phase 0a work (2 days) and must complete before QW-2 (Risk column) begins.

---

## 4. Quick Win UX Changes

All quick wins are immediate, require no structural change, and have zero or minimal backend dependency. They can ship in a single sprint.

### QW-1: Risk Signals Expanded by Default for NEEDS_REVIEW

- **Component**: `frontend/src/components/compliance/RiskSignalList.tsx`
- **Current behavior**: `expanded` initializes to `false` unconditionally (line 21). Risk signals are always collapsed, even for invoices requiring review.
- **New behavior**: When the invoice status is `NEEDS_REVIEW`, risk signals render expanded by default. All other statuses retain collapsed default.
- **Implementation**:
  1. Add a `defaultExpanded` prop to `RiskSignalListProps`.
  2. Change state initialization: `const [expanded, setExpanded] = useState(defaultExpanded ?? false);`
  3. In `TenantInvoiceDetailPanel.tsx`, pass `defaultExpanded={invoice.status === "NEEDS_REVIEW"}`.
  4. In `InvoiceDetailPage.tsx`, apply the same prop.
- **Effort**: 1 hour

### QW-2: Risk Indicator Column (Colored Dot) in Invoice Table

- **Component**: `frontend/src/features/tenant-admin/TenantInvoicesViewImpl.tsx`
- **Current behavior**: No column summarizes risk signal status. The only risk visibility is the `ConfidenceBadge` and the collapsed `RiskSignalList` in the detail panel.
- **New behavior**: A new "Risk" column appears between the Status and Confidence columns. It renders a `RiskDot` component (see Section 14.1) -- a colored dot (red = critical, amber = warning, green = clean, gray = no data) with an adjacent count for non-zero signals.
- **Implementation**: Add `<th>Risk</th>` header and `<td><RiskDot riskSignals={invoice.compliance?.riskSignals} /></td>` in the table row, positioned after the status column. Add SVG icon fallback for colorblind users (see Section 16.2).
- **Effort**: 3 hours

### QW-3: PAN Label Clarification (L1/L2 to Descriptive)

- **Component**: `frontend/src/components/compliance/CompliancePanel.tsx`
- **Current behavior**: Lines 132-136 render PAN validation as `"L1"` or `"L2"` with title-tooltip hover text. These are internal engineering jargon.
- **New behavior**: `L1` becomes a checkmark icon followed by "Format valid". `L2` becomes a double-checkmark icon followed by "GSTIN verified".
- **Implementation**: Replace the L1/L2 rendering with:
  ```typescript
  {compliance.pan.validationResult === "valid" && (
    <span style={{ color: "var(--color-success)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
      <span className="material-symbols-outlined" style={{ fontSize: "0.9rem" }}>
        {compliance.pan.gstinCrossRef ? "done_all" : "done"}
      </span>
      {compliance.pan.gstinCrossRef ? "GSTIN verified" : "Format valid"}
    </span>
  )}
  ```
- **Effort**: 30 minutes

### QW-4: Action Hints in Status Badges

- **Component**: `frontend/src/features/tenant-admin/TenantInvoicesViewImpl.tsx`
- **Current behavior**: Status badges show only the status label with no indication of what action the user should take.
- **New behavior**: Status badges include contextual action hints via the `ActionHintBadge` component (see Section 14.6):

| Status | New Display |
|--------|-------------|
| `AWAITING_APPROVAL` (current user is designated approver) | `Awaiting your approval` |
| `AWAITING_APPROVAL` (other users) | `Awaiting approval` |
| `NEEDS_REVIEW` | `Review: 2 signals` (if risk signals exist) |
| `PARSED` | `Ready` |
| `APPROVED` (partially_paid) | `Approved -- 75% paid` |
| `EXPORTED` | `Exported` |
| `FAILED_OCR` | `Failed: OCR` |

Step numbering (e.g., "Step 2/3") is shown only in the detail panel's approval section, not in the table badge. Table badges focus on actionability ("Awaiting your approval") rather than workflow position.

- **Effort**: 2 hours

### QW-5: ARIA Accessibility Fixes (aria-selected)

- **Components**: `TenantViewTabs.tsx`, `TenantInvoicesToolbar.tsx`
- **Current behavior**: Tab buttons lack `role="tab"` and `aria-selected`. Status filter buttons have no ARIA attributes.
- **New behavior**: Both tab systems conform to the WAI-ARIA Tabs pattern with `role="tab"`, `aria-selected`, and roving tabindex. Arrow-key navigation between tabs via a shared `useRovingTabIndex` hook.
- **Effort**: 2 hours

### QW-6: Action Required Queue Component

- **Component**: New `frontend/src/features/tenant-admin/ActionRequiredQueue.tsx`
- **Current behavior**: No "inbox" or "action required" view. Accountants must navigate to Invoices and set the status filter manually.
- **New behavior**: A new `ActionRequiredQueue` component renders above the invoice table (when `statusFilter === "ALL"` and actionable items exist). Shows invoices with status `NEEDS_REVIEW` or `AWAITING_APPROVAL`, sorted by age (oldest first). Each row shows: vendor name, amount, age badge, `RiskDot`, and a primary action button.
- **Implementation**: The component makes its own API call (`GET /api/invoices?status=NEEDS_REVIEW,AWAITING_APPROVAL&sort=createdAt&limit=20`) for a complete count, independent of the invoice table's pagination. Integrated into `TenantInvoicesViewImpl.tsx` with a dismissible toggle persisted to `localStorage` (`billforge:show-action-queue`). Pre-Phase 3, it renders inline; in Phase 3, it becomes the dedicated Inbox tab.
- **Effort**: 10-14 hours

### QW-7: Pre-Export Validation Modal

- **Component**: New `frontend/src/features/tenant-admin/PreExportValidationModal.tsx`
- **Current behavior**: Clicking "Export Tally XML" calls `generateTallyXmlFile` immediately with no validation.
- **New behavior**: Clicking "Export" opens a validation modal that runs client-side checks on all selected invoices before allowing export. If all checks pass with zero failures and zero warnings, the modal is skipped.

**Validation checks (client-side, no API calls needed):**

| # | Check | Data Source | Result |
|---|-------|-------------|--------|
| 1 | GL code assigned | `invoice.compliance?.glCode?.code` | PASS if non-null, FAIL if null |
| 2 | Vendor PAN present | `invoice.compliance?.pan?.value` | PASS if non-null or if TDS section is null. FAIL if TDS section set but PAN missing |
| 3 | No critical risk signals | `invoice.compliance?.riskSignals` filtered to `severity === "critical"` and `dismissed !== true` | PASS if zero critical undismissed. WARN if one or more |
| 4 | Amount arithmetic | `parsed.gst.subtotalMinor + parsed.gst.totalTaxMinor === parsed.totalAmountMinor` | PASS if equal or GST absent. WARN if mismatch > Rs 1 (100 minor units) |

**Wireframe:**

```
+------------------------------------------------------------------+
|  Pre-Export Validation                     15 invoices selected   |
+------------------------------------------------------------------+
|                                                                    |
|  [checkmark] GL codes assigned                         15 / 15    |
|  [checkmark] Vendor PAN present (TDS-applicable)       15 / 15    |
|  [X]         Vendors exist in Tally                    13 / 15    |
|              [v] Expand 2 failures                                |
|              +------------------------------------------------+   |
|              | INV-045  New Vendor LLC     Not in Tally master |   |
|              | INV-051  Fresh Supplies     Not in Tally master |   |
|              +------------------------------------------------+   |
|  [!]         Risk signals unresolved                    1 / 15    |
|              [v] Expand 1 warning                                 |
|              +------------------------------------------------+   |
|              | INV-023  Gamma Traders      DUPLICATE_AMOUNT    |   |
|              +------------------------------------------------+   |
|                                                                    |
+------------------------------------------------------------------+
|  [Export 13 valid]       [Export all 15]            [Cancel]       |
+------------------------------------------------------------------+
```

**Integration**: In `TenantInvoicesViewImpl.tsx`, the current `handleExport()` function is modified to `setShowPreExportModal(true)`. The modal's callbacks invoke the existing `generateTallyXmlFile` + `downloadTallyXmlFile` flow.

**Component interface:**

```typescript
interface PreExportValidationModalProps {
  invoices: Invoice[];
  onExportValid: (invoiceIds: string[]) => void;
  onExportAll: (invoiceIds: string[]) => void;
  onCancel: () => void;
}
```

- **Effort**: 10-14 hours

---

## 5. Navigation Restructure

### 5.1 Target State

Replace the current 6-item flat tab bar with an 8-item sidebar navigation:

| # | Label | Route Key | Source |
|---|---|---|---|
| 1 | Dashboard | `dashboard` | Existing `OverviewDashboard` (renamed from `overview`) |
| 2 | Inbox | `inbox` | New `ActionRequiredQueue` (promoted from inline to full tab) |
| 3 | Invoices | `invoices` | Existing `TenantInvoicesView` (key renamed from `dashboard`) |
| 4 | Vendors | `vendors` | New `VendorListView` / `VendorDetailView` (Section 9) |
| 5 | Payments | `payments` | New `PaymentsTab` |
| 6 | Reconciliation | `reconciliation` | Evolved from `BankStatementsTab` (Section 12) |
| 7 | Exports | `exports` | Existing `ExportHistoryDashboard` (Section 11) |
| 8 | Settings | `settings` | Existing `TenantConfigTab` + `BankConnectionsTab` merged (Section 13) |

Admin-only items: Settings tab shows all sections for TENANT_ADMIN; for MEMBER, it shows only user-facing preferences. VIEWER sees all tabs in read-only mode.

### 5.1.1 Progressive Navigation Disclosure

To avoid overwhelming small-team users with 8 navigation items from day one, tabs appear progressively based on tenant data milestones:

| Tab | Visible When | Fallback |
|-----|-------------|----------|
| Dashboard | Always | Core tab |
| Invoices | Always | Core tab |
| Exports | Always | Core tab |
| Settings | Always | Core tab |
| Vendors | `vendorCount > 0` (at least one vendor auto-created from invoice processing) | Hidden until first vendor exists |
| Payments | At least one invoice has status `APPROVED` or `EXPORTED` | Hidden until first approvable invoice |
| Reconciliation | At least one bank statement uploaded | Hidden until first statement |
| Inbox | `actionRequiredCount > 0` (at least one NEEDS_REVIEW or AWAITING_APPROVAL invoice) | Hidden; action items shown inline on Dashboard |

**Implementation**: The `NavCountsContext` (Section 5.5) provides the counts. Tab visibility is computed in `TenantViewTabs.tsx`:

```typescript
const visibleTabs = useMemo(() => {
  const tabs: TenantViewTab[] = ["dashboard", "invoices", "exports", "settings"];
  if (counts.vendors > 0) tabs.splice(3, 0, "vendors");
  if (counts.approvableInvoices > 0) tabs.splice(tabs.indexOf("exports"), 0, "payments");
  if (counts.bankStatements > 0) tabs.splice(tabs.indexOf("exports"), 0, "reconciliation");
  if (counts.inbox > 0) tabs.splice(1, 0, "inbox");
  return tabs;
}, [counts]);
```

New tenants see only 4 tabs. As they process invoices and configure integrations, the navigation grows organically. This replaces the "8-item sidebar from day one" approach in the target state table above; the target state shows the maximum tab set for a fully-configured tenant.

### 5.2 Migration Strategy: Incremental, Not Big-Bang

**Phase 1 (with backend Phase 2): Add Vendors tab**
1. Update `TenantViewTab` type in `types.ts`: add `"vendors"` to the union.
2. Add a "Vendors" button to `TenantViewTabs.tsx` between Invoices and Exports.
3. Create `VendorListView` and `VendorDetailView` (see Section 9).
4. In `App.tsx`, add the conditional render: `{activeTab === "vendors" && <VendorsTab />}`.
5. No other tabs change. The tab bar grows from 6 to 7 items.

**Phase 2 (with backend Phase 3): Add Payments tab + Reconciliation extraction**
1. Add `"payments"` and `"reconciliation"` to `TenantViewTab`.
2. Add "Payments" tab -- initially shows a placeholder `EmptyState` with "Payment recording coming soon."
3. Rename "Statements" tab to "Reconciliation". Wrap existing statement functionality with the new `ReconciliationSplitPane` (Section 12).
4. The tab bar grows to 8 items.

**Phase 3 (Post-MVP): Convert tab bar to sidebar navigation**
1. Replace `TenantViewTabs` with `TenantSidebar` (see Section 14.8).
2. Layout restructure in `App.tsx`: change `.layout` to CSS grid `grid-template-columns: auto 1fr`.
3. Sidebar: 14rem expanded, 3.5rem collapsed. Collapse state persists to `localStorage`.
4. On mobile (< 980px), sidebar becomes a fixed-bottom tab bar with icons only.

### 5.3 Routing Changes

Currently `App.tsx` uses `activeTab` state with conditional rendering -- no URL-based routing. In Phase 3, migrate to hash-based routing (`#/invoices`, `#/vendors`) for deep-linking support without adding a router dependency.

**Scoping decision**: Hash routing handles **top-level tabs only**. Sub-views within a tab (vendor detail sub-tabs, TDS dashboard toggle within Vendors tab, reconciliation split/aggregate mode) are managed by **component-local state**, not by hash fragments. This avoids the composition problems of nested hash routes. Deep-linking for sub-views (e.g., `#/vendors/ACME123/tds`) is deferred to post-MVP and would require adopting a router library (React Router or TanStack Router).

Hash-based routing implementation:

```typescript
const tabFromHash = window.location.hash.replace("#/", "") as TenantViewTab;
const [activeTab, setActiveTab] = useState<TenantViewTab>(
  isValidTab(tabFromHash) ? tabFromHash : "dashboard"
);

useEffect(() => {
  window.location.hash = `#/${activeTab}`;
}, [activeTab]);

useEffect(() => {
  const handler = () => {
    const hash = window.location.hash.replace("#/", "") as TenantViewTab;
    if (isValidTab(hash)) setActiveTab(hash);
  };
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}, []);
```

### 5.4 Component Architecture for New Tabs

**VendorsTab** (`frontend/src/features/tenant-admin/VendorsTab.tsx`):
```
VendorsTab
  VendorListView
    VendorTable
      VendorRow (clickable to open detail)
  VendorDetailView
    VendorInvoicesSubTab
    VendorTdsSubTab (with TdsCumulativeChart)
    VendorPaymentsSubTab
    VendorBankSubTab
    VendorMsmeSubTab
  VendorMergeDialog
  TdsDashboard (React.lazy; toggled via toolbar button, also accessible from Overview KPI drill-down)
```

**PaymentsTab** (`frontend/src/features/tenant-admin/PaymentsTab.tsx`):
```
PaymentsTab
  PaymentsToolbar (date range, vendor filter, status filter)
  PaymentTable
    PaymentRow
  PaymentSummaryCards (total paid, pending, overdue)
```

**ReconciliationTab** (`frontend/src/features/tenant-admin/ReconciliationTab.tsx`):
```
ReconciliationTab
  ReconciliationSplitPane
    BankTransactionList (left panel)
    CandidateInvoiceList (right panel)
    AmountDifferenceExplanation
    MatchConfidenceBreakdown
    SplitMatchPanel
    AggregateMatchPanel
  ReconciliationSummaryView (KPIs, per-statement table)
```

### 5.5 State Management Approach

**Per-tab local state** is the default pattern and should continue. Each tab fetches its own data on mount, manages its own loading/error states, and does not pollute a global store.

**Shared context** for exactly two cross-cutting concerns:

1. **Session/auth context** (already exists via `useTenantWorkspace`).
2. **Nav counts context** (new):
   ```typescript
   interface NavCountsContextValue {
     inbox: number;
     invoices: number;
     vendors: number;
     exports: number;
   }
   ```
   Populated by a top-level `useEffect` that calls `GET /api/nav-counts` on mount and refreshes every 60 seconds via `setInterval`. This context is independent of any tab -- it lives at the workspace root level and updates regardless of which tab the user is viewing. The 60-second polling interval balances freshness against API load; a manual `refresh()` method is also exposed for immediate updates after user actions (e.g., approving an invoice should decrement the inbox count).

3. **`VendorCacheContext`** (new, Phase 2):
   ```typescript
   interface VendorCacheContextValue {
     getDisplayName: (fingerprint: string) => string | null;
     warm: (fingerprints: string[]) => void;
   }
   ```
   Populated by a single `GET /api/vendors?fields=fingerprint,displayName&limit=500` call on workspace mount. Used by the Invoices tab (vendor column), Payments tab (vendor grouping), and Reconciliation tab (candidate display) to resolve vendor display names without per-tab fetches. Cache invalidated on vendor edit/merge.

4. **`PaymentStatusContext`** (new, Phase 3):
   ```typescript
   interface PaymentStatusContextValue {
     getPaymentStatus: (invoiceId: string) => {
       status: "unpaid" | "partially_paid" | "fully_paid" | "overpaid";
       paidPercent: number;
     } | null;
     refresh: () => void;
   }
   ```
   Populated by `GET /api/payments/summary?invoiceIds=...` on invoice list load. Enables the Invoices tab to show payment status badges without fetching full payment records per invoice. Refreshed when a payment is recorded from the detail panel.

**No global store (Redux/Zustand) is recommended.** The existing pattern of callback props (`onNavCountsChange`, `onSessionExpired`) is sufficient. The four context providers above handle the only cross-tab data needs.

---

## 6. Invoice Table & Detail Panel

### 6.1 Revised Table Columns

The revised column set introduces three new columns and modifies two existing ones:

```
Checkbox | File | Vendor | Invoice # | Invoice Date | Total | Tax | Risk | Payment | GL Code | TDS | Status | Aging | Approved By | Received | Actions
```

Changes:
- **Risk** (new) -- `RiskDot` component (Section 14.1) showing colored dot from highest-severity open risk signal.
- **Payment** (new) -- `PaymentStatusBadge` (Section 14.4) reflecting `paymentStatus` field. Only rendered for APPROVED/EXPORTED invoices.
- **Aging** (new) -- `AgingBadge` (Section 14.7) derived from `parsed.dueDate`. Only rendered for unpaid/partially-paid invoices.
- **Score** (removed) -- `ConfidenceBadge` is removed from the table per the confidence score overhaul plan. Confidence data remains in the detail panel.
- **Status** (modified) -- gains action hint suffix via `ActionHintBadge` (Section 14.6).

### 6.2 Column Responsiveness

At narrower viewport widths, columns are hidden in priority order (lowest priority hidden first):

| Priority | Column | Hide below |
|----------|--------|------------|
| 1 (hide first) | Received | 1400px |
| 2 | Approved By | 1400px |
| 3 | Aging | 1200px |
| 4 | Tax | 1200px |
| 5 | GL Code | 1000px |
| 6 | TDS | 1000px |
| 7 | Invoice # | 800px |
| 8 (hide last) | Invoice Date | 800px |

Columns never hidden: Checkbox, File, Vendor, Total, Risk, Payment, Status, Actions.

Implementation: Each `<th>` and `<td>` receives a `data-col` attribute. CSS `@media` breakpoints set `display: none` on appropriate `data-col` values -- no JS-based column toggling.

```css
@media (max-width: 1400px) {
  [data-col="received"],
  [data-col="approvedBy"] { display: none; }
}
@media (max-width: 1200px) {
  [data-col="aging"],
  [data-col="tax"] { display: none; }
}
@media (max-width: 1000px) {
  [data-col="glCode"],
  [data-col="tds"] { display: none; }
}
@media (max-width: 800px) {
  [data-col="invoiceNumber"],
  [data-col="invoiceDate"] { display: none; }
}
```

**Stored column widths**: Persisted column widths (from `billforge:col-widths` in `localStorage`) are ignored for columns hidden by CSS media queries. On breakpoint change, hidden columns' stored widths are cleared to prevent layout jumps when returning to wider viewports. A `matchMedia` change listener on each breakpoint triggers cleanup of the corresponding `data-col` keys from the stored widths object.

### 6.3 Revised Detail Panel Section Order

1. Header (status, received date, file -- confidence badge removed)
2. Key fields (vendor, invoice#, date, amount, currency)
3. **ComplianceSummaryBar** (new -- always visible, non-collapsible)
4. Approval buttons
5. Source Preview (collapsible)
6. Extracted Invoice Fields (collapsible)
7. Line Items (collapsible)
8. **CompliancePanel** (redesigned)
9. RiskSignalList (expanded by default for NEEDS_REVIEW)
10. **PaymentHistory** (new -- visible for APPROVED/EXPORTED invoices)

### 6.4 Confidence Score Overhaul

**In the table:** The `Score` column is removed entirely. Its function is replaced by the `Risk` column and the `Payment` column.

**In the detail panel:** The `ConfidenceBadge` is replaced with a `ComplianceStatusIndicator` (Section 14.5) showing four discrete signals inline:

```
TDS: 194C  |  PAN: Valid  |  GL: Purchase  |  Risks: 0
```

Each signal uses color (green/amber/red/gray) plus an icon (checkmark/warning/error/dash) to indicate status. The `confidenceScore` field remains on the `Invoice` type for backward compatibility but is no longer rendered in the primary UI.

#### 6.4.1 Confidence Score Breakdown Tooltip (Added per PRD v1.2)

While the confidence score is no longer the primary UI signal, the detail panel retains a small "Confidence: {score}%" text link adjacent to the `ComplianceStatusIndicator`. Hovering or clicking this link opens a `ConfidenceBreakdownTooltip` showing the component scores per the PRD formula:

```
+--------------------------------------------------+
|  Confidence Breakdown                             |
+--------------------------------------------------+
|  OCR Confidence (65% weight)          92%         |
|  Field Completeness (35% weight)      85%         |
|  ────────────────────────────────────────         |
|  Weighted Score                       89.6%       |
|  Penalty Deductions                   -2.0%       |
|    - 1 warning risk signal            -1.0%       |
|    - PAN format unverified            -1.0%       |
|  ────────────────────────────────────────         |
|  Final Score                          87.6%       |
+--------------------------------------------------+
```

The tooltip uses the existing `Portal` component (Section 14.9.1) for positioning. Data source: `invoice.confidenceDetail` (new field -- see Section 18.2 type extension). If `confidenceDetail` is absent (older invoices), the tooltip falls back to showing only the final score without breakdown.

**Component interface:**

```typescript
interface ConfidenceBreakdownTooltipProps {
  confidenceScore: number;
  confidenceDetail?: {
    ocrConfidence: number;
    fieldCompleteness: number;
    penalties: Array<{ reason: string; deduction: number }>;
  };
}
```

---

## 7. Payment Recording UI

### 7.1 Trigger Points

The "Record Payment" button appears in two locations:
1. In the `PaymentHistory` section of the detail panel (for single-invoice payment)
2. In the bulk action bar at the bottom of the invoice table (for multi-invoice payment) when 1+ APPROVED/EXPORTED invoices are selected

### 7.2 Payment History Section

Rendered below `RiskSignalList` when the invoice is APPROVED or EXPORTED.

```
+--------------------------------------------------+
|  Payment History                                  |
+--------------------------------------------------+
|  Invoice Total: INR 1,00,000                      |
|  TDS (194C @ 1%): INR 1,000                      |
|  TCS: INR 0                                       |
|  Net Payable: INR 99,000                          |
|                                                    |
|  [=====================>        ] 75%             |
|                                                    |
|  Date        Amount     Method   Ref       By      |
|  15-Apr-26   50,000     NEFT     UTR-123   amit    |
|  01-Apr-26   24,000     NEFT     UTR-098   amit    |
|  -------------------------------------------------|
|  Paid: 74,000 | Remaining: 25,000                 |
|                                                    |
|  [+ Record Payment]                               |
+--------------------------------------------------+
```

Data source: `GET /api/payments?invoiceId={id}` -- fetched when the detail panel loads an APPROVED/EXPORTED invoice.

### 7.3 Single-Invoice Payment Form

Triggered by clicking "Record Payment" in the detail panel. Renders inside a `SlideOverPanel` (Section 14.9) on all viewport sizes. The inline pattern is reserved for single-field edits only (e.g., GL code assignment). Payment recording involves multiple interdependent fields (amount, method, UTR, allocations) that benefit from the dedicated focus and consistent layout of the slide-over panel.

```
+--------------------------------------------------------------+
|  Record Payment                                    [X Close]  |
+--------------------------------------------------------------+
|                                                                |
|  Invoice: INV-045 -- Acme Corp Ltd                            |
|  Net Payable (after TDS): INR 99,000                          |
|  Already Paid: INR 74,000                                     |
|  Remaining: INR 25,000                                        |
|                                                                |
|  +-Amount-----------+  +-Date-------------------+             |
|  | 25,000.00        |  | 2026-04-16            |             |
|  +------------------+  +-----------------------+             |
|                                                                |
|  +-Method-----------+  +-UTR/Reference----------+            |
|  | NEFT        [v]  |  | UTIB12345678901234    |            |
|  +------------------+  +-----------------------+             |
|                                                                |
|  +-Notes (optional)--------------------------------+          |
|  | Q4 settlement                                    |          |
|  +--------------------------------------------------+          |
|                                                                |
|  After this payment:                                          |
|  Paid: 99,000 / 99,000 -- FULLY PAID                         |
|                                                                |
|  [Save Payment]  [Cancel]                                     |
+--------------------------------------------------------------+
```

**Payment method-specific fields:**

| Method | Extra Fields |
|--------|-------------|
| NEFT | UTR Number (alphanumeric, 16-22 chars) |
| RTGS | UTR Number (alphanumeric, 16-22 chars) -- minimum Rs 2,00,000 |
| UPI | UPI Reference -- maximum Rs 1,00,000 |
| IMPS | Reference Number -- maximum Rs 5,00,000 |
| Cheque | Cheque Number (6-digit numeric) + Bank Name |
| Cash | No reference -- warning banner if > Rs 2,00,000 |

### 7.4 Multi-Invoice Payment Form

Triggered from the bulk action bar. Opens as a modal with an allocation table:

```
+--------------------------------------------------------------+
|  Record Payment -- 3 invoices                                 |
+--------------------------------------------------------------+
|  Vendor: Acme Corp Ltd                                        |
|                                                                |
|  Invoice      Net Payable   Already Paid  Allocate            |
|  INV-045      99,000        0             [99,000]            |
|  INV-038      42,500        0             [42,500]            |
|  INV-029      75,000        50,000        [25,000]            |
|  ----------------------------------------------------------- |
|  Total Allocation:                         166,500            |
|                                                                |
|  Payment Amount  [166,500]                                    |
|  Date            [2026-04-16]                                 |
|  Method          [NEFT v]                                     |
|  UTR/Ref         [_____________]                              |
|                                                                |
|  [Save Payment]  [Cancel]                                     |
+--------------------------------------------------------------+
```

#### 7.4.1 Multi-Vendor Payment Wireframe

When selected invoices span multiple vendors, the modal groups invoices by vendor with collapsible vendor headers. Each vendor group has its own UTR/method fields because a single bank transaction maps to one vendor. A global "Save All" button submits all vendor payments atomically, with per-vendor success/failure feedback.

```
+--------------------------------------------------------------+
|  Record Payment -- 5 invoices, 2 vendors                      |
+--------------------------------------------------------------+
|                                                                |
|  [v] ACME CORP LTD (3 invoices)                               |
|  +----------------------------------------------------------+ |
|  | Invoice      Net Payable   Already Paid  Allocate         | |
|  | INV-045      99,000        0             [99,000]         | |
|  | INV-038      42,500        0             [42,500]         | |
|  | INV-029      75,000        50,000        [25,000]         | |
|  +----------------------------------------------------------+ |
|  | Subtotal:                                 166,500         | |
|  | Method: [NEFT v]   UTR: [UTIB1234567890_______]          | |
|  +----------------------------------------------------------+ |
|                                                                |
|  [v] BETA SERVICES (2 invoices)                                |
|  +----------------------------------------------------------+ |
|  | Invoice      Net Payable   Already Paid  Allocate         | |
|  | INV-062      50,000        0             [50,000]         | |
|  | INV-058      30,000        0             [30,000]         | |
|  +----------------------------------------------------------+ |
|  | Subtotal:                                  80,000         | |
|  | Method: [NEFT v]   UTR: [HDFC9876543210_______]          | |
|  +----------------------------------------------------------+ |
|                                                                |
|  Date: [2026-04-16]   Grand Total: 246,500                    |
|                                                                |
|  [Save All Payments]  [Cancel]                                 |
+--------------------------------------------------------------+
```

**Per-vendor feedback after submit:**

```
+--------------------------------------------------------------+
|  Payment Results                                               |
+--------------------------------------------------------------+
|  [checkmark] Acme Corp Ltd     166,500  NEFT   UTIB1234...    |
|  [X]         Beta Services      80,000  NEFT   Duplicate UTR  |
|                                                                |
|  1 of 2 payments saved.                                        |
|  [Retry Failed]  [Close]                                       |
+--------------------------------------------------------------+
```

Each vendor payment is submitted as an independent `POST /api/payments` call. The UI shows a per-vendor progress indicator during submission and per-vendor success/failure badges on completion. Failed vendor payments can be retried without re-entering successful ones.

### 7.5 Advance Payment Flow

An "Advance Payment" option is available from the Payments tab (not the invoice detail panel). The form has an empty allocations array. The advance payment can later be allocated to invoices via a separate "Allocate Advance" flow.

### 7.6 Validation UX

| Rule | Display |
|------|---------|
| Sum of allocations must equal payment amount | Real-time red text on "Total Allocation" row. Save button disabled. |
| Duplicate UTR | Async check on UTR field blur via `GET /api/payments?utrNumber={value}`. Amber inline warning if match found. |
| Cash > Rs 2,00,000 | Amber banner: "Cash payments above Rs 2,00,000 are non-deductible under Section 40A(3)." Warning only, non-blocking. Red is reserved for blocking validation errors (RTGS minimum, amount exceeds remaining). |
| Amount exceeds remaining | Red text: "Exceeds remaining balance. Will be recorded as overpayment." |
| RTGS minimum | "RTGS requires minimum Rs 2,00,000." Save button disabled. |
| UPI maximum | "UPI maximum is Rs 1,00,000." Save button disabled. |

### 7.7 Component Interface

```typescript
interface PaymentAllocation {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  netPayableMinor: number;
  paidAmountMinor: number;
  remainingMinor: number;
  allocatedMinor: number;
}

interface PaymentRecordFormProps {
  mode: "single" | "multi";
  allocations: PaymentAllocation[];
  currency: string;
  onSave: (payment: {
    amountMinor: number;
    paymentDate: string;
    method: "neft" | "rtgs" | "upi" | "imps" | "cheque" | "cash" | "other";
    utrNumber: string | null;
    chequeNumber: string | null;
    notes: string | null;
    allocations: Array<{ invoiceId: string; allocatedMinor: number }>;
  }) => Promise<void>;
  onCancel: () => void;
  onCheckDuplicateUtr?: (utr: string) => Promise<{ isDuplicate: boolean; existingPaymentNumber?: string }>;
}
```

---

## 8. Compliance Presentation Redesign

### 8.1 ComplianceSummaryBar

A non-collapsible horizontal bar rendered at position 3 in the detail panel (above approval buttons). Shows the four most actionable compliance signals at a glance:

```
+--------------------------------------------------------------+
| TDS: 194C @ 1% = 1,000  |  PAN: Valid  |  GL: Purchase  |  Risk: 2 warnings  |
+--------------------------------------------------------------+
```

Each slot is clickable and scrolls to the corresponding section. The Risk slot uses the same color-coding as `RiskDot`. Missing/invalid fields show warning style (amber background, descriptive text like "PAN: Missing" or "GL: Not assigned").

### 8.2 TDS Rate Source Display

The TDS row in CompliancePanel gains a rate source badge:

```
TDS: 194C @ 1% [Standard] = INR 1,000
TDS: 194C @ 0.5% [Sec 197] = INR 500
TDS: 194C @ 20% [No PAN (206AA)] = INR 20,000
TDS: 194C @ 2% [Override] = INR 2,000
```

Badge colors: gray for standard, blue for override, green for Section 197, red for no-PAN penalty.

### 8.3 TDS Cumulative Context

A new `TdsCumulativeContext` component rendered inside CompliancePanel when TDS data is present:

```
+--------------------------------------------------+
|  Vendor TDS (FY 2025-26) -- 194C                  |
|  Cumulative Paid to Vendor:    12,50,000          |
|  Annual Threshold:                30,000          |
|  [========================================] 100%  |
|  YTD TDS Deducted:                12,500          |
|  View vendor detail ->                            |
+--------------------------------------------------+
```

Data source: `GET /api/reports/tds-liability?vendorFingerprint={fp}&fy={fy}`. The threshold progress bar uses `PaymentProgressBar` (Section 14.3) with color semantics: green below 80%, amber 80-100%, red above threshold.

### 8.4 GL Code Dropdown Fix

Replace the current inline absolute positioning with a portal-based approach using `ReactDOM.createPortal` to render the dropdown at the document body level. The dropdown's position is computed from `getBoundingClientRect()`. A cleanup effect closes the dropdown on scroll or resize if the trigger moves off-screen.

---

## 9. Vendor Management Tab

### 9.1 Vendor List View

**Route:** Tab `"vendors"` in the tenant workspace.

**Table Columns:**

| Column | Source | Width | Sortable |
|--------|--------|-------|----------|
| Name | `displayName` | flex | Yes |
| PAN | `pan` | 120px | No |
| GSTIN | `gstin` | 180px | No |
| TDS Section | `defaultTdsSection` | 80px | Yes |
| Tally Status | `tallyLedgerName` presence | 100px | Yes |
| Invoice Count | from aggregation | 80px | Yes |
| Last Activity | `updatedAt` | 130px | Yes |
| Status | `vendorStatus` | 90px | Yes |

**Search:** Debounced (300ms) text input via `useDebouncedValue`. Searches across `displayName`, `aliases`, `pan`, `gstin` server-side.

**Filters:** Status dropdown (All | Active | Inactive | Blocked), TDS section dropdown.

**Pagination:** Server-side, default page size 20, matching the invoice list pattern.

**Data fetching:** `GET /api/vendors?search=&status=&tdsSection=&page=1&limit=20&sortBy=displayName&sortDir=asc`. Uses `useEffect` + `apiClient.get` with local state.

**Loading:** 8-row skeleton with shimmer animation. Stale data at 0.5 opacity during refetch (pagination smoothing from m12b).

**Empty state:** `EmptyState` with `icon="storefront"`, heading="No vendors yet", description="Vendors are automatically created when invoices are processed."

**Component interface:**

```typescript
interface VendorSummary {
  fingerprint: string;
  displayName: string;
  aliases: string[];
  pan: string | null;
  gstin: string | null;
  defaultTdsSection: string | null;
  defaultGlCode: string | null;
  tallyLedgerName: string | null;
  vendorStatus: "active" | "inactive" | "blocked";
  invoiceCount: number;
  totalInvoicedMinor: number;
  lastActivityAt: string;
  msmeClassification: "micro" | "small" | "medium" | null;
  stateCode: string | null;
  stateName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VendorListResponse {
  items: VendorSummary[];
  page: number;
  limit: number;
  total: number;
}

interface VendorListViewProps {
  onVendorSelect: (fingerprint: string) => void;
  onMergeRequest: (sourceFingerprint: string) => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}
```

**Responsive:** Below 1024px: hide GSTIN and Last Activity. Below 768px: hide PAN and Tally Status, card layout.

**Wireframe:**

```
+-----------------------------------------------------------------------+
| Vendors                                                    [+ Add]    |
+-----------------------------------------------------------------------+
| [Search vendors...]          Status: [All v]  Section: [All v]        |
+-----------------------------------------------------------------------+
| Name            | PAN         | GSTIN           | TDS  | Tally   | # |
+-----------------+-------------+-----------------+------+---------+---+
| Acme Corp Ltd   | AADCA1234K  | 06AADCA1234K1ZP | 194C | Synced  |12 |
| Beta Services   | BBBPB5678L  | -               | 194J | Pending | 3 |
| Gamma Traders   | -           | -               | -    | -       | 1 |
+-----------------+-------------+-----------------+------+---------+---+
| Showing 1-20 of 47                      [< Prev]  Page 1  [Next >]  |
+-----------------------------------------------------------------------+
```

### 9.1.1 Vendor List State Preservation

Both `VendorListView` and `VendorDetailView` remain mounted simultaneously with CSS `display:none` toggling the inactive view. This preserves scroll position, search query, and filter state when navigating to vendor detail and back. This matches the existing pattern where all tabs remain mounted but hidden (e.g., `TenantInvoicesView` stays mounted when switching to Exports).

```css
.vendor-list-active .vendor-list-view { display: block; }
.vendor-list-active .vendor-detail-view { display: none; }
.vendor-detail-active .vendor-list-view { display: none; }
.vendor-detail-active .vendor-detail-view { display: block; }
```

### 9.2 Vendor Detail View

Clicking a vendor row opens the detail view (in-tab navigation, not a separate route). A "Back to Vendor List" breadcrumb returns to the list.

**Header Section:**

```
+-----------------------------------------------------------------------+
| [< Back to Vendors]                                                    |
+-----------------------------------------------------------------------+
| ACME CORP LTD                                   [Edit]  [Merge]       |
| PAN: AADCA1234K (Valid)     GSTIN: 06AADCA1234K1ZP                     |
| TDS: 194C   GL: 4100   Tally: [Synced]   Status: [Active]             |
+-----------------------------------------------------------------------+
| Section 197: LDC/2025/12345  Valid until 31-Mar-2026  Rate: 0.5%       |
+-----------------------------------------------------------------------+
| [Invoices (12)]  [TDS History]  [Payments (8)]  [Bank]  [MSME]        |
+-----------------------------------------------------------------------+
```

**Sub-tabs:**

| Sub-tab | Content |
|---------|---------|
| Invoices | Filtered invoice list for this vendor (reuses invoice table rendering, scoped to `?vendorFingerprint={fingerprint}`) |
| TDS History | Per-FY cumulative breakdown with threshold tracking + `TdsCumulativeChart` (Section 14.16) |
| Payments | Payment history with expandable per-invoice allocations |
| Bank Details | Masked account number, IFSC, change history timeline |
| MSME | Classification, 45-day deadline tracking, interest calculation |

**Component interface:**

```typescript
interface VendorDetail extends VendorSummary {
  lowerDeductionCert: {
    certificateNumber: string;
    validFrom: string;
    validTo: string;
    maxAmountMinor: number;
    applicableRateBps: number;
  } | null;
  bankDetails: {
    accountHash: string | null;
    ifsc: string | null;
    bankName: string | null;
    changeHistory: Array<{
      changedAt: string;
      previousHash: string | null;
      newHash: string | null;
      changedBy: string;
    }>;
  } | null;
  tallyLedgerGroup: string;
  msmePaymentTermDays: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

interface VendorDetailViewProps {
  fingerprint: string;
  onBack: () => void;
  onMergeRequest: (sourceFingerprint: string) => void;
  addToast: (type: "success" | "error" | "info", message: string) => void;
}
```

**Edit form fields:** Display Name (required), Tally Ledger Name, Default GL Code, Default TDS Section, Vendor Status, MSME Classification, Contact Email, Contact Phone. Save calls `PATCH /api/vendors/:fingerprint`.

### 9.3 Vendor Merge UX

**Trigger points:**
1. "Merge" button on vendor detail view header.
2. Bulk action from vendor list: select 2+ vendors, click "Merge Selected".
3. Automatic suggestion: when invoice processing detects a similar vendor name (Levenshtein distance < 3), a yellow banner suggests merging.

**Merge dialog wireframe:**

```
+-----------------------------------------------------------------------+
| Merge Vendor                                                    [X]    |
+-----------------------------------------------------------------------+
|                                                                        |
| Merging: Beta Services  -->  Acme Corp Ltd          [Swap Direction]   |
|                                                                        |
| What will happen:                                                      |
|   * 3 invoices will be reassigned to Acme Corp Ltd                    |
|   * 1 GL mapping will be consolidated                                  |
|   * 2 TDS ledger entries will be merged into FY 2025-26               |
|   * 1 payment record will be reassigned                                |
|   * Beta Services will be marked inactive (soft-deleted)               |
|                                                                        |
| Field Conflicts:                                                       |
|   PAN: Beta = BBBPB5678L  |  Acme = AADCA1234K  (keeping Acme)       |
|   TDS Section: Beta = 194J  |  Acme = 194C  (keeping Acme)           |
|                                                                        |
| Merge type:                                                            |
|   (*) Soft merge (recommended)                                         |
|   ( ) Hard merge (permanent, cannot be undone)                         |
|                                                                        |
|                              [Cancel]  [Confirm Merge]                 |
+-----------------------------------------------------------------------+
```

**Soft merge (default):** The source vendor is marked inactive with a "Merged into {target}" badge. All records (invoices, payments, TDS entries) are reassigned to the target vendor, but the source vendor's record is preserved for 30 days. An "Undo merge" button is available on the source vendor's detail page during this period. After 30 days, the source vendor is permanently deleted via a scheduled cleanup job. This approach allows recovery from accidental merges without cluttering the active vendor list.

**Hard merge:** Immediate permanent deletion of the source vendor record. Use only when duplicate is clearly erroneous (e.g., typo-created vendor with zero invoices).

**Flow:** Preview via `POST /api/vendors/:fingerprint/merge?dryRun=true`, execute via `POST /api/vendors/:fingerprint/merge` (body includes `mergeType: "soft" | "hard"`).

**Component interface:**

```typescript
interface VendorMergeDialogProps {
  open: boolean;
  sourceVendor: VendorSummary;
  targetVendor: VendorSummary;
  mergePreview: VendorMergePreview | null;
  loading: boolean;
  mergeType: "soft" | "hard";
  onMergeTypeChange: (type: "soft" | "hard") => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSwapDirection: () => void;
}

interface VendorMergePreview {
  invoicesToReassign: number;
  glMappingsToConsolidate: number;
  tdsLedgerEntriesToMerge: number;
  paymentsToReassign: number;
  sourceWillBeSoftDeleted: boolean;
  conflictingFields: Array<{
    field: string;
    sourceValue: string | null;
    targetValue: string | null;
  }>;
}
```

---

## 10. TDS Dashboard & Reporting

### 10.1 TDS Liability Overview

The TDS Dashboard is a **standalone component** (`React.lazy(() => import("./TdsDashboard"))`) accessible from two locations:

1. **Overview tab**: As a KPI card drill-down. The "Total TDS Deducted" KPI card in `OverviewDashboard` includes a "View TDS Dashboard" link that renders the dashboard inline below the KPI row.
2. **Vendors tab**: As a sub-view. A "TDS Dashboard" toggle button in the vendor toolbar switches between vendor list and TDS dashboard.

The component uses `React.lazy` for code-splitting so it is not bundled with either host tab. Dashboard data is cached in a `useRef` to avoid refetching when toggling between vendor list and dashboard views within the Vendors tab.

**KPI Cards Row (4 cards):**

| KPI Card | Value | Color |
|----------|-------|-------|
| Total TDS Deducted (FY) | INR formatted | Blue |
| Vendors Above Threshold | Count | Green |
| Vendors Below Threshold | Count | Amber |
| Threshold Crossings This Month | Count | Red if > 0 |

**Section-wise Breakdown:** Horizontal bar chart (Recharts `BarChart`) showing total TDS per section for the selected FY.

**FY Selector:** Dropdown defaulting to current FY. **Quarter Filter:** Four toggle buttons (Q1-Q4) plus "All".

**Wireframe:**

```
+-----------------------------------------------------------------------+
| TDS Dashboard                           FY: [2025-26 v]  [All Qtrs v] |
+-----------------------------------------------------------------------+
| +---------------+ +------------------+ +----------------+ +-----------+
| | Total TDS     | | Above Threshold  | | Below Thresh.  | | Crossings |
| | INR 4,52,000  | | 23 vendors       | | 8 vendors      | | 3 this mo |
| +---------------+ +------------------+ +----------------+ +-----------+
|                                                                        |
| Section-wise Breakdown                                                 |
| 194C  [========================] INR 2,80,000  (18 vendors)            |
| 194J  [==============]           INR 1,20,000  (8 vendors)             |
| 194H  [=====]                    INR 42,000    (3 vendors)             |
| 194I  [==]                       INR 10,000    (2 vendors)             |
+-----------------------------------------------------------------------+
```

**Data fetching:** `GET /api/reports/tds-liability?fy=2025-26&quarter=Q1`. Single request returns KPIs, section breakdown, and vendor-level data.

### 10.2 TDS Vendor Table

Below KPIs: per-vendor TDS status table.

| Column | Width | Sortable |
|--------|-------|----------|
| Vendor | flex | Yes |
| Section | 80px | Yes |
| FY Cumulative Base | 130px | Yes |
| Threshold | 100px | No |
| TDS Deducted | 120px | Yes |
| Status | 120px | Yes |
| Sec 197 | 80px | No |

**Status badges:** "Above threshold" (green), "Below threshold" (amber), "Crossed this period" (red with alert icon).

**Expandable rows** show per-invoice entries. **Export to CSV** button ("Export for 26Q") calls `GET /api/reports/tds-liability?fy=2025-26&format=csv`.

### 10.3 TDS Cumulative Chart

Per-vendor cumulative line chart (Recharts `LineChart`) showing taxable base growth over FY with threshold reference line.

```
+-----------------------------------------------------------------------+
| TDS Cumulative: Acme Corp Ltd (194C)    FY 2025-26                     |
+-----------------------------------------------------------------------+
|                                                                        |
| INR                                                            * 12.5L |
| 12L .....................................................*....         |
|  9L ............................................*...............         |
|  6L ...............................*............................         |
|  3L .....................*..........  ---- threshold: 30,000 ---        |
|     ......*............................................................|
|     Apr    May    Jun    Jul    Aug    Sep    Oct    Nov    Dec         |
|              ^                                                         |
|         Threshold crossed: 15-May-2025                                 |
+-----------------------------------------------------------------------+
```

### 10.4 Aging Report

**Data source:** `GET /api/reports/payment-aging?fy=2025-26`.

**Aging Buckets (per VKL D-018):**

| Bucket | Definition |
|--------|-----------|
| Current | Not yet past due |
| 1-30 | 1-30 days past due |
| 31-60 | 31-60 days past due |
| 61-90 | 61-90 days past due |
| 90+ | More than 90 days past due |

Five `AgingBucketCard` components across the top. Each shows bucket label, invoice count, and total amount. MSME sub-counts are rendered as a subtle sub-line (smaller font at `0.75rem`, muted color `var(--ink-soft)`) beneath the primary count, not at equal prominence with the total count. The full MSME breakdown is available via the "Show MSME only" toggle below the bucket cards. Clicking a card filters the drill-down table below.

**Wireframe:**

```
+-----------------------------------------------------------------------+
| Aging Report                                 Total Outstanding: 45.2L  |
+-----------------------------------------------------------------------+
| +----------+ +----------+ +----------+ +----------+ +----------+      |
| | Current  | | 1-30     | | 31-60    | | 61-90    | | 90+      |      |
| | 18 inv   | | 8 inv    | | 3 inv    | | 2 inv    | | 1 inv    |      |
| | 22.5L    | | 12.0L    | | 5.5L     | | 3.2L     | | 2.0L     |      |
| | (MSME:3) | | (MSME:1) | | (MSME:1) | |          | |          |      |
| +----------+ +----------+ +----------+ +----------+ +----------+      |
|                                                                        |
| [Show MSME only: OFF]                                                  |
| Vendor        | Inv#    | Due Date    | Amount   | Days | MSME         |
| Acme Corp     | INV-045 | 30-Apr-2026 | 1,25,000 | -    | -            |
| Beta Services | INV-032 | 01-Apr-2026 | 85,000   | 15   | [Micro]      |
+-----------------------------------------------------------------------+
```

### 10.5 Reconciliation Summary Report

**Data source:** `GET /api/reports/reconciliation`.

KPI row: Match Rate (donut), Total Matched, Pending Suggestions, Value Gap. Per-statement table with match progress bars. Clicking a statement navigates to the Statements tab.

### 10.6 Vendor Payment Summary Report

**Data source:** `GET /api/reports/vendor-summary?fy=2025-26`.

Top 10 vendors by outstanding (horizontal bar chart). Full vendor table with: Total Invoiced, Total Paid, Outstanding, Avg Payment Days, MSME Deadline Status (On Track / At Risk / Overdue).

---

## 11. Tally Export UX

### 11.1 Pre-Export Validation Modal

Fully specified in Section 4, QW-7. Intercepts `handleExport()` before any call to `generateTallyXmlFile()`.

### 11.2 Export History Enhancement

#### 11.2.1 Expandable Batch Detail

Each batch row in `ExportHistoryDashboard` gains a disclosure triangle revealing per-invoice breakdown:

```
  Batch 2026-04-16 14:30  |  50 total  |  48 success  |  2 failed  |  [Download]
  [v] Expand
  +-----------------------------------------------------------------------+
  | Invoice #     | Vendor            | Amount      | Status   | Detail  |
  +---------------+-------------------+-------------+----------+---------+
  | INV-045       | New Vendor LLC    | 1,25,000    | FAILED   | Vendor  |
  |               |                   |             |          | not in  |
  |               |                   |             |          | Tally   |
  | INV-001       | Acme Corp Ltd     | 85,000      | SUCCESS  |         |
  +-----------------------------------------------------------------------+
  | Showing failed first. 48 more successful.       [Show all] [Re-export 2 failed] |
  +-----------------------------------------------------------------------+
```

Failed invoices shown first. "Re-export failed" button creates a new batch with only failed invoice IDs.

**New API:** `GET /api/exports/:batchId/items` returning `ExportBatchItemDetail[]`.

```typescript
interface ExportBatchItemDetail {
  invoiceId: string;
  invoiceNumber: string | null;
  vendorName: string | null;
  totalAmountMinor: number | null;
  status: "success" | "failed" | "skipped";
  errorMessage: string | null;
  voucherNumber: string | null;
}
```

#### 11.2.2 Export Progress Indicator

For batches > 20 invoices, replace instant download with a progress bar. Uses SSE (same pattern as `subscribeBankParseSSE`). Falls back to instant download if SSE not available.

```
  +----------------------------------------------------------+
  |  Generating Tally XML...  [=========>          ] 67%     |
  |  Processing: INV-034 (34 of 50)                          |
  |  Successful: 33  |  Failed: 1  |  Remaining: 16          |
  +----------------------------------------------------------+
```

### 11.3 Payment Voucher Export

Ships with Phase 3 (payment recording). New sub-section within the Exports tab below `ExportHistoryDashboard`.

**Bank ledger warning:** If `TenantExportConfig.tallyBankLedger` is not configured, display an amber warning linking to the Tally Configuration section in Settings.

**Pre-export validation for payment vouchers** reuses the `PreExportValidationModal` pattern with payment-specific checks (bank ledger configured, allocations reference valid invoices, UTR present, invoice previously exported as purchase voucher).

**Component interface:**

```typescript
interface PaymentVoucherExportPanelProps {
  payments: Payment[];
  bankLedgerConfigured: boolean;
  onExport: (paymentIds: string[]) => void;
  onConfigureBank: () => void;
}
```

---

## 12. Reconciliation Redesign

### 12.1 Split-Pane View

Replaces the `InvoiceSearchPicker` modal for active reconciliation work. Existing statement list remains for statement management.

```
+--------- RECONCILIATION TAB -----------------------------------------+
| [Summary Bar]                                                         |
| Total: 245 txns | Matched: 198 (81%) | Suggested: 23 | Unmatched: 24|
+-----------------------------------------------------------------------+
|                               |                                       |
| BANK TRANSACTIONS             | CANDIDATE INVOICES                    |
| [Unmatched v] [Date range]    | Auto-populated from selected txn      |
|                               |                                       |
| 15-Apr  Acme Corp   -25,000  | INV-001  Acme Corp   10,000          |
| > [Unmatched]                 | INV-002  Acme Corp    8,000          |
|                               | INV-003  Acme Corp    7,000          |
| 14-Apr  Beta Svc     -9,900  |                                       |
|   [Suggested 95%]             | Amount Breakdown:                     |
|                               | Invoice subtotal:     25,000          |
| 10-Apr  NEFT-TDS     -1,000  | TDS (194C @ 1%):        -250          |
|   [Unmatched]                 | Expected bank debit:  24,750          |
|                               | Actual bank debit:    25,000          |
|                               | Difference:             +250          |
|                               |                                       |
|                               | [Match All 3]  [Split Match]         |
+-------------------------------+---------------------------------------+
```

**Visual differentiation from invoice list/detail split:** The reconciliation split pane uses distinct background shades (`--bg-recon-left` / `--bg-recon-right`) and prominent header labels ("Bank Transactions" / "Invoice Candidates") to clearly distinguish it from the invoice list/detail split pane. A visible link-chain icon between the two panels indicates the matching zone. These visual cues prevent user confusion when switching between the Invoices tab (list/detail split) and the Reconciliation tab (transaction/candidate split).

```css
.recon-left-panel { background: var(--bg-recon-left, var(--bg-surface-alt)); }
.recon-right-panel { background: var(--bg-recon-right, var(--bg-surface)); }
.recon-match-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  color: var(--ink-soft);
}
```

**Left panel:** Filters (match status, date range, amount range, search). Transactions in flat scrollable list. Arrow keys to navigate, Enter to select.

**Right panel:** Auto-populates candidates from `GET /api/reconciliation/candidates?transactionId=X`. Shows match score, `AmountDifferenceExplanation` (Section 14.19), and action buttons.

**Responsive:** Below 1024px, stacks vertically. Above 1024px, CSS grid `1fr 1fr` with draggable divider.

**Component interface:**

```typescript
interface ReconciliationCandidate {
  invoiceId: string;
  invoiceNumber: string | null;
  vendorName: string | null;
  grossAmountMinor: number;
  tdsAmountMinor: number;
  tcsAmountMinor: number;
  netPayableMinor: number;
  matchScore: number;
  matchReasons: MatchScoreBreakdown;
  currency: string;
}

interface MatchScoreBreakdown {
  amountProximity: number;
  invoiceNumberInDescription: number;
  vendorNameOverlap: number;
  dateProximity: number;
  gstinMatch: number;
}
```

### 12.2 Split Matching UX

One bank transaction pays multiple invoices. Triggered by "Split Match" or auto-detected when multiple candidate invoice sums approximate the transaction amount.

```
+------------------------------------------------------------------+
| Split Match: Bank Transaction 15-Apr -25,000                    |
+------------------------------------------------------------------+
|                                                                    |
| Transaction Amount: INR 25,000.00                                 |
|                                                                    |
| [x] INV-001  Acme Corp   Gross: 10,000  Net: 9,900               |
|     Allocate: [ 9,900 ]                                           |
| [x] INV-002  Acme Corp   Gross:  8,000  Net: 7,920               |
|     Allocate: [ 7,920 ]                                           |
| [x] INV-003  Acme Corp   Gross:  7,000  Net: 6,930               |
|     Allocate: [ 6,930 ]                                           |
|                                                                    |
+------------------------------------------------------------------+
| Allocated:  24,750 / 25,000                                       |
| Unallocated:   250                                                |
| [===================================>   ] 99.0%                   |
|                                                                    |
| [Save Split Match]          [Cancel]                              |
+------------------------------------------------------------------+
```

Save button disabled until `allocated >= transactionAmount - 100` (Rs 1 tolerance per E19).

**API:** `POST /api/reconciliation-mappings` with `{ bankTransactionId, mappings: [{ invoiceId, allocatedMinor }] }`.

### 12.3 Aggregate Matching UX

One invoice paid across multiple bank transactions (installments). Mirror of split matching, anchored on an invoice.

```
+------------------------------------------------------------------+
| Aggregate Match: INV-010  Beta Services  INR 1,00,000            |
+------------------------------------------------------------------+
|                                                                    |
| Invoice Net Payable: INR 90,000 (after TDS INR 10,000)           |
|                                                                    |
| [x] 15-Apr  NEFT Beta Svc   -50,000   Allocate: [50,000]        |
| [x] 01-Apr  NEFT Beta Svc   -30,000   Allocate: [30,000]        |
| [ ] 25-Mar  UPI  Beta        -15,000   Allocate: [     0]        |
|                                                                    |
| Matched:  80,000 / 90,000      [===========>     ] 88.9%         |
|                                                                    |
| [Save]           [Cancel]                                         |
+------------------------------------------------------------------+
```

### 12.4 Match Confidence Visualization

When the system suggests a match, show scoring factors:

```
  Match Confidence: 87%

  Amount proximity     [============]  40 / 50
  Invoice # in desc    [=========   ]  30 / 30
  Vendor name overlap  [=======     ]  12 / 20
  Date proximity       [===         ]   5 / 10
```

Uses CSS `linear-gradient` backgrounds, no chart library.

### 12.5 Amount Difference Explanation

Explains the gap between invoice total and bank transaction amount, factoring in TDS/TCS:

```
  Amount Breakdown
  +------------------------------------------+
  | Invoice gross:        INR  10,000.00      |
  | TDS (194C @ 1%):     -INR     100.00      |
  | TCS (0.1%):          +INR      10.00      |
  | Expected bank debit:  INR   9,910.00      |
  | Actual bank debit:    INR   9,900.00      |
  +------------------------------------------+
  | Difference:           INR      10.00      |
  | (Within Rs 100 tolerance - acceptable)    |
  +------------------------------------------+
```

Color coding: 0 = green "Exact match", within tolerance = amber, exceeds = red.

---

## 13. Configuration & Onboarding

### 13.1 Tally Configuration Panel

New sixth reorderable section in `TenantConfigTab`:

```
+------------------------------------------------------------------+
| [drag] Tally Integration                                [Save]   |
+------------------------------------------------------------------+
|                                                                    |
| Company Name                                                       |
| [Acme Enterprises Pvt Ltd                        ]                |
|                                                                    |
| Purchase Ledger Name                                               |
| [Purchase Account                                ]                |
|                                                                    |
| Bank Ledger Name                                                   |
| [HDFC Bank - Current Account                     ]                |
|                                                                    |
| TDS Payable Ledger Name                                            |
| [TDS Payable                                     ]                |
|                                                                    |
| GST Ledger Names                                                   |
| CGST: [Input CGST         ]  SGST: [Input SGST         ]         |
| IGST: [Input IGST         ]  Cess: [GST Cess            ]        |
|                                                                    |
| +-- Advanced Settings ----------------------------------------+   |
| | [x] Auto-create vendor ledgers in Tally                     |   |
| | Tally Desktop Agent URL: [              ] (Phase 6)         |   |
| +--------------------------------------------------------------+   |
+------------------------------------------------------------------+
```

**API:** `GET /api/tenant/tally-config` and `PATCH /api/tenant/tally-config`.

### 13.2 Setup Wizard (New Tenant Onboarding)

Guided setup wizard shown to tenant admins on first login (zero configuration state). Replaces the full `TenantConfigTab` until essential steps are completed.

**Steps:**

| Step | Title | Required |
|------|-------|----------|
| 1 | Company Details (name, currency, TAN) | Company name |
| 2 | Tax Configuration (TDS sections, PAN validation) | At least one TDS section |
| 3 | Chart of Accounts (GL code CSV import or manual) | At least one GL code |
| 4 | Approval Workflow (simple/advanced toggle) | Any selection |
| 5 | Tally Integration (company name, ledgers) | Company name |

```
+------------------------------------------------------------------+
| BillForge Setup                                                    |
+------------------------------------------------------------------+
|                                                                    |
| Step 2 of 5: Tax Configuration                                    |
| [1 Company] --- [2 Tax] --- [3 GL Codes] --- [4 Workflow] --- [5] |
|   (done)        (current)    (pending)        (pending)      Tally|
|                                                                    |
| Which TDS sections apply to your business?                         |
|                                                                    |
| [x] 194C - Payments to contractors                                |
|     Individual: 1% | Company: 2% | No PAN: 20%                   |
| [x] 194J - Professional/technical fees                             |
| [ ] 194H - Commission/brokerage                                   |
| [ ] 194I - Rent                                                   |
|                                                                    |
| [Back]                                     [Next: GL Codes ->]    |
+------------------------------------------------------------------+
```

Each step saves independently on "Next". Steps 2 and 4 allow "Skip for now". **Step 3 (GL Codes) is non-skippable** -- invoices without GL codes cannot be exported to Tally, making this step a hard prerequisite for the export workflow.

**Step dependencies:** Step 5 (Tally Integration) shows a summary of which earlier steps were skipped and how this affects export capability:

```
+------------------------------------------------------------------+
| Step 5 of 5: Tally Integration                                    |
+------------------------------------------------------------------+
| Skipped steps affecting Tally export:                              |
|   [!] Step 2 (Tax Config) skipped -- TDS will not be calculated   |
|   [checkmark] Step 3 (GL Codes) completed                         |
|   [!] Step 4 (Approval Workflow) skipped -- no approval required  |
+------------------------------------------------------------------+
```

Persistence via `GET/PATCH /api/tenant/setup-progress`.

### 13.3 Progressive Disclosure in Config

#### 13.3.1 Collapsible Sections with Summary Headers

Each section in `TenantConfigTab` is wrapped in a `CollapsibleConfigSection` showing a one-line summary when collapsed:

```
  [v] Approval Workflow                    Simple (1 step)
  [>] GL Codes                             12 codes imported
  [>] Compliance (TDS/PAN/Risk)            194C, 194J enabled | PAN L2
  [>] TCS                                  0.1% rate
  [>] Tally Integration                    Company: Acme | Bank: HDFC CA
  [>] Users                                4 active, 1 invited
```

Expanded/collapsed state persisted to `localStorage` under `billforge:config-expanded-sections`.

#### 13.3.2 Impact Preview

When changing a TDS rate or toggling a section, show a real-time impact indicator:

```
  [ ] 194H - Commission/brokerage
      Enabling this will apply to 3 existing invoices from vendors
      classified under this section.
```

Implementation: debounced call to `GET /api/invoices/count?tdsSection=194H` on hover/focus.

---

## 14. Shared Component Library

All new components that are used across multiple feature areas are defined here. Feature-specific sections (6-13) reference these components by name rather than redefining them.

**Bundle budget**: Recharts (~45KB gzipped) must be loaded via `React.lazy` and dynamic import. Bundle budget: total JS increase from charting must not exceed 50KB gzipped. All chart-consuming components (`TdsDashboard`, `TdsCumulativeChart`, `ReconciliationSummaryView`) must use lazy loading -- never statically imported.

**Component placement rule**: Stateless components taking only props belong in `components/`. Components that fetch data, manage state, or use hooks belong in `features/`. This matches the existing pattern (`ConfidenceBadge` in `components/`, `IngestionProgressCard` in `features/`).

### 14.1 RiskDot

**File:** `frontend/src/components/compliance/RiskDot.tsx`

```typescript
interface RiskDotProps {
  riskSignals?: Array<{ severity: string; status: string }>;
}
```

A small colored circle (8px diameter) summarizing the highest-severity open risk signal. Colors: red (`var(--color-error)`) for critical, amber (`var(--color-warning)`) for warning, green border with transparent fill for clean. When count > 0, the count renders as a small number adjacent to the dot. Includes an icon inside for colorblind accessibility: exclamation triangle for critical, exclamation circle for warning, checkmark for clean.

CSS:
```css
.risk-dot {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}
.risk-dot-critical { background: var(--color-error, #ef4444); }
.risk-dot-warning { background: var(--color-warning, #f59e0b); }
.risk-dot-clean { border: 1.5px solid var(--color-success, #22c55e); background: transparent; }
```

**a11y:** `aria-label="{count} risk signals, highest severity: {severity}"` or `"No risk signals"`.

### 14.2 StatusBadge

**File:** `frontend/src/components/common/StatusBadge.tsx`

```typescript
interface StatusBadgeProps {
  status: string;
  hint?: string;
  size?: "sm" | "md";
}
```

Consolidates the scattered status rendering (icons from `STATUS_ICONS`, labels from `STATUS_LABELS`, CSS classes). Each badge renders icon + label + optional hint.

### 14.3 PaymentProgressBar

**File:** `frontend/src/components/common/PaymentProgressBar.tsx`

```typescript
interface PaymentProgressBarProps {
  paidMinor: number;
  totalMinor: number;
  currency: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}
```

Horizontal bar filled proportional to `paidMinor / totalMinor`. Bar height: 6px for `sm` (table rows), 10px for `md` (detail panel). Fill color: green >= 100%, amber 50-99%, blue 1-49%, gray 0%. When `showLabel=true`, percentage and amounts render below.

**a11y:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax`.

### 14.4 PaymentStatusBadge

**File:** `frontend/src/components/common/PaymentStatusBadge.tsx`

- **unpaid**: gray text "Unpaid" (em-dash for pre-APPROVED)
- **partially_paid**: amber badge with percentage
- **fully_paid**: green badge "Paid"
- **overpaid**: red badge "Overpaid"

### 14.5 ComplianceStatusIndicator

**File:** `frontend/src/components/compliance/ComplianceStatusIndicator.tsx`

```typescript
interface ComplianceStatusIndicatorProps {
  tdsSection: string | null;
  tdsRateSource: string | null;
  panStatus: "valid" | "format-invalid" | "gstin-mismatch" | "missing" | null;
  glAssigned: boolean;
  glName: string | null;
  riskSignalCount: number;
  maxRiskSeverity: "critical" | "warning" | "info" | null;
}
```

Horizontal row of four pill-shaped indicators with icon and short label. Each pill uses semantic color (green/amber/red/gray) plus icon (checkmark/warning/error/dash).

**Empty compliance state:** When all four compliance signals are null/empty (freshly parsed invoice before compliance analysis runs), render a single "Compliance: Pending" badge in gray instead of four gray pills. This reduces visual noise for new invoices that have not yet been processed. The component switches to the four-pill layout once any signal has data.

### 14.6 ActionHintBadge

**File:** `frontend/src/components/common/ActionHintBadge.tsx`

```typescript
interface ActionHintBadgeProps {
  status: InvoiceStatus;
  workflowCurrentStep?: number;
  workflowTotalSteps?: number;
  riskSignalCount: number;
  paymentStatus?: "unpaid" | "partially_paid" | "fully_paid" | "overpaid";
  paidPercent?: number;
}
```

Replaces the current status badge in the table's Status column. Renders status icon + contextual text (e.g., "Approve Step 2/3", "Review: 2 signals", "Approved -- 75% paid").

### 14.7 AgingBadge

**File:** `frontend/src/components/common/AgingBadge.tsx`

```typescript
interface AgingBadgeProps {
  dueDate: string | null;
  paymentStatus: "unpaid" | "partially_paid" | "fully_paid" | "overpaid";
}
```

Small pill showing aging bucket. Only rendered for unpaid/partially-paid invoices with a due date.

| Bucket | Label | Color |
|--------|-------|-------|
| Not yet due | `Current` | Green |
| 1-30 days | `1-30d` | Amber |
| 31-60 days | `31-60d` | Orange |
| 61-90 days | `61-90d` | Red |
| 90+ days | `90+d` | Dark red |

For MSME vendors approaching the 45-day statutory limit: clock icon with "MSME 38d" in red.

**a11y:** `aria-label="{N} days past due"`. Color supplemented by text label.

### 14.8 TenantSidebar

**File:** `frontend/src/features/tenant-admin/TenantSidebar.tsx`

```typescript
interface TenantSidebarProps {
  activeTab: TenantViewTab;
  capabilities: UserCapabilities;
  counts: { inbox: number; invoices: number };
  onTabChange: (tab: TenantViewTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

Vertical sidebar navigation (Phase 3). 14rem expanded, 3.5rem collapsed. Each item: Material icon + label. On mobile (< 980px), becomes fixed-bottom tab bar with icons only.

CSS:
```css
.tenant-sidebar {
  width: 14rem;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0;
  overflow-y: auto;
  transition: width 200ms ease;
}
.tenant-sidebar-collapsed { width: 3.5rem; }
.tenant-sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink-soft);
  cursor: pointer;
  border-radius: var(--radius-sm);
  margin: 0.125rem 0.5rem;
}
.tenant-sidebar-item:hover { background: var(--bg-hover); color: var(--ink); }
.tenant-sidebar-item-active { background: var(--accent-bg); color: var(--accent); font-weight: 600; }
```

### 14.9 SlideOverPanel

**File:** `frontend/src/components/common/SlideOverPanel.tsx`

```typescript
interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  width?: string;
  children: ReactNode;
}
```

Slide-from-right overlay panel for tablet/mobile detail views. Backdrop + panel with CSS transform transition. 70% width on tablet, 100% on mobile.

### 14.9.1 Portal

**File:** `frontend/src/components/common/Portal.tsx`

```typescript
interface PortalProps {
  containerId?: string;
  children: ReactNode;
}
```

Shared portal component wrapping `createPortal` with a managed container `<div>`. On mount, creates (or reuses) a container element with the given `containerId` (default: `"billforge-portal-root"`) appended to `document.body`. On unmount, removes the container if empty. Used by `GlCodeDropdown`, `ConfirmDialog`, and `SlideOverPanel` to render overlays at the document root, avoiding `overflow: hidden` and stacking context issues. All portal-based rendering must use this component rather than calling `createPortal` directly.

### 14.10 ActionRequiredQueue

**File:** `frontend/src/features/tenant-admin/ActionRequiredQueue.tsx`

```typescript
interface ActionRequiredQueueProps {
  onSelectInvoice: (id: string) => void;
  onApprove: (id: string) => void;
}
```

The queue makes its own API call (`GET /api/invoices?status=NEEDS_REVIEW,AWAITING_APPROVAL&sort=createdAt&limit=20`) for a complete count, independent of the invoice table's current pagination or filters. This ensures the queue badge count is always accurate regardless of which page or filter the user has active in the main invoice table.

Results are sorted by age (oldest first). Each row: vendor, amount, `AgingBadge` (used as time-since-received), `RiskDot`, action button.

### 14.11 SeverityIcon

**File:** `frontend/src/components/common/SeverityIcon.tsx`

```typescript
const SEVERITY_ICON: Record<string, string> = {
  critical: "warning",
  warning: "error",
  info: "info"
};

export function SeverityIcon({ severity }: { severity: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: "0.85rem", color: SEVERITY_COLORS[severity] }}
      aria-hidden="true"
    >
      {SEVERITY_ICON[severity] ?? "info"}
    </span>
  );
}
```

### 14.12 PaymentRecordForm

**File:** `frontend/src/features/tenant-admin/PaymentRecordForm.tsx`

See Section 7.7 for full interface. Vertically-stacked form with context header, input fields, live "After this payment" summary, and action buttons. Local `useState` for all fields.

### 14.13 PaymentHistoryTable

**File:** `frontend/src/features/tenant-admin/PaymentHistoryTable.tsx`

```typescript
interface PaymentHistoryEntry {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  amountMinor: number;
  method: string;
  utrNumber: string | null;
  chequeNumber: string | null;
  recordedBy: string;
  status: "draft" | "approved" | "processed" | "failed" | "cancelled";
}

interface PaymentHistoryTableProps {
  payments: PaymentHistoryEntry[];
  currency: string;
  totalPaidMinor: number;
  netPayableMinor: number;
  invoiceTotalMinor: number;
  tdsAmountMinor: number;
  tcsAmountMinor: number;
}
```

Stateless presentation component. Compact table with payment breakdown above, progress bar, and summary row.

### 14.14 TdsCumulativeContext

**File:** `frontend/src/components/compliance/TdsCumulativeContext.tsx`

```typescript
interface TdsCumulativeContextProps {
  vendorName: string;
  vendorFingerprint: string;
  section: string;
  financialYear: string;
  cumulativeBaseMinor: number;
  thresholdMinor: number;
  cumulativeTdsMinor: number;
  thresholdCrossedAt: string | null;
  currency: string;
  onViewVendor?: (fingerprint: string) => void;
}
```

Rendered inside CompliancePanel when TDS data present. Shows vendor's cumulative TDS position with `PaymentProgressBar` threshold indicator.

### 14.15 ComplianceSummaryBar

**File:** `frontend/src/components/compliance/ComplianceSummaryBar.tsx`

Horizontal strip with four clickable indicator slots (TDS, PAN, GL, Risk). Each slot scrolls the detail panel to the corresponding section. See Section 8.1.

### 14.16 TdsCumulativeChart

**File:** `frontend/src/features/reporting/TdsCumulativeChart.tsx`

```typescript
interface TdsCumulativeChartProps {
  vendorName: string;
  section: string;
  thresholdMinor: number;
  entries: Array<{
    invoiceDate: string;
    invoiceNumber: string;
    taxableAmountMinor: number;
    cumulativeMinor: number;
    tdsAmountMinor: number;
  }>;
  section197Validity: { from: string; to: string } | null;
  thresholdCrossedAt: string | null;
}
```

Uses Recharts `LineChart` with `ReferenceLine` for threshold. `ResponsiveContainer` with height 280px. Visually-hidden `<table>` alternative for screen readers. Recharts (~45KB gzipped) must be loaded via `React.lazy` and dynamic import; charting additions must not exceed 50KB gzipped total (see Section 14 bundle budget).

### 14.17 AgingBucketCard

**File:** `frontend/src/features/reporting/AgingBucketCard.tsx`

```typescript
interface AgingBucketCardProps {
  bucket: {
    label: string;
    invoiceCount: number;
    totalAmountMinor: number;
    msmeCount: number;
    msmeAmountMinor: number;
  };
  isActive: boolean;
  onClick: () => void;
}
```

**a11y:** `role="button"`, `aria-pressed`, `aria-label`.

### 14.18 MatchConfidenceBreakdown

**File:** `frontend/src/features/tenant-admin/MatchConfidenceBreakdown.tsx`

```typescript
interface MatchConfidenceBreakdownProps {
  breakdown: MatchScoreBreakdown;
  totalScore: number;
}
```

Horizontal segmented bars showing scoring factors. CSS `linear-gradient` backgrounds. Stacks labels above bars below 480px.

**a11y:** Each bar has `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

### 14.19 AmountDifferenceExplanation

**File:** `frontend/src/features/tenant-admin/AmountDifferenceExplanation.tsx`

```typescript
interface AmountDifferenceExplanationProps {
  invoiceGrossMinor: number;
  tdsAmountMinor: number;
  tdsSection: string | null;
  tdsRateBps: number | null;
  tcsAmountMinor: number;
  bankDebitMinor: number;
  currency: string;
  toleranceMinor?: number;
}
```

Stateless. Computes `expectedDebit = invoiceGross - tds + tcs`. Structured as a `<dl>` for screen readers.

### 14.20 CollapsibleConfigSection

**File:** `frontend/src/features/tenant-admin/CollapsibleConfigSection.tsx`

```typescript
interface CollapsibleConfigSectionProps {
  id: string;
  title: string;
  summary: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  dragHandleProps?: Record<string, unknown>;
}
```

Wraps each section in `TenantConfigTab` with collapsible card showing one-line summary when collapsed.

### 14.21 SetupWizard

**File:** `frontend/src/features/tenant-admin/SetupWizard.tsx`

```typescript
interface SetupWizardProps {
  onComplete: () => void;
}

interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
}
```

Orchestrates the 5-step onboarding wizard. Horizontal stepper with filled/outlined/gray circles. Single-column layout. Stepper shrinks to numbered circles without labels below 600px.

### 14.22 WizardStep

**File:** `frontend/src/features/tenant-admin/WizardStep.tsx`

```typescript
interface WizardStepProps {
  stepNumber: number;
  title: string;
  isActive: boolean;
  isComplete: boolean;
  isSkipped: boolean;
  children: ReactNode;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}
```

### 14.23 TallyConfigPanel

**File:** `frontend/src/features/tenant-admin/TallyConfigPanel.tsx`

```typescript
interface TallyConfigFormState {
  companyName: string;
  purchaseLedger: string;
  bankLedger: string;
  tdsPayableLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  cessLedger: string;
  autoCreateVendors: boolean;
  endpointUrl: string;
}
```

Local form state with dirty detection. Two-column grid for GST ledger fields, single column below 768px.

### 14.24 ExportBatchDetail

**File:** `frontend/src/features/tenant-admin/ExportBatchDetail.tsx`

```typescript
interface ExportBatchDetailProps {
  batchId: string;
  onReExport: (invoiceIds: string[]) => void;
}
```

Fetches `GET /api/exports/:batchId/items` on mount. 3 skeleton rows while loading. Failed invoices shown first.

### 14.25 ExportProgressIndicator

**File:** `frontend/src/features/tenant-admin/ExportProgressIndicator.tsx`

```typescript
interface ExportProgressEvent {
  type: "progress" | "complete" | "error";
  batchId: string;
  currentInvoiceNumber: string | null;
  processedCount: number;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

interface ExportProgressIndicatorProps {
  event: ExportProgressEvent;
  onDismiss: () => void;
}
```

**a11y:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

### 14.26 ReconciliationSplitPane

**File:** `frontend/src/features/tenant-admin/ReconciliationSplitPane.tsx`

See Section 12.1 for full specification. Two `role="region"` panels with `Tab` between panels, arrow keys within.

### 14.27 SplitMatchPanel

**File:** `frontend/src/features/tenant-admin/SplitMatchPanel.tsx`

```typescript
interface SplitMatchPanelProps {
  transaction: BankTransactionEntry;
  candidates: ReconciliationCandidate[];
  onSave: (mappings: Array<{ invoiceId: string; allocatedMinor: number }>) => void;
  onCancel: () => void;
}
```

### 14.28 AggregateMatchPanel

**File:** `frontend/src/features/tenant-admin/AggregateMatchPanel.tsx`

```typescript
interface AggregateMatchPanelProps {
  invoice: Invoice;
  candidateTransactions: BankTransactionEntry[];
  onSave: (mappings: Array<{ bankTransactionId: string; allocatedMinor: number }>) => void;
  onCancel: () => void;
}
```

### 14.29 useFocusTrap Hook

**File:** `frontend/src/hooks/useFocusTrap.ts`

```typescript
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const initialFocusable = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    initialFocusable[0]?.focus();
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [ref, active]);
}
```

Re-querying `querySelectorAll` on each Tab keypress (rather than caching on mount) ensures dynamically added/removed focusable elements are correctly included in the trap cycle.

### 14.30 useBreakpoint Hook

**File:** `frontend/src/hooks/useBreakpoint.ts`

```typescript
type Breakpoint = "mobile" | "tablet" | "desktop";

const MQL_MOBILE = "(max-width: 640px)";
const MQL_TABLET = "(max-width: 1023px)";

function getBreakpointFromMedia(): Breakpoint {
  if (window.matchMedia(MQL_MOBILE).matches) return "mobile";
  if (window.matchMedia(MQL_TABLET).matches) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpointFromMedia);
  useEffect(() => {
    const mql640 = window.matchMedia(MQL_MOBILE);
    const mql1024 = window.matchMedia(MQL_TABLET);
    const update = () => setBp(getBreakpointFromMedia());
    mql640.addEventListener("change", update);
    mql1024.addEventListener("change", update);
    return () => {
      mql640.removeEventListener("change", update);
      mql1024.removeEventListener("change", update);
    };
  }, []);
  return bp;
}
```

Both initial state calculation and ongoing change detection use `window.matchMedia` (not `window.innerWidth` for initial) to ensure consistency across platforms with varying scrollbar widths. `window.innerWidth` excludes scrollbar width on some platforms, causing a mismatch with CSS media query thresholds that `matchMedia` correctly tracks.

### 14.31 useRovingTabIndex Hook

**File:** `frontend/src/hooks/useRovingTabIndex.ts`

Implements arrow-key navigation between tab elements. Only the active tab is `tabIndex={0}`, others are `tabIndex={-1}`. Left/Right arrows move focus. Home/End jump to first/last.

### 14.32 usePanelSplit Hook

**File:** `frontend/src/hooks/usePanelSplit.ts`

```typescript
interface UsePanelSplitOptions {
  initialPercent: number;
  min: number;
  max: number;
  storageKey: string;
  orientation: "horizontal" | "vertical";
}

interface UsePanelSplitReturn {
  percent: number;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  dividerProps: Record<string, unknown>;
}
```

Extracts the shared divider/split pattern currently implemented as raw event listeners in `TenantInvoicesViewImpl.handleDividerMouseDown` (lines 564-588). Reused by the invoice list/detail split, the reconciliation split pane, and any future two-panel layouts. Props: `initialPercent` (default split ratio), `min`/`max` (clamp boundaries), `storageKey` (localStorage persistence key), `orientation` (horizontal or vertical split). Includes touch events (`onTouchStart`/`onTouchMove`/`onTouchEnd`) and keyboard resize (`Shift+ArrowLeft`/`Shift+ArrowRight` for horizontal, `Shift+ArrowUp`/`Shift+ArrowDown` for vertical, 2% per keypress). Persists to `localStorage` under the provided `storageKey`.

---

## 15. Layout & Responsiveness

### 15.1 Responsive Breakpoints Strategy

Three layout modes with clear behavioral contracts:

| Mode | Breakpoint | Layout | Detail Panel Behavior |
|---|---|---|---|
| Desktop | >= 1024px | Side-by-side split with draggable divider | Inline panel, user-adjustable width |
| Tablet | 641px - 1023px | Full-width list | Slide-over overlay from right (70% width) with backdrop |
| Mobile | <= 640px | Full-width list, simplified columns | Full-screen overlay with back button |

### 15.2 Detail Panel as Overlay

On tablet/mobile, `TenantInvoiceDetailPanel` is wrapped in `SlideOverPanel` (Section 14.9). The overlay includes a sticky back button and swipe-right-to-dismiss gesture (optional).

### 15.2.1 Tablet Tap Target Disambiguation

On tablet (641px-1023px), touch targets follow these rules:

- **Entire row is tap target for detail**: Tapping anywhere on the row (except exclusion zones) opens the `SlideOverPanel` with the invoice detail view.
- **Exclusion zones**: The checkbox column (`data-col="checkbox"`) and action buttons column (`data-col="actions"`) are independent tap targets and do not trigger row selection.
- **Cell-level interactions disabled on tablet**: Interactive cells that work on desktop (GL code dropdown, inline edit fields) are disabled on tablet. These interactions move into the `SlideOverPanel` detail view, where they have adequate touch target size (minimum 44x44px per WCAG 2.1 AA).
- **Implementation**: The `useBreakpoint` hook (Section 14.30) gates interactive cell rendering. On tablet/mobile, GL code renders as read-only text in the table; the editable dropdown appears only in the detail panel.

```typescript
const breakpoint = useBreakpoint();
const isTouch = breakpoint === "tablet" || breakpoint === "mobile";

// In table cell:
{isTouch ? (
  <span>{invoice.compliance?.glCode?.code ?? "--"}</span>
) : (
  <GlCodeDropdown invoice={invoice} onSelect={handleGlSelect} />
)}
```

### 15.3 Invoice Table Column Tiers

| Tier | Columns | Visibility |
|---|---|---|
| Always visible | Vendor, Amount, Status | All breakpoints |
| Desktop + Tablet | Invoice #, Date, Tax, Risk, GL Code | Hidden on mobile |
| Desktop only | Checkbox, Approver, Actions | Hidden on tablet and mobile |

On mobile, selection and bulk actions move to a contextual bottom sheet triggered by long-press.

### 15.4 Vendor List Responsiveness

- Below 1024px: Hide GSTIN and Last Activity columns.
- Below 768px: Hide PAN and Tally Status. Card layout with stacked fields.

### 15.5 TDS Dashboard Responsiveness

- KPI cards: 4-column grid above 1024px, 2-column below, 1-column below 640px.
- Chart full-width. Table horizontal-scrollable below 768px.

### 15.6 Reconciliation Responsiveness

- Above 1024px: side-by-side split pane (CSS grid `1fr 1fr`) with draggable divider.
- Below 1024px: stacked vertically with fixed-height scrollable areas.

### 15.7 Config Tab Responsiveness

- GST ledger fields: two-column grid, single column below 768px.
- Setup wizard: single-column at all widths, stepper shrinks below 600px.

---

## 16. Accessibility

### 16.1 ARIA Roles Audit

| Issue | Location | Fix |
|---|---|---|
| Tab buttons lack `role="tab"` | `TenantViewTabs.tsx` | Add `role="tab"` + `aria-selected` |
| Status filter tabs lack ARIA | `TenantInvoicesToolbar.tsx` | Add `role="tablist"` to container, `role="tab"` + `aria-selected` to buttons |
| Invoice table lacks `role="grid"` | `TenantInvoicesViewImpl.tsx` | Add `role="grid"`, `role="row"`, `role="gridcell"`. Active row gets `aria-selected="true"` |
| Detail panel lacks landmark | `TenantInvoiceDetailPanel.tsx` | Wrap in `<section role="complementary" aria-label="Invoice details">` |
| Risk signal expand/collapse | `RiskSignalList.tsx` | Add `role="button"`, `aria-expanded`, `aria-controls` |
| GL code dropdown | `CompliancePanel.tsx` | Add `role="listbox"`, `role="option"`, `aria-activedescendant` |
| Vendor table | `VendorListView.tsx` | `role="table"`, sortable headers with `aria-sort` |
| Vendor detail sub-tabs | `VendorDetailView.tsx` | `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected` |
| Merge dialog | `VendorMergeDialog.tsx` | `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close |
| Reconciliation panels | `ReconciliationSplitPane.tsx` | Two `role="region"` panels, `Tab` between panels, arrow keys within |
| Aging bucket cards | `AgingBucketCard.tsx` | `role="button"`, `aria-pressed` |

### 16.2 Color-Only Differentiation Fixes

| Element | Fix |
|---------|-----|
| `RiskDot` | Add icon inside: triangle for critical, circle-exclamation for warning, checkmark for clean + `aria-label` |
| Status badge colors | Ensure Material icon always rendered alongside color |
| `ConfidenceBadge` (deprecated) | Add text prefix "Low"/"Medium"/"High" |
| `MatchStatusBadge` | Distinct left-border patterns alongside text labels |
| Risk signal severity | Left-border + icon prefix via `SeverityIcon` (Section 14.11) |
| Aging badge | Text label ("1-30d") supplements color |

### 16.3 Keyboard Navigation Fixes

| Gap | Fix |
|-----|-----|
| Tab bar arrow-key navigation | Roving tabindex via `useRovingTabIndex` (Section 14.31) |
| Invoice table rows | Add `tabIndex` to `<tr>`, call `row.focus()` on j/k navigation |
| Detail panel sections | Ensure collapse trigger has `role="button"`, `tabIndex={0}`, `aria-expanded` |
| Modal focus trapping | `useFocusTrap` hook (Section 14.29) |
| GL code dropdown keyboard | `aria-activedescendant` pattern: up/down arrows, Enter selects, Escape closes |

### 16.4 Skip-to-Content Link

Add visually hidden skip link as first focusable element in `App.tsx`:

```typescript
<a href="#main-content" className="skip-to-content">Skip to main content</a>
```

```css
.skip-to-content {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 9999;
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.skip-to-content:focus { left: 0; }
```

---

## 17. Implementation Phasing

### Phase 0 -- Quick Wins (3 sub-sprints)

Phase 0 is decomposed into three sub-sprints with explicit dependency ordering. Sub-sprints 0b and 0c can run in parallel with 2 engineers.

#### Phase 0a -- Pure Frontend, Zero Backend Dependency (1 week, 1 engineer)

All items use only existing data already present on the client. No new API endpoints required.

| Item | Components | Effort |
|------|-----------|--------|
| QW-1: Risk signals expanded | `RiskSignalList` prop change | 1 hour |
| QW-2: Risk dot column | `RiskDot` + table column | 3 hours |
| QW-3: PAN label fix | `CompliancePanel` text change | 30 min |
| QW-4: Action hints | `ActionHintBadge` + helper | 2 hours |
| QW-5: ARIA tabs fix | `TenantViewTabs`, `TenantInvoicesToolbar` | 2 hours |
| `SlideOverPanel` + `Portal` | ~50 lines each, zero backend dependency. Prerequisite for tablet responsiveness in all subsequent phases. | 0.5 days |
| Accessibility pass | ARIA fixes, `SeverityIcon`, skip link, `useRovingTabIndex` | 2-3 days |

**Total 0a**: ~5.5 engineering days

#### Phase 0b -- Client Logic + Existing API Data (1.5 weeks, 1 engineer)

These items build new UI components but consume data already available in existing API responses (invoice list, invoice detail). No new backend endpoints.

| Item | Components | Effort |
|------|-----------|--------|
| QW-6: Action Required Queue | `ActionRequiredQueue` (filters existing invoice list data) | 10-14 hours |
| QW-7: Pre-export validation | `PreExportValidationModal` (client-side checks on existing fields) | 10-14 hours |
| Compliance redesign | `ComplianceSummaryBar`, `ComplianceStatusIndicator`, TDS rate source badge, GL dropdown portal | 2-3 days |

**Total 0b**: ~7.5 engineering days

#### Phase 0c -- Requires Backend APIs (1.5 weeks, 1 engineer)

These items depend on new backend endpoints. Backend must deliver the listed APIs before frontend work begins.

| Item | Components | Backend Dependency | Effort |
|------|-----------|-------------------|--------|
| Column responsiveness | CSS breakpoints, `data-col` attributes | None (CSS only) | 1 day |
| `ExportBatchDetail` | Per-invoice export breakdown | `GET /api/exports/:batchId/items` | 2 days |
| `AmountDifferenceExplanation` | Pure render component | None (pure computation) | 0.5 days |
| `TallyConfigPanel` | Tally config section in Settings | `GET/PATCH /api/tenant/tally-config` | 1.5 days |
| `CollapsibleConfigSection` wrappers | Wraps existing sections | None | 0.5 days |

**Total 0c**: ~5.5 engineering days

**Phase 0b and 0c can run in parallel** with 2 engineers, reducing wall-clock time to ~2.5 weeks total (0a sequential, then 0b+0c parallel).

**Total Phase 0**: ~18 implementation days + ~5 testing days (unit: 2d, integration: 1.5d, visual regression: 1d, a11y audit: 0.5d)

### Phase 1 -- TDS Dashboard (with backend Phase 1, 2-3 weeks)

| Item | Components | Effort |
|------|-----------|--------|
| TDS Dashboard | `TdsDashboard`, `TdsDashboardKpis`, `TdsLiabilityTable`, `TdsCumulativeChart` | 5-7 days |
| `TdsCumulativeContext` in detail panel | API integration, vendor link | 2-3 days |

**Total Phase 1**: ~7-10 implementation days + ~3 testing days (unit: 1.5d, integration: 1d, visual regression: 0.5d)

### Phase 2 -- Vendor Management (with backend Phase 2, 1-2 weeks)

| Item | Components | Effort |
|------|-----------|--------|
| Vendor List View | `VendorListView` with search, filters, pagination | 3-4 days |
| Vendor Detail View | `VendorDetailView` with 5 sub-tabs | 3-4 days |
| Vendor Merge Dialog | `VendorMergeDialog` with dry-run preview | 2 days |
| Navigation: add Vendors tab | `TenantViewTabs` + `App.tsx` routing | 0.5 days |

**Total Phase 2**: ~8-10 implementation days + ~4 testing days (unit: 2d, integration: 1.5d, visual regression: 0.5d)

### Phase 3 -- Payment Recording (with backend Phase 3, 2-3 weeks)

| Item | Components | Effort |
|------|-----------|--------|
| Payment Recording Form | `PaymentRecordForm` (single + multi) | 3-4 days |
| Payment History | `PaymentHistoryTable`, `PaymentProgressBar` | 2 days |
| Payment status columns | `PaymentStatusBadge`, `AgingBadge` in table | 1 day |
| `MatchConfidenceBreakdown` | Scoring factor visualization | 1 day |
| `PaymentVoucherExportPanel` | Payment voucher export section | 2 days |
| `ExportProgressIndicator` | SSE-driven progress bar | 1 day |

**Total Phase 3**: ~10-12 implementation days + ~5 testing days (unit: 2.5d, integration: 2d, visual regression: 0.5d)

### Phase 4 -- Payment Voucher Export (with backend Phase 4)

Phase 4 (Payment Voucher Export) has no dedicated frontend work. Payment voucher export reuses the existing `ExportHistoryDashboard` with a new "Payment Vouchers" tab/filter. No new components required -- the `PaymentVoucherExportPanel` built in Phase 3 handles the export trigger, and the batch detail view from Phase 0c displays per-voucher results.

**Total Phase 4 frontend**: 0 additional engineering days

### Phase 5 -- Reconciliation Redesign (with backend Phase 5, 3-4 weeks)

Realistic estimate: 12-14 engineering days, split into two sub-phases.

**Phase 5a -- Split pane layout + basic 1:1 matching display (7 days):**

| Item | Components | Effort |
|------|-----------|--------|
| `ReconciliationSplitPane` | Two-panel layout with visual differentiation, draggable divider | 4 days |
| Basic 1:1 matching display | Transaction selection, candidate list, `AmountDifferenceExplanation` | 3 days |

**Phase 5b -- Split/aggregate matching UI + confidence visualization (7 days):**

| Item | Components | Effort |
|------|-----------|--------|
| `SplitMatchPanel` | One-to-many matching with allocation editing | 3 days |
| `AggregateMatchPanel` | Many-to-one matching | 2 days |
| `MatchConfidenceBreakdown` | Scoring factor visualization in reconciliation context | 2 days |

**Total Phase 5**: ~12-14 implementation days + ~5 testing days (unit: 2.5d, integration: 2d, visual regression: 0.5d)

### Post-MVP -- Navigation Restructure & Onboarding

| Item | Components | Effort |
|------|-----------|--------|
| Navigation sidebar | `TenantSidebar`, `App.tsx` layout restructure | 3-4 days |
| Mobile detail panel integration | Wire `SlideOverPanel` (built in Phase 0a) into invoice detail + vendor detail for mobile breakpoint | 1 day |
| Setup Wizard | `SetupWizard`, `WizardStep` | 3 days |

**Total Post-MVP**: ~7 implementation days + ~4 testing days (unit: 2d, integration: 1d, visual regression: 0.5d, a11y audit: 0.5d)

**Grand Total Across All Phases**: ~54 implementation days + ~27 testing days = ~81 engineering days

| Category | Days |
|----------|------|
| Implementation | 54 |
| Unit tests | 13.5 |
| Integration tests | 9 |
| Visual regression | 3 |
| a11y audit | 1 |
| Performance profiling | 0.5 |

---

## 18. API Dependencies

### 18.1 Endpoints Consumed by Frontend

| Endpoint | Method | Used By | Phase |
|----------|--------|---------|-------|
| `/api/vendors` | GET | `VendorListView` | 2 |
| `/api/vendors/:fingerprint` | GET | `VendorDetailView` | 2 |
| `/api/vendors/:fingerprint` | PATCH | `VendorDetailView` (edit) | 2 |
| `/api/vendors/:fingerprint/merge` | POST | `VendorMergeDialog` (dry-run + execute) | 2 |
| `/api/vendors/:fingerprint/cert` | POST | `VendorDetailView` (Section 197 upload) | 2 |
| `/api/payments` | POST | `PaymentRecordForm` | 3 |
| `/api/payments` | GET | `PaymentHistoryTable`, `PaymentsTab` | 3 |
| `/api/payments/:id` | GET | Payment detail | 3 |
| `/api/payments/:id` | PATCH | Update draft payment | 3 |
| `/api/payments/:id/approve` | POST | Payment approval | 3 |
| `/api/payments/:id/allocate` | POST | Allocate advance payment | 3 |
| `/api/reports/tds-liability` | GET | `TdsDashboard`, `TdsCumulativeContext` | 1 |
| `/api/reports/tds-liability` (format=csv) | GET | 26Q CSV export | 1 |
| `/api/reports/payment-aging` | GET | `AgingReportView` | 3 |
| `/api/reports/reconciliation` | GET | `ReconciliationSummaryView` | 5 |
| `/api/reports/vendor-summary` | GET | `VendorPaymentSummaryView` | 3 |
| `/api/exports/:batchId/items` | GET | `ExportBatchDetail` | 0 |
| `/api/exports/tally/payment-vouchers` | POST | `PaymentVoucherExportPanel` | 4 |
| `/api/reconciliation/candidates` | GET | `ReconciliationSplitPane` | 5 |
| `/api/reconciliation-mappings` | POST | `SplitMatchPanel`, `AggregateMatchPanel` | 5 |
| `/api/reconciliation-mappings` | GET | Mapping list | 5 |
| `/api/reconciliation-mappings/:id` | DELETE | Remove mapping | 5 |
| `/api/tenant/tally-config` | GET/PATCH | `TallyConfigPanel` | 0 |
| `/api/tenant/setup-progress` | GET/PATCH | `SetupWizard` | Post-MVP |
| `/api/invoices/count` | GET | Impact preview in config | 0 |

### 18.2 Type Extensions Required

The `Invoice` interface in `frontend/src/types.ts` must be extended:

```typescript
paymentStatus?: "unpaid" | "partially_paid" | "fully_paid" | "overpaid";
paidAmountMinor?: number;
```

The `InvoiceCompliance.tds` type must gain `rateSource`:

```typescript
rateSource?: "standard" | "tenant_override" | "section_197" | "no_pan_206aa";
```

#### Tab Type Migration

The `TenantViewTab` type evolves per phase. Each phase shows the exact union; old and new keys never coexist without a deprecation plan.

**Phase 0 (unchanged):**
```typescript
export type TenantViewTab =
  | "overview" | "dashboard" | "config" | "exports" | "statements" | "connections";
```

**Phase 2 (add Vendors):**
```typescript
export type TenantViewTab =
  | "overview" | "dashboard" | "config" | "exports" | "statements" | "connections"
  | "vendors";
```

**Phase 3 (add Payments):**
```typescript
export type TenantViewTab =
  | "overview" | "dashboard" | "config" | "exports" | "statements" | "connections"
  | "vendors" | "payments";
```

**Phase 5 (rename Statements to Reconciliation):**
```typescript
export type TenantViewTab =
  | "overview" | "dashboard" | "config" | "exports" | "connections"
  | "vendors" | "payments" | "reconciliation";
// "statements" removed -- all references migrated to "reconciliation"
```

**Post-MVP (sidebar navigation):**
```typescript
export type TenantViewTab =
  | "dashboard" | "inbox" | "invoices" | "vendors" | "payments"
  | "reconciliation" | "exports" | "settings";
// Removed: "overview" (merged into "dashboard"), "config" and "connections" (merged into "settings")
// Renamed: "dashboard" key (was Invoices) -> "invoices"
// Added: "inbox", "settings"
```

### 18.3 New API Client Functions

```typescript
export async function fetchVendors(params: {
  search?: string;
  status?: string;
  tdsSection?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<VendorListResponse>;

export async function fetchVendorDetail(
  fingerprint: string
): Promise<VendorDetail>;

export async function updateVendor(
  fingerprint: string,
  updates: Partial<VendorDetail>
): Promise<VendorDetail>;

export async function mergeVendor(
  fingerprint: string,
  targetFingerprint: string,
  dryRun?: boolean
): Promise<VendorMergePreview | { success: boolean }>;

export async function uploadVendorCert(
  fingerprint: string,
  file: File,
  metadata: { certificateNumber: string; validFrom: string; validTo: string; maxAmountMinor: number; applicableRateBps: number }
): Promise<void>;

export async function recordPayment(payment: {
  amountMinor: number;
  paymentDate: string;
  method: string;
  utrNumber: string | null;
  chequeNumber: string | null;
  notes: string | null;
  allocations: Array<{ invoiceId: string; allocatedMinor: number }>;
}): Promise<{ paymentId: string; paymentNumber: string }>;

export async function fetchPaymentsByInvoice(
  invoiceId: string
): Promise<{ items: PaymentHistoryEntry[] }>;

export async function checkDuplicateUtr(
  utrNumber: string
): Promise<{ isDuplicate: boolean; existingPaymentNumber?: string }>;

export async function fetchTdsLiability(params: {
  fy: string;
  quarter?: string;
  section?: string;
  vendorFingerprint?: string;
  format?: "json" | "csv";
}): Promise<TdsLiabilityReport>;

export async function fetchPaymentAging(params: {
  fy?: string;
  msmeOnly?: boolean;
  bucket?: string;
}): Promise<AgingReportData>;

export async function fetchReconciliationSummary(): Promise<ReconciliationSummaryData>;

export async function fetchVendorSummary(params: {
  fy: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<VendorPaymentSummaryData>;

export async function fetchExportBatchItems(
  batchId: string
): Promise<ExportBatchDetailResponse>;

export async function fetchReconciliationCandidates(
  transactionId: string,
  limit?: number
): Promise<{ candidates: ReconciliationCandidate[] }>;

export async function createReconciliationMappings(
  mappings: Array<{
    bankTransactionId?: string;
    invoiceId?: string;
    allocatedMinor: number;
  }>
): Promise<void>;

export async function fetchTallyConfig(): Promise<TallyConfigFormState>;

export async function updateTallyConfig(
  updates: Partial<TallyConfigFormState>
): Promise<TallyConfigFormState>;
```

### 18.4 Caching Strategy

| View | Cache Strategy |
|------|---------------|
| Vendor List | Refetch on search/filter/sort/page change. No stale cache. |
| Vendor Detail | Fetch on mount. Refetch on edit save. Sub-tab data fetched lazily, cached in state. |
| TDS Dashboard | Fetch on mount and FY/quarter change. Stale data at 0.5 opacity during refetch. |
| Aging Report | Fetch on mount. Refetch on MSME filter toggle. Drill-down per bucket click. |
| Reconciliation Summary | Fetch on mount. Manual "Refresh" button. |
| Payment History | Fetch per invoice on detail panel open. Refresh after payment recorded. |

### 18.5 Error Handling Pattern

All API calls follow the existing pattern:
1. Catch errors from `apiClient` calls.
2. Check `isAuthenticationError` -- if true, call `onSessionExpired()`.
3. Extract message via `getUserFacingErrorMessage`.
4. Display via `addToast("error", message)` for transient errors.
5. Set `error` state for blocking errors (e.g., vendor detail load failure).

### 18.6 Mock Strategy for Parallel Development

Frontend and backend work proceeds in parallel using MSW (Mock Service Worker) fixtures. Each phase defines its own fixture set, contract handoff milestone, and integration milestone.

**Setup**: MSW runs in development mode (`src/mocks/browser.ts`). Handlers are organized per-phase in `src/mocks/handlers/`.

| Phase | MSW Fixtures | Contract Handoff | Integration Milestone |
|-------|-------------|-----------------|----------------------|
| 0c | `GET /api/exports/:batchId/items`, `GET/PATCH /api/tenant/tally-config` | Backend delivers OpenAPI schema for export items + tally config endpoints by end of Phase 0a | Frontend removes MSW handlers, runs against real backend by end of Phase 0c |
| 1 | `GET /api/reports/tds-liability` (JSON + CSV) | Backend delivers TDS liability API contract before Phase 1 frontend starts | Integration test with real data at Phase 1 midpoint |
| 2 | `GET /api/vendors`, `GET/PATCH /api/vendors/:fingerprint`, `POST /api/vendors/:fingerprint/merge` | Backend delivers vendor CRUD contract 1 week before Phase 2 frontend starts | End-to-end vendor flow test at Phase 2 end |
| 3 | `POST /api/payments`, `GET /api/payments`, `GET /api/payments/summary` | Backend delivers payment contract 1 week before Phase 3 frontend starts | Payment recording e2e test at Phase 3 end |
| 5 | `GET /api/reconciliation/candidates`, `POST /api/reconciliation-mappings` | Backend delivers reconciliation contract at Phase 5 kickoff | Split/aggregate matching e2e test at Phase 5 end |

**Fixture data location**: `frontend/src/mocks/fixtures/` with typed fixture factories (e.g., `createMockVendor()`, `createMockPayment()`) reused by both MSW handlers and unit tests.

**Contract enforcement**: MSW handlers validate request shapes against the agreed OpenAPI schema. If the backend changes the contract, the MSW handler fails loudly in development, catching drift before integration.

### 18.7 Feature Flag Strategy

Feature flags gate new tabs and major features at the tenant level. Flags are served from tenant config (`GET /api/tenant/config`) and cached for the session duration.

| Flag | Controls | Phase | Default |
|------|----------|-------|---------|
| `ff_vendors_tab` | Vendors tab visibility, vendor-related columns | 2 | `false` |
| `ff_payments_tab` | Payments tab, payment recording forms, payment status columns | 3 | `false` |
| `ff_reconciliation_v2` | New split-pane reconciliation UI (replaces legacy `BankStatementsTab`) | 5 | `false` |
| `ff_setup_wizard` | New tenant onboarding wizard (replaces raw `TenantConfigTab` for unconfigured tenants) | Post-MVP | `false` |

**Implementation**: A `useFeatureFlags` hook reads flags from `TenantConfigContext`:

```typescript
interface FeatureFlags {
  ff_vendors_tab: boolean;
  ff_payments_tab: boolean;
  ff_reconciliation_v2: boolean;
  ff_setup_wizard: boolean;
}

function useFeatureFlags(): FeatureFlags {
  const { tenantConfig } = useTenantWorkspace();
  return tenantConfig.featureFlags ?? {};
}
```

**Rollback**: Disabling a flag server-side immediately hides the feature on next page load. No frontend deploy required. Data created while the flag was enabled remains intact (flags gate UI, not data).

**Progressive rollout**: Flags enable per-tenant rollout. Enable for internal/test tenants first, then percentage-based rollout, then general availability (flag removed from code, feature always on).

### 18.8 Optimistic Updates

Vendor edits (`PATCH /api/vendors/:fingerprint`): immediately update local state, show "Saving..." indicator, revert on failure.

Vendor merge: NOT optimistic -- irreversible operation. Dialog shows "Merging..." spinner until server confirms.

Payment recording: NOT optimistic -- financial data requires server confirmation.

---

## File Structure Summary

New files to be created:

```
frontend/src/
  components/
    common/
      StatusBadge.tsx
      ActionHintBadge.tsx (14.6)
      AgingBadge.tsx (14.7)
      PaymentProgressBar.tsx (14.3)
      PaymentStatusBadge.tsx (14.4)
      SlideOverPanel.tsx (14.9)
      Portal.tsx (14.9.1)
      SeverityIcon.tsx (14.11)
    compliance/
      RiskDot.tsx (14.1)
      ComplianceStatusIndicator.tsx (14.5)
      ComplianceSummaryBar.tsx (14.15)
      TdsCumulativeContext.tsx (14.14)
  features/
    tenant-admin/
      ActionRequiredQueue.tsx (14.10)
      TenantSidebar.tsx (14.8)
      PaymentRecordForm.tsx (14.12)
      PaymentHistoryTable.tsx (14.13)
      PreExportValidationModal.tsx (QW-7)
      ExportBatchDetail.tsx (14.24)
      ExportProgressIndicator.tsx (14.25)
      PaymentVoucherExportPanel.tsx (11.3)
      ReconciliationSplitPane.tsx (14.26)
      SplitMatchPanel.tsx (14.27)
      AggregateMatchPanel.tsx (14.28)
      MatchConfidenceBreakdown.tsx (14.18)
      AmountDifferenceExplanation.tsx (14.19)
      CollapsibleConfigSection.tsx (14.20)
      TallyConfigPanel.tsx (14.23)
      SetupWizard.tsx (14.21)
      WizardStep.tsx (14.22)
    vendor/
      VendorListView.tsx (9.1)
      VendorDetailView.tsx (9.2)
      VendorMergeDialog.tsx (9.3)
      VendorEditForm.tsx
      VendorInvoicesSubTab.tsx
      VendorTdsSubTab.tsx
      VendorPaymentsSubTab.tsx
      VendorBankSubTab.tsx
      VendorMsmeSubTab.tsx
    reporting/
      TdsDashboard.tsx (10.1)
      TdsDashboardKpis.tsx
      TdsLiabilityTable.tsx (10.2)
      TdsCumulativeChart.tsx (14.16)
      AgingReportView.tsx (10.4)
      AgingBucketCard.tsx (14.17)
      ReconciliationSummaryView.tsx (10.5)
      VendorPaymentSummaryView.tsx (10.6)
  hooks/
    useFocusTrap.ts (14.29)
    useBreakpoint.ts (14.30)
    useRovingTabIndex.ts (14.31)
    usePanelSplit.ts (14.32)
  api/
    vendor.ts
    reports.ts
```

Modified files:
- `frontend/src/types.ts` -- extend `TenantViewTab`, add vendor/payment/report interfaces
- `frontend/src/features/tenant-admin/TenantViewTabs.tsx` -- add new tab buttons
- `frontend/src/App.tsx` -- add conditional rendering for new tabs, layout restructure in Phase 3
- `frontend/src/features/tenant-admin/TenantInvoicesViewImpl.tsx` -- new columns, pre-export modal integration, action hints
- `frontend/src/components/compliance/CompliancePanel.tsx` -- PAN labels, TDS rate source, GL dropdown portal
- `frontend/src/components/compliance/RiskSignalList.tsx` -- `defaultExpanded` prop
- `frontend/src/features/tenant-admin/TenantInvoiceDetailPanel.tsx` -- ComplianceSummaryBar, PaymentHistory, ComplianceStatusIndicator
- `frontend/src/features/tenant-admin/TenantInvoicesToolbar.tsx` -- ARIA attributes
- `frontend/src/features/tenant-admin/TenantConfigTab.tsx` -- CollapsibleConfigSection wrappers, Tally section
- `frontend/src/features/tenant-admin/ExportHistoryDashboard.tsx` -- expandable batch detail
- `frontend/src/styles.css` -- responsive breakpoints, new component styles

---

## 19. Testing Strategy

### 19.1 Unit Test Coverage

**Target**: 100% branch coverage for all files in `frontend/src/components/` and `frontend/src/features/`. Enforced via Jest `coverageThreshold` in `package.json`.

**Framework**: Vitest + React Testing Library (`@testing-library/react`).

**Per-component requirements:**
- Every exported component has a `*.test.tsx` co-located file.
- Tests cover all conditional rendering paths (loading, error, empty, populated, edge cases).
- Tests verify ARIA attributes (`role`, `aria-selected`, `aria-expanded`, `aria-label`) are applied correctly.
- Tests for interactive components verify keyboard interactions (Enter, Space, Escape, arrow keys).

**Hook testing**: Custom hooks (`useInvoiceTableState`, `useInvoiceFilters`, `useBreakpoint`, etc.) are tested via `renderHook` from `@testing-library/react`.

### 19.2 Integration Tests

**Scope**: API client functions (`frontend/src/api/*.ts`) tested against MSW handlers to verify request construction, response parsing, and error handling.

**Coverage targets:**
- Every API client function has at least one success and one error test case.
- Authentication error handling (`isAuthenticationError` -> `onSessionExpired`) verified for every client function.
- Pagination, filtering, and sorting parameters verified for list endpoints.

### 19.3 Visual Regression

**Tool**: Playwright screenshots at 3 breakpoints (1440px desktop, 768px tablet, 375px mobile).

**Scope**: Key views captured per phase:
- Phase 0: Invoice table (with new Risk column, action hints), detail panel (with ComplianceSummaryBar), pre-export validation modal.
- Phase 2: Vendor list, vendor detail (all 5 sub-tabs), vendor merge dialog.
- Phase 3: Payment recording form (single + multi-vendor), payment history section.
- Phase 5: Reconciliation split-pane, split match panel, aggregate match panel.

**Threshold**: Pixel diff tolerance of 0.1%. Failures block PR merge.

### 19.4 Accessibility (a11y) Testing

**Automated**: `axe-core` integrated into CI via `@axe-core/react` in development and `jest-axe` in unit tests. Every component test includes `expect(await axe(container)).toHaveNoViolations()`.

**Standard**: WCAG 2.1 AA compliance.

**Manual smoke tests** (run per phase):
- Tab through entire app using keyboard only -- verify all interactive elements are reachable.
- Verify screen reader announces all status changes (toast notifications, status badge updates, progress bars).
- Verify color-only differentiation fixes (Section 16.2) -- all information conveyed by color is also conveyed by icon or text.

### 19.5 Keyboard Navigation Smoke Tests

Per-phase manual checklist (automated where possible):

| Scenario | Verification |
|----------|-------------|
| Tab bar navigation | Arrow keys move between tabs, Enter activates |
| Invoice table | j/k moves active row, Space selects, Enter opens detail |
| Detail panel sections | Tab reaches all collapsible headers, Enter/Space toggles |
| Modal focus trap | Tab cycles within modal, Escape closes |
| GL code dropdown | Arrow keys navigate options, Enter selects, Escape closes |
| Skip-to-content link | Tab from page load reaches skip link first |

### 19.6 Performance Profiling

**Scope**: React DevTools Profiler captures for invoice table with 100+ rows, vendor list with 500+ entries, reconciliation split-pane with 200+ transactions.

**Thresholds**:
- Initial render: < 100ms for table views.
- Re-render on filter change: < 50ms.
- Tab switch: < 200ms (including lazy-loaded components).
- No component re-renders more than twice per user action (verified via `React.StrictMode` + Profiler).

**Tooling**: Lighthouse CI for LCP/FID/CLS at 3 breakpoints, gating PR merge if LCP > 2.5s or CLS > 0.1.

### 19.7 Frontend Observability

**(a) Error boundary per new tab:** Each new tab (Vendors, Payments, Reconciliation) is wrapped in a dedicated `ErrorBoundary` component that catches render errors and reports them to the application logger (`POST /api/client-errors`). The error boundary renders a "Something went wrong" fallback with a "Retry" button rather than crashing the entire workspace.

**(b) Feature adoption events:** Key user actions emit custom analytics events for tracking feature adoption:
- `payment_recorded` -- method, single/multi, vendor count
- `vendor_merged` -- soft/hard, invoice count affected
- `reconciliation_matched` -- match type (1:1, split, aggregate), confidence score
- `export_validated` -- pass/fail/warning counts
- `wizard_step_completed` -- step number, skipped steps

Events are emitted via a `trackEvent(name, properties)` utility that writes to the application logger in development and to the configured analytics endpoint in production.

**(c) Lighthouse CI performance budgets:**
- First Contentful Paint (FCP): < 2s
- Time to Interactive (TTI): < 4s
- Total JS bundle size: < 500KB gzipped
- Per-route lazy chunk: < 80KB gzipped

These budgets are enforced in CI alongside the existing LCP/CLS thresholds. Budget violations block PR merge.

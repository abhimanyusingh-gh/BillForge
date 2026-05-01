# LedgerBuddy App — UI Kit

High-fidelity React+JSX recreations of the LedgerBuddy app surfaces called out as priorities in the redesign brief:

1. **Action Required queue** — default landing for the AP Clerk, with row-level compliance summary and keyboard navigation
2. **Invoice list + detail** — split view; Source PDF + Extracted Fields + Compliance + Net Payable + Workflow Timeline + Risk Signals + Tally Mapping
3. **Realm Switcher** — Cmd-K command palette for tenant + client-org switching
4. **Pre-export validation modal** — pre-flight checklist before generating Tally XML
5. **Reconciliation split-pane** — bank transactions vs candidate invoices with TDS-adjusted expected debit math
6. **Vendors list + detail** — vendor master with cumulative TDS by section and FY
7. **Triage queue** — cross-client-org ambiguity inbox

`index.html` is an interactive click-thru that demonstrates each surface — it is the primary preview. JSX components are factored into small, reusable files (`Sidebar.jsx`, `TopNav.jsx`, `ActionRequiredQueue.jsx`, `InvoiceDetail.jsx`, `RealmSwitcher.jsx`, …).

These are recreations, not production code — components cut corners on logic but match the visual system pixel-for-pixel.

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { BankAccount, BankStatementSummary } from "@/types";
import {
  fetchBankAccounts,
  fetchBankStatements,
  fetchVendorGstins,
  fetchAccountNames,
  subscribeBankParseSSE,
  updateStatementGstin,
  type AccountNameOption,
  type BankParseProgressEvent,
  type BankStatementFilterParams
} from "@/api/bank";
import { StatementProgressCard } from "@/features/tenant-admin/StatementProgressCard";
import { StatementDetail } from "@/features/tenant-admin/StatementDetail";
import { EmptyState } from "@/components/common/EmptyState";

interface BankStatementsTabProps {
  bankStatements: BankStatementSummary[];
  onUploadBankStatement: (file: File, gstin?: string, gstinLabel?: string) => void;
  onStatementsChanged?: () => void;
}

interface VendorGstinSuggestion {
  gstin: string;
  vendorName: string;
  label: string;
}

interface FilterState {
  accountName: string;
  periodFrom: string;
  periodTo: string;
  state: "" | "matched" | "active" | "parsing";
}

const STATE_FILTER_OPTIONS: Array<{ id: FilterState["state"]; label: string }> = [
  { id: "", label: "All states" },
  { id: "matched", label: "Reconciled" },
  { id: "active", label: "To match" },
  { id: "parsing", label: "Parsing" }
];

function fmtInr(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return (minor / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPeriod(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? "—";
}

function StatementStateChip({ statement, suggested }: { statement: BankStatementSummary; suggested: number }) {
  if (statement.transactionCount === 0) {
    return <span className="spill s-parsed"><span className="dot" />PARSING</span>;
  }
  if (statement.unmatchedCount === 0 && suggested === 0 && statement.matchedCount > 0) {
    return <span className="spill s-approved"><span className="dot" />RECONCILED</span>;
  }
  const toMatch = statement.unmatchedCount + suggested;
  return <span className="spill s-needs_review"><span className="dot" />{toMatch} TO MATCH</span>;
}

function StatementSourceChip({ source }: { source: BankStatementSummary["source"] }) {
  const label = source === "csv-import" ? "CSV" : "PDF";
  return <span className="spill s-pending"><span className="dot" />{label}</span>;
}

function statementUploadKind(fileName: string): string {
  if (/\.pdf$/i.test(fileName)) return "picture_as_pdf";
  if (/\.csv$/i.test(fileName)) return "table_view";
  if (/\.(jpe?g|png)$/i.test(fileName)) return "image";
  return "draft";
}

export function BankStatementsTab({
  bankStatements: initialStatements,
  onUploadBankStatement,
  onStatementsChanged
}: BankStatementsTabProps) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [statements, setStatements] = useState<BankStatementSummary[]>(initialStatements);
  const [statementsTotal, setStatementsTotal] = useState(initialStatements.length);
  const [statementsPage, setStatementsPage] = useState(1);
  const [statementsPageSize, setStatementsPageSize] = useState(20);
  const [statementsLoading, setStatementsLoading] = useState(false);

  const [accountOptions, setAccountOptions] = useState<AccountNameOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [filters, setFilters] = useState<FilterState>({ accountName: "", periodFrom: "", periodTo: "", state: "" });

  const [parseProgress, setParseProgress] = useState<BankParseProgressEvent | null>(null);

  const [openStatementId, setOpenStatementId] = useState<string | null>(null);

  const [gstinMappingStatementId, setGstinMappingStatementId] = useState<string | null>(null);
  const [gstinInput, setGstinInput] = useState("");
  const [gstinSuggestions, setGstinSuggestions] = useState<VendorGstinSuggestion[]>([]);
  const [gstinSaving, setGstinSaving] = useState(false);

  const hasActiveFilters = filters.accountName !== "" || filters.periodFrom !== "" || filters.periodTo !== "" || filters.state !== "";

  useEffect(() => {
    const unsub = subscribeBankParseSSE(
      (event) => {
        setParseProgress(event);
        if (event.type === "complete") {
          onStatementsChanged?.();
          setTimeout(() => setParseProgress(null), 3000);
        }
        if (event.type === "error") {
          setTimeout(() => setParseProgress(null), 3000);
        }
      },
      () => {}
    );
    return unsub;
  }, [onStatementsChanged]);

  useEffect(() => {
    fetchAccountNames().then(setAccountOptions).catch(() => {});
    fetchVendorGstins().then(setGstinSuggestions).catch(() => {});
    fetchBankAccounts().then(setBankAccounts).catch(() => setBankAccounts([]));
  }, [initialStatements]);

  const loadStatements = useCallback(async () => {
    setStatementsLoading(true);
    try {
      const params: BankStatementFilterParams = {
        page: statementsPage,
        limit: statementsPageSize
      };
      if (filters.accountName) params.accountName = filters.accountName;
      if (filters.periodFrom) params.periodFrom = filters.periodFrom;
      if (filters.periodTo) params.periodTo = filters.periodTo;
      const result = await fetchBankStatements(params);
      setStatements(result.items);
      setStatementsTotal(result.total);
    } catch {
      setStatements([]);
      setStatementsTotal(0);
    } finally {
      setStatementsLoading(false);
    }
  }, [statementsPage, statementsPageSize, filters.accountName, filters.periodFrom, filters.periodTo]);

  useEffect(() => {
    void loadStatements();
  }, [loadStatements]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    list.forEach((f) => onUploadBankStatement(f));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDrag(false);
    handleFiles(event.dataTransfer.files);
  }

  function clearFilters() {
    setFilters({ accountName: "", periodFrom: "", periodTo: "", state: "" });
    setStatementsPage(1);
  }

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setStatementsPage(1);
  }

  const handleSaveGstin = useCallback(async () => {
    if (!gstinMappingStatementId || !gstinInput.trim()) return;
    setGstinSaving(true);
    try {
      const match = gstinSuggestions.find((s) => s.gstin === gstinInput.trim());
      await updateStatementGstin(gstinMappingStatementId, gstinInput.trim(), match?.label);
      setGstinMappingStatementId(null);
      setGstinInput("");
      onStatementsChanged?.();
    } catch { /* surface via inline state */ }
    setGstinSaving(false);
  }, [gstinMappingStatementId, gstinInput, gstinSuggestions, onStatementsChanged]);

  const visibleStatements = useMemo(() => {
    if (filters.state === "") return statements;
    return statements.filter((s) => {
      const suggested = computeSuggestedCount(s);
      if (filters.state === "matched") {
        return s.transactionCount > 0 && s.unmatchedCount === 0 && suggested === 0 && s.matchedCount > 0;
      }
      if (filters.state === "parsing") {
        return s.transactionCount === 0;
      }
      // active
      return s.transactionCount > 0 && (s.unmatchedCount > 0 || suggested > 0);
    });
  }, [statements, filters.state]);

  const statementsTotalPages = Math.max(1, Math.ceil(statementsTotal / statementsPageSize));
  const fyCount = statementsTotal;
  const accountCount = bankAccounts.length || accountOptions.length;

  const openStatement = openStatementId ? statements.find((s) => s._id === openStatementId) ?? null : null;

  return (
    <div
      className="bank-statements-page"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="page-header">
        <h1>Bank Statements</h1>
        <span className="count">{accountCount} account{accountCount === 1 ? "" : "s"} · {fyCount} statement{fyCount === 1 ? "" : "s"}</span>
        <div className="page-tools">
          <button
            type="button"
            className="app-button app-button-primary app-button-sm"
            onClick={() => fileRef.current?.click()}
          >
            + Upload statement
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,.pdf,.jpg,.jpeg,.png,text/csv,application/pdf,image/jpeg,image/png"
            className="hidden-file-input"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      {bankAccounts.length > 0 && (
        <div className="bank-statements-account-grid">
          {bankAccounts.map((acct) => (
            <div key={acct._id} className="bank-statements-account-card">
              <span className="bank-statements-account-icon">
                <span className="material-symbols-outlined">account_balance</span>
              </span>
              <div className="bank-statements-account-body">
                <div className="bank-statements-account-name">
                  {acct.displayName ?? acct.bankName ?? acct.aaAddress}
                  {acct.maskedAccNumber ? (
                    <span className="bank-statements-account-tail"> {acct.maskedAccNumber}</span>
                  ) : null}
                </div>
                <div className="bank-statements-account-meta">
                  Feed · {acct.status === "active" ? "auto" : acct.status.replace("_", " ")}
                  {acct.balanceFetchedAt ? ` · as of ${new Date(acct.balanceFetchedAt).toLocaleString()}` : ""}
                </div>
              </div>
              <div className="bank-statements-account-balance">
                {acct.balanceMinor != null ? fmtInr(acct.balanceMinor) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={`bank-statements-dropzone${drag ? " bank-statements-dropzone-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <span className="bank-statements-dropzone-icon">
          <span className="material-symbols-outlined">upload_file</span>
        </span>
        <div className="bank-statements-dropzone-body">
          <div className="bank-statements-dropzone-title">Drop statement files here</div>
          <div className="bank-statements-dropzone-sub">PDF, CSV, JPEG, PNG — auto-detected · multiple files OK</div>
        </div>
        <button type="button" className="app-button app-button-secondary app-button-sm" onClick={(ev) => { ev.stopPropagation(); fileRef.current?.click(); }}>
          Browse files
        </button>
      </div>

      {parseProgress && <StatementProgressCard event={parseProgress} />}

      <div className="bank-statements-toolbar">
        <div className="bank-statements-toolbar-fields">
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Account</label>
            <select
              value={filters.accountName}
              onChange={(e) => updateFilter("accountName", e.target.value)}
              className="bank-statements-filter-input"
            >
              <option value="">All accounts</option>
              {accountOptions.map((a) => (
                <option key={a.label} value={a.label}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">From</label>
            <input
              type="date"
              value={filters.periodFrom}
              onChange={(e) => updateFilter("periodFrom", e.target.value)}
              className="bank-statements-filter-input"
            />
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">To</label>
            <input
              type="date"
              value={filters.periodTo}
              onChange={(e) => updateFilter("periodTo", e.target.value)}
              className="bank-statements-filter-input"
            />
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">State</label>
            <select
              value={filters.state}
              onChange={(e) => updateFilter("state", e.target.value as FilterState["state"])}
              className="bank-statements-filter-input"
            >
              {STATE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        {hasActiveFilters && (
          <button type="button" className="app-button app-button-secondary app-button-sm bank-statements-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="table-wrap bank-statements-table-wrap">
        {statementsLoading ? (
          <div className="bank-statements-loading-overlay">
            <span className="muted">Loading statements...</span>
          </div>
        ) : null}
        <table className={`lbtable${statementsLoading ? " tq-loading" : ""}`}>
          <thead>
            <tr>
              <th>Account</th>
              <th className="bank-statements-col-period">Period</th>
              <th>File</th>
              <th className="bank-statements-col-uploaded">Uploaded</th>
              <th className="num-cell bank-statements-col-lines">Lines</th>
              <th className="bank-statements-col-recon">Reconciliation</th>
              <th className="bank-statements-col-state">State</th>
              <th className="bank-statements-col-source">Source</th>
              <th className="bank-statements-col-action" />
            </tr>
          </thead>
          <tbody>
            {visibleStatements.length === 0 ? (
              <tr>
                <td colSpan={9} className="bank-statements-empty-cell">
                  {hasActiveFilters ? (
                    <EmptyState icon="filter_list_off" heading="No statements match" description="Clear filters to see all uploads."
                      action={<button type="button" className="app-button app-button-secondary" onClick={clearFilters}>Clear filters</button>} />
                  ) : (
                    <EmptyState icon="receipt_long" heading="No bank statements uploaded" description="Drop or upload a CSV / PDF / image to start reconciling against ingested invoices." />
                  )}
                </td>
              </tr>
            ) : visibleStatements.map((s) => {
              const suggested = computeSuggestedCount(s);
              const matchedRatio = s.transactionCount > 0 ? s.matchedCount / s.transactionCount : 0;
              return (
                <tr key={s._id} className="bank-statements-row" onClick={() => setOpenStatementId(s._id)}>
                  <td className="mono-cell">{[s.bankName, s.accountNumberMasked].filter(Boolean).join(" ") || "—"}</td>
                  <td>{formatPeriod(s.periodFrom, s.periodTo)}</td>
                  <td className="bank-statements-file-cell">
                    <span className="material-symbols-outlined bank-statements-file-icon">{statementUploadKind(s.fileName)}</span>
                    <span className="bank-statements-file-name">{s.fileName}</span>
                  </td>
                  <td className="mono-cell bank-statements-uploaded-cell">{formatUploadDate(s.createdAt)}</td>
                  <td className="num-cell">{s.transactionCount || "—"}</td>
                  <td>
                    {s.transactionCount === 0 ? <span className="muted">—</span> : (
                      <div className="bank-statements-recon-bar">
                        <div className="bank-statements-recon-track">
                          <div
                            className={`bank-statements-recon-fill${(s.unmatchedCount + suggested) > 0 ? " bank-statements-recon-fill-warn" : " bank-statements-recon-fill-ok"}`}
                            style={{ width: `${Math.round(matchedRatio * 100)}%` }}
                          />
                        </div>
                        <div className="bank-statements-recon-label">{s.matchedCount} matched · {s.unmatchedCount + suggested} unmatched</div>
                      </div>
                    )}
                  </td>
                  <td><StatementStateChip statement={s} suggested={suggested} /></td>
                  <td><StatementSourceChip source={s.source} /></td>
                  <td className="bank-statements-action-cell" onClick={(ev) => { ev.stopPropagation(); }}>
                    {s.gstin ? (
                      <span className="bank-statements-gstin-tag" title={s.gstinLabel ?? s.gstin}>{s.gstin}</span>
                    ) : (
                      <button
                        type="button"
                        className="row-action-button bank-statements-gstin-link"
                        title="Map GSTIN"
                        onClick={() => { setGstinMappingStatementId(s._id); setGstinInput(""); }}
                      >
                        <span className="material-symbols-outlined">link</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="bank-statements-open-link"
                      onClick={() => setOpenStatementId(s._id)}
                    >
                      open →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {statementsTotal > 0 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            {Math.min((statementsPage - 1) * statementsPageSize + 1, statementsTotal)}–{Math.min(statementsPage * statementsPageSize, statementsTotal)} of {statementsTotal}
          </div>
          <div className="pagination-controls">
            <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage <= 1} onClick={() => setStatementsPage(1)}>First</button>
            <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage <= 1} onClick={() => setStatementsPage((p) => p - 1)}>Prev</button>
            <span className="pagination-page">Page {statementsPage} of {statementsTotalPages}</span>
            <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage >= statementsTotalPages} onClick={() => setStatementsPage((p) => p + 1)}>Next</button>
            <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage >= statementsTotalPages} onClick={() => setStatementsPage(statementsTotalPages)}>Last</button>
          </div>
          <div className="pagination-size">
            <span>Rows:</span>
            <select value={statementsPageSize} onChange={(e) => { setStatementsPageSize(Number(e.target.value)); setStatementsPage(1); }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      {drag && (
        <div className="bank-statements-drag-veil">
          <div className="bank-statements-drag-veil-body">
            <span className="material-symbols-outlined bank-statements-drag-veil-icon">cloud_upload</span>
            <div className="bank-statements-drag-veil-title">Drop bank statements anywhere</div>
            <div className="bank-statements-drag-veil-sub">PDF, CSV, JPEG, PNG · matched against open invoices.</div>
          </div>
        </div>
      )}

      {openStatement && (
        <StatementDetail
          statement={openStatement}
          onClose={() => setOpenStatementId(null)}
          onChanged={() => { void loadStatements(); onStatementsChanged?.(); }}
        />
      )}

      {gstinMappingStatementId && (
        <div className="modal-overlay" onClick={() => setGstinMappingStatementId(null)}>
          <div className="modal-card recon-gstin-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>Map GSTIN to Statement</h3>
            <input
              type="text"
              placeholder="Enter GSTIN (e.g., 29AABCU9603R1ZM)"
              value={gstinInput}
              onChange={(ev) => setGstinInput(ev.target.value.toUpperCase())}
              maxLength={15}
              className="recon-invoice-picker-input"
            />
            {gstinSuggestions.length > 0 && (
              <div className="recon-gstin-suggestions">
                <span className="recon-gstin-suggestions-label">Known vendors:</span>
                <div className="recon-gstin-suggestions-list">
                  {gstinSuggestions.slice(0, 8).map((s) => (
                    <button
                      key={s.gstin}
                      type="button"
                      className="app-button app-button-secondary recon-gstin-suggestion"
                      onClick={() => setGstinInput(s.gstin)}
                    >{s.vendorName} ({s.gstin.slice(0, 4)}...)</button>
                  ))}
                </div>
              </div>
            )}
            <div className="recon-modal-actions">
              <button type="button" className="app-button app-button-secondary" onClick={() => { setGstinMappingStatementId(null); setGstinInput(""); }}>Cancel</button>
              <button type="button" className="app-button app-button-primary" disabled={gstinInput.trim().length !== 15 || gstinSaving} onClick={() => void handleSaveGstin()}>
                {gstinSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeSuggestedCount(statement: BankStatementSummary): number {
  return Math.max(0, statement.transactionCount - statement.matchedCount - statement.unmatchedCount);
}

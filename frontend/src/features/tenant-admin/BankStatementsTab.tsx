import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import type { BankStatementSummary, BankTransactionEntry, ReconciliationMatchItem, Invoice } from "@/types";
import { subscribeBankParseSSE, type BankParseProgressEvent } from "@/api/bank";
import { StatementProgressCard } from "@/features/tenant-admin/StatementProgressCard";
import {
  fetchBankStatements,
  fetchBankTransactions,
  fetchStatementMatches,
  fetchVendorGstins,
  fetchAccountNames,
  matchTransactionToInvoice,
  reconcileStatement,
  unmatchTransaction,
  updateStatementGstin
} from "@/api/bank";
import type { AccountNameOption, BankStatementFilterParams, BankTransactionFilterParams } from "@/api/bank";
import { apiClient } from "@/api/client";
import { invoiceUrls } from "@/api/urls/invoiceUrls";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ds/Badge";

const MATCH_STATUS = {
  matched: "matched",
  manual: "manual",
  suggested: "suggested",
  unmatched: "unmatched"
} as const;

type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

interface BankStatementsTabProps {
  bankStatements: BankStatementSummary[];
  onUploadBankStatement: (file: File, gstin?: string, gstinLabel?: string) => void;
  onStatementsChanged?: () => void;
}

function fmtMinor(amount: number | null, className?: string): JSX.Element | null {
  if (amount == null) return null;
  const formatted = (amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span className={className}>{formatted}</span>;
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function MatchStatusBadge({ status, confidence }: { status: BankTransactionEntry["matchStatus"]; confidence?: number | null }) {
  const confSuffix = confidence != null ? ` (${confidence}%)` : "";
  if (status === MATCH_STATUS.matched) {
    return <Badge tone="success">Matched{confSuffix}</Badge>;
  }
  if (status === MATCH_STATUS.suggested) {
    return <Badge tone="warning">Suggested{confSuffix}</Badge>;
  }
  if (status === MATCH_STATUS.manual) {
    return <Badge tone="info">Manual</Badge>;
  }
  return <Badge tone="neutral">Unmatched</Badge>;
}

function rowClassForMatchStatus(status: MatchStatus | string): string | undefined {
  if (status === MATCH_STATUS.matched || status === MATCH_STATUS.manual) return "bank-statements-row-matched";
  if (status === MATCH_STATUS.suggested) return "bank-statements-row-suggested";
  return undefined;
}

function InvoiceSearchPicker({
  onSelect,
  onCancel,
  gstin
}: {
  onSelect: (invoiceId: string) => void;
  onCancel: () => void;
  gstin: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Invoice[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params: Record<string, unknown> = { limit: 10, page: 1 };
        if (gstin) params.gstin = gstin;
        params.search = query;
        const resp = await apiClient.get<{ items: Invoice[] }>(invoiceUrls.list(), { params });
        setResults(resp.data.items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, gstin]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card recon-invoice-picker-card" onClick={(e) => e.stopPropagation()}>
        <h3>Link Invoice</h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by invoice number or vendor name..."
          autoFocus
          className="recon-invoice-picker-input"
        />
        {searching && <p className="muted">Searching...</p>}
        {results.length === 0 && !searching && query.length >= 2 && (
          <p className="muted">No invoices found.</p>
        )}
        {results.map(inv => (
          <div
            key={inv._id}
            className="recon-invoice-picker-result"
            onClick={() => onSelect(inv._id)}
          >
            <div>
              <div className="recon-invoice-picker-result-title">
                {inv.parsed?.invoiceNumber ?? "No number"} - {inv.parsed?.vendorName ?? "Unknown vendor"}
              </div>
              <div className="recon-invoice-picker-result-meta">
                {inv.parsed?.totalAmountMinor != null
                  ? (inv.parsed.totalAmountMinor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })
                  : "-"
                }
                {inv.parsed?.invoiceDate ? ` | ${inv.parsed.invoiceDate}` : ""}
                {` | ${inv.status}`}
              </div>
            </div>
            <button
              type="button"
              className="app-button app-button-primary app-button-sm"
            >
              Select
            </button>
          </div>
        ))}
        <div className="recon-invoice-picker-actions">
          <button type="button" className="app-button app-button-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

interface TransactionCache {
  items: BankTransactionEntry[];
  total: number;
  matches: Map<string, ReconciliationMatchItem>;
  summary: { totalTransactions: number; matched: number; suggested: number; unmatched: number } | null;
}

interface GlobalFilters {
  accountName: string;
  periodFrom: string;
  periodTo: string;
  search: string;
  matchStatus: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function StatementTransactionsGroup({
  statementId,
  statementGstin,
  cache,
  onCacheUpdate,
  globalFilters
}: {
  statementId: string;
  statementGstin: string | null;
  cache: TransactionCache | undefined;
  onCacheUpdate: (statementId: string, data: TransactionCache) => void;
  globalFilters: GlobalFilters;
}) {
  const [transactions, setTransactions] = useState<BankTransactionEntry[]>(cache?.items ?? []);
  const [matchDetails, setMatchDetails] = useState<Map<string, ReconciliationMatchItem>>(cache?.matches ?? new Map());
  const [total, setTotal] = useState(cache?.total ?? 0);
  const [summary, setSummary] = useState(cache?.summary ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(!cache);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingTxnId, setLinkingTxnId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(globalFilters.search, 300);

  const buildTxnParams = useCallback((): BankTransactionFilterParams => {
    const params: BankTransactionFilterParams = { page, limit: pageSize };
    if (globalFilters.matchStatus) params.matchStatus = globalFilters.matchStatus;
    if (globalFilters.periodFrom) params.dateFrom = globalFilters.periodFrom;
    if (globalFilters.periodTo) params.dateTo = globalFilters.periodTo;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [page, pageSize, globalFilters.matchStatus, globalFilters.periodFrom, globalFilters.periodTo, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildTxnParams();
      const result = await fetchBankTransactions(statementId, params);
      setTransactions(result.items);
      setTotal(result.total);
      return result;
    } catch {
      setError("Failed to load transactions.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [statementId, buildTxnParams]);

  const loadMatches = useCallback(async () => {
    try {
      const result = await fetchStatementMatches(statementId);
      const map = new Map<string, ReconciliationMatchItem>();
      for (const item of result.items) {
        map.set(String(item._id), item);
      }
      setMatchDetails(map);
      setSummary(result.summary);
      return { map, summary: result.summary };
    } catch {
      return null;
    }
  }, [statementId]);

  useEffect(() => {
    let cancelled = false;
    const params = buildTxnParams();
    Promise.all([
      fetchBankTransactions(statementId, params),
      fetchStatementMatches(statementId)
    ]).then(([txnResult, matchResult]) => {
      if (cancelled) return;
      setTransactions(txnResult.items);
      setTotal(txnResult.total);
      const map = new Map<string, ReconciliationMatchItem>();
      for (const item of matchResult.items) {
        map.set(String(item._id), item);
      }
      setMatchDetails(map);
      setSummary(matchResult.summary);
      setLoading(false);
      onCacheUpdate(statementId, {
        items: txnResult.items,
        total: txnResult.total,
        matches: map,
        summary: matchResult.summary
      });
    }).catch(() => {
      if (!cancelled) {
        setError("Failed to load transactions.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [statementId, buildTxnParams, onCacheUpdate]);

  async function refreshAfterAction() {
    const [txnResult, matchResult] = await Promise.all([load(), loadMatches()]);
    if (txnResult && matchResult) {
      onCacheUpdate(statementId, {
        items: txnResult.items,
        total: txnResult.total,
        matches: matchResult.map,
        summary: matchResult.summary
      });
    }
  }

  async function handleReconcile() {
    setReconciling(true);
    setError(null);
    try {
      await reconcileStatement(statementId);
      await refreshAfterAction();
    } catch {
      setError("Reconciliation failed.");
    } finally {
      setReconciling(false);
    }
  }

  async function handleConfirm(txn: BankTransactionEntry) {
    if (!txn.matchedInvoiceId) return;
    try {
      await matchTransactionToInvoice(txn._id, txn.matchedInvoiceId);
      await refreshAfterAction();
    } catch {
      setError("Failed to confirm match.");
    }
  }

  async function handleUnmatch(txnId: string) {
    try {
      await unmatchTransaction(txnId);
      await refreshAfterAction();
    } catch {
      setError("Failed to unmatch transaction.");
    }
  }

  async function handleManualLink(invoiceId: string) {
    if (!linkingTxnId) return;
    try {
      await matchTransactionToInvoice(linkingTxnId, invoiceId);
      setLinkingTxnId(null);
      await refreshAfterAction();
    } catch {
      setError("Failed to link invoice.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showTo = Math.min(page * pageSize, total);

  if (loading) {
    return <tr><td colSpan={10} className="bank-statements-loading"><span className="muted">Loading transactions...</span></td></tr>;
  }

  if (error) {
    return <tr><td colSpan={10} className="bank-statements-error">{error}</td></tr>;
  }

  if (transactions.length === 0) {
    return <tr><td colSpan={10} className="bank-statements-empty"><span className="muted">No transactions found.</span></td></tr>;
  }

  return (
    <>
      <tr className="bank-statements-summary-row">
        <td colSpan={10}>
          <div className="panel-title bank-statements-summary-bar">
            <div className="bank-statements-status-bar">
              {summary ? (
                <>
                  <span className="status status-approved">{summary.matched} Matched</span>
                  <span className="status status-needs_review">{summary.suggested} Suggested</span>
                  <span className="status status-pending">{summary.unmatched} Unmatched</span>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="app-button app-button-secondary app-button-sm"
              onClick={() => void handleReconcile()}
              disabled={reconciling}
            >
              {reconciling ? "Reconciling..." : "Reconcile"}
            </button>
          </div>
        </td>
      </tr>
      <tr className="bank-statements-txn-header">
        <th>Date</th>
        <th colSpan={2}>Description</th>
        <th>Reference</th>
        <th className="num-cell">Debit</th>
        <th className="num-cell">Credit</th>
        <th className="num-cell">Balance</th>
        <th>Matched Invoice</th>
        <th></th>
      </tr>
      {transactions.map((txn) => {
        const detail = matchDetails.get(String(txn._id));
        return (
          <tr key={txn._id} className={rowClassForMatchStatus(txn.matchStatus)}>
            <td className="mono-cell">{txn.date}</td>
            <td colSpan={2}><div className="table-cell-scroll">{txn.description}</div></td>
            <td><div className="table-cell-scroll">{txn.reference ?? "-"}</div></td>
            <td className="num-cell">{fmtMinor(txn.debitMinor, "bank-statements-amount-debit")}</td>
            <td className="num-cell">{fmtMinor(txn.creditMinor, "bank-statements-amount-credit")}</td>
            <td className="num-cell">{fmtMinor(txn.balanceMinor)}</td>
            <td>
              <div className="bank-statements-status-list">
                <MatchStatusBadge status={txn.matchStatus} confidence={txn.matchConfidence} />
                {detail?.invoice ? (
                  <a
                    href={`?invoiceDetail=${detail.invoice._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-label"
                    title={`${detail.invoice.invoiceNumber ?? "-"} - ${detail.invoice.vendorName ?? ""}`}
                  >
                    {detail.invoice.invoiceNumber ?? "-"} - {detail.invoice.vendorName ?? ""}
                  </a>
                ) : txn.matchedInvoiceId ? (
                  <a
                    href={`?invoiceDetail=${txn.matchedInvoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="file-label"
                  >
                    {txn.matchedInvoiceId.slice(0, 8)}...
                  </a>
                ) : null}
              </div>
            </td>
            <td>
              {txn.matchStatus === MATCH_STATUS.suggested ? (
                <div className="bank-statements-actions">
                  <button type="button" className="row-action-button row-action-approve" title="Confirm" onClick={() => void handleConfirm(txn)}>
                    <span className="material-symbols-outlined">check_circle</span>
                  </button>
                  <button type="button" className="row-action-button" title="Reject" onClick={() => void handleUnmatch(txn._id)}>
                    <span className="material-symbols-outlined">cancel</span>
                  </button>
                </div>
              ) : txn.matchStatus === MATCH_STATUS.matched || txn.matchStatus === MATCH_STATUS.manual ? (
                <button type="button" className="row-action-button" title="Unmatch" onClick={() => void handleUnmatch(txn._id)}>
                  <span className="material-symbols-outlined">link_off</span>
                </button>
              ) : txn.debitMinor && txn.debitMinor > 0 ? (
                <button type="button" className="row-action-button row-action-retry" title="Link Invoice" onClick={() => setLinkingTxnId(txn._id)}>
                  <span className="material-symbols-outlined">add_link</span>
                </button>
              ) : null}
            </td>
          </tr>
        );
      })}
      <tr className="bank-statements-pagination-row">
        <td colSpan={10}>
          <div className="pagination-bar">
            <div className="pagination-info">
              {showFrom}&ndash;{showTo} of {total}
            </div>
            <div className="pagination-controls">
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span className="pagination-page">Page {page} of {totalPages}</span>
              <button type="button" className="app-button app-button-secondary app-button-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
            <div className="pagination-size">
              <span>Rows:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </td>
      </tr>
      {linkingTxnId && (
        <tr className="bank-statements-summary-row"><td colSpan={10}>
          <InvoiceSearchPicker
            gstin={statementGstin}
            onSelect={(invoiceId) => void handleManualLink(invoiceId)}
            onCancel={() => setLinkingTxnId(null)}
          />
        </td></tr>
      )}
    </>
  );
}

export function BankStatementsTab({
  bankStatements: initialStatements,
  onUploadBankStatement,
  onStatementsChanged
}: BankStatementsTabProps) {
  const [dragActive, setDragActive] = useState(false);
  const [expandedStatements, setExpandedStatements] = useState<Set<string>>(new Set());
  const [txnCache, setTxnCache] = useState<Map<string, TransactionCache>>(new Map());
  const [gstinMappingStatementId, setGstinMappingStatementId] = useState<string | null>(null);
  const [gstinInput, setGstinInput] = useState("");
  const [gstinSuggestions, setGstinSuggestions] = useState<Array<{ gstin: string; vendorName: string; label: string }>>([]);
  const [gstinSaving, setGstinSaving] = useState(false);
  const [parseProgress, setParseProgress] = useState<BankParseProgressEvent | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [accountNames, setAccountNames] = useState<AccountNameOption[]>([]);
  const [filters, setFilters] = useState<GlobalFilters>({
    accountName: "",
    periodFrom: "",
    periodTo: "",
    search: "",
    matchStatus: ""
  });
  const [statements, setStatements] = useState<BankStatementSummary[]>(initialStatements);
  const [statementsTotal, setStatementsTotal] = useState(initialStatements.length);
  const [statementsPage, setStatementsPage] = useState(1);
  const [statementsPageSize, setStatementsPageSize] = useState(20);
  const [statementsLoading, setStatementsLoading] = useState(false);

  const debouncedSearch = useDebounce(filters.search, 300);

  const hasActiveFilters = filters.accountName !== "" || filters.periodFrom !== "" || filters.periodTo !== "" || filters.search !== "" || filters.matchStatus !== "";

  useEffect(() => {
    fetchAccountNames().then(setAccountNames).catch(() => {});
  }, [initialStatements]);

  useEffect(() => {
    fetchVendorGstins().then(setGstinSuggestions).catch(() => {});
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

  useEffect(() => {
    if (debouncedSearch && statements.length > 0) {
      setExpandedStatements(new Set(statements.map(s => s._id)));
    }
  }, [debouncedSearch, statements]);

  const handleCacheUpdate = useCallback((statementId: string, data: TransactionCache) => {
    setTxnCache((prev) => {
      const next = new Map(prev);
      next.set(statementId, data);
      return next;
    });
  }, []);

  const handleSaveGstin = useCallback(async () => {
    if (!gstinMappingStatementId || !gstinInput.trim()) return;
    setGstinSaving(true);
    try {
      const match = gstinSuggestions.find(s => s.gstin === gstinInput.trim());
      await updateStatementGstin(gstinMappingStatementId, gstinInput.trim(), match?.label);
      setGstinMappingStatementId(null);
      setGstinInput("");
      onStatementsChanged?.();
    } catch { /* handled by caller */ }
    setGstinSaving(false);
  }, [gstinMappingStatementId, gstinInput, gstinSuggestions, onStatementsChanged]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const [file] = Array.from(files);
    if (file) onUploadBankStatement(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function toggleStatement(id: string) {
    setExpandedStatements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function computeSuggestedCount(statement: BankStatementSummary): number {
    return Math.max(0, statement.transactionCount - statement.matchedCount - statement.unmatchedCount);
  }

  function clearFilters() {
    setFilters({ accountName: "", periodFrom: "", periodTo: "", search: "", matchStatus: "" });
    setStatementsPage(1);
    setExpandedStatements(new Set());
    setTxnCache(new Map());
  }

  function updateFilter<K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setStatementsPage(1);
    setTxnCache(new Map());
  }

  const statementsTotalPages = Math.max(1, Math.ceil(statementsTotal / statementsPageSize));

  return (
    <div className="bank-statements-tab">
      <div
        className={dragActive ? "file-dropzone file-dropzone-active" : "file-dropzone"}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <span className="material-symbols-outlined" aria-hidden="true">upload_file</span>
        <div>
          <strong>Drop bank statements here</strong>
          <p>CSV, PDF, JPEG, and PNG supported. Click to browse.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf,.jpg,.jpeg,.png,text/csv,application/pdf,image/jpeg,image/png"
          className="hidden-file-input"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {parseProgress && <StatementProgressCard event={parseProgress} />}

      <div className="editor-card bank-statements-filter-card">
        <div className="editor-header">
          <h3>Filters</h3>
          {hasActiveFilters && (
            <button
              type="button"
              className="app-button app-button-secondary bank-statements-clear"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
        <div className="bank-statements-filters">
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Account</label>
            <select
              value={filters.accountName}
              onChange={(e) => updateFilter("accountName", e.target.value)}
              className="bank-statements-filter-input bank-statements-filter-input-account"
            >
              <option value="">All Accounts</option>
              {accountNames.map(a => (
                <option key={a.label} value={a.label}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Date From</label>
            <input
              type="date"
              value={filters.periodFrom}
              onChange={(e) => updateFilter("periodFrom", e.target.value)}
              className="bank-statements-filter-input"
            />
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Date To</label>
            <input
              type="date"
              value={filters.periodTo}
              onChange={(e) => updateFilter("periodTo", e.target.value)}
              className="bank-statements-filter-input"
            />
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Search Transactions</label>
            <input
              type="text"
              placeholder="Description or reference..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="bank-statements-filter-input bank-statements-filter-input-search"
            />
          </div>
          <div className="bank-statements-filter-field">
            <label className="bank-statements-filter-label">Match Status</label>
            <select
              value={filters.matchStatus}
              onChange={(e) => updateFilter("matchStatus", e.target.value)}
              className="bank-statements-filter-input"
            >
              <option value="">All</option>
              <option value="matched">Matched</option>
              <option value="suggested">Suggested</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>
        </div>
      </div>

      {statementsLoading ? (
        <section className="panel list-panel">
          <div className="panel-title">
            <h2>Statements</h2>
            <span className="muted">Loading...</span>
          </div>
          <div className="bank-statements-loading">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
          </div>
        </section>
      ) : statements.length === 0 && !hasActiveFilters ? (
        <section className="panel list-panel">
          <div className="panel-title">
            <h2>Statements</h2>
            <span>0 records</span>
          </div>
          <EmptyState icon="receipt_long" heading="No bank statements uploaded" description="Upload bank statements to reconcile them against ingested invoices." />
        </section>
      ) : statements.length === 0 && hasActiveFilters ? (
        <section className="panel list-panel">
          <div className="panel-title">
            <h2>Statements</h2>
            <span>0 records</span>
          </div>
          <EmptyState icon="filter_list_off" heading="No results" description="No statements match the current filters. Try adjusting your search criteria."
            action={<button type="button" className="app-button app-button-secondary" onClick={clearFilters}>Clear Filters</button>}
          />
        </section>
      ) : (
        <section className="panel list-panel">
          <div className="panel-title">
            <h2>Statements</h2>
            <span>{statementsTotal} record{statementsTotal !== 1 ? "s" : ""}</span>
          </div>
          <div className={`list-scroll${statementsLoading ? " list-scroll-loading" : ""}`}>
            <table>
              <thead>
                <tr>
                  <th className="bank-statements-toggle-col"></th>
                  <th>Bank / Account</th>
                  <th>Uploaded</th>
                  <th>Period</th>
                  <th>Transactions</th>
                  <th>Status</th>
                  <th>GSTIN</th>
                  <th>File</th>
                  <th>Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement) => {
                  const expanded = expandedStatements.has(statement._id);
                  const suggested = computeSuggestedCount(statement);
                  return (
                    <StatementGroupRows
                      key={statement._id}
                      statement={statement}
                      expanded={expanded}
                      suggestedCount={suggested}
                      txnCache={txnCache.get(statement._id)}
                      onToggle={() => toggleStatement(statement._id)}
                      onCacheUpdate={handleCacheUpdate}
                      onMapGstin={() => setGstinMappingStatementId(statement._id)}
                      globalFilters={filters}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {statementsTotal > 0 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                {Math.min((statementsPage - 1) * statementsPageSize + 1, statementsTotal)}&ndash;{Math.min(statementsPage * statementsPageSize, statementsTotal)} of {statementsTotal}
              </div>
              <div className="pagination-controls">
                <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage <= 1} onClick={() => setStatementsPage(1)}>First</button>
                <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage <= 1} onClick={() => setStatementsPage((p) => p - 1)}>Prev</button>
                <span className="pagination-page">Page {statementsPage} of {statementsTotalPages}</span>
                <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage >= statementsTotalPages} onClick={() => setStatementsPage((p) => p + 1)}>Next</button>
                <button type="button" className="app-button app-button-secondary app-button-sm" disabled={statementsPage >= statementsTotalPages} onClick={() => setStatementsPage(Math.ceil(statementsTotal / statementsPageSize))}>Last</button>
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
        </section>
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

function StatementGroupRows({
  statement,
  expanded,
  suggestedCount,
  txnCache,
  onToggle,
  onCacheUpdate,
  onMapGstin,
  globalFilters
}: {
  statement: BankStatementSummary;
  expanded: boolean;
  suggestedCount: number;
  txnCache: TransactionCache | undefined;
  onToggle: () => void;
  onCacheUpdate: (statementId: string, data: TransactionCache) => void;
  onMapGstin: () => void;
  globalFilters: GlobalFilters;
}) {
  const period = statement.periodFrom && statement.periodTo
    ? `${statement.periodFrom} - ${statement.periodTo}`
    : "-";

  const bankLabel = [statement.bankName, statement.accountNumberMasked]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <tr
        className={expanded ? "row-active" : undefined}
        onClick={onToggle}
      >
        <td>
          <span className="material-symbols-outlined bank-statements-toggle-icon">
            {expanded ? "expand_more" : "chevron_right"}
          </span>
        </td>
        <td className="extracted-value-cell">
          <span className="extracted-value-display bank-statements-row-name">
            {bankLabel || "-"}
          </span>
        </td>
        <td>{formatUploadDate(statement.createdAt)}</td>
        <td>{period}</td>
        <td>{statement.transactionCount}</td>
        <td>
          <div className="bank-statements-status-list">
            <span className="status status-approved">{statement.matchedCount} Matched</span>
            {suggestedCount > 0 ? <span className="status status-needs_review">{suggestedCount} Suggested</span> : null}
            <span className="status status-pending">{statement.unmatchedCount} Unmatched</span>
          </div>
        </td>
        <td>
          {statement.gstin ? (
            <span className="extracted-value-display" title={statement.gstinLabel ?? statement.gstin}>{statement.gstin}</span>
          ) : (
            <button
              type="button"
              className="row-action-button bank-statements-gstin-link"
              title="Map GSTIN"
              onClick={(ev) => { ev.stopPropagation(); onMapGstin(); }}
            >
              <span className="material-symbols-outlined">link</span>
            </button>
          )}
        </td>
        <td className="file-name-cell">
          <button type="button" className="file-label" onClick={(ev) => { ev.stopPropagation(); onToggle(); }}>{statement.fileName}</button>
        </td>
        <td>
          <span className="status status-parsed">{statement.source}</span>
        </td>
        <td onClick={(ev) => ev.stopPropagation()}>
          <button type="button" className="row-action-button" title={expanded ? "Collapse" : "Expand"} onClick={onToggle}>
            <span className="material-symbols-outlined">{expanded ? "unfold_less" : "unfold_more"}</span>
          </button>
        </td>
      </tr>
      {expanded ? (
        <StatementTransactionsGroup
          statementId={statement._id}
          statementGstin={statement.gstin}
          cache={txnCache}
          onCacheUpdate={onCacheUpdate}
          globalFilters={globalFilters}
        />
      ) : null}
    </>
  );
}

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { fetchAnalyticsOverview } from "../api";
import type { AnalyticsOverview } from "../types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function firstOfQuarterStr(): string {
  const now = new Date();
  const quarterStart = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), quarterStart, 1).toISOString().slice(0, 10);
}

function nDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1);
  return {
    from: firstOfLastMonth.toISOString().slice(0, 10),
    to: lastOfLastMonth.toISOString().slice(0, 10)
  };
}

function fmtInr(minor: number): string {
  return (minor / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function fmtInrShort(minor: number): string {
  const major = minor / 100;
  if (major >= 10_000_000) return `₹${(major / 10_000_000).toFixed(1)}Cr`;
  if (major >= 100_000) return `₹${(major / 100_000).toFixed(1)}L`;
  if (major >= 1_000) return `₹${(major / 1_000).toFixed(1)}K`;
  return `₹${major.toFixed(0)}`;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  EXPORTED: "#1152d4",
  PARSED: "#f59e0b",
  NEEDS_REVIEW: "#e11d48",
  PENDING: "#94a3b8",
  FAILED_OCR: "#ef4444",
  FAILED_PARSE: "#f97316"
};

const VENDOR_COLORS = ["#1152d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c026d3", "#db2777", "#e11d48", "#f59e0b", "#22c55e"];

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}

function KpiCard({ label, value, sub, accent, warn }: KpiCardProps) {
  return (
    <div className="platform-stat-tile" style={accent ? { borderTop: "3px solid var(--accent)" } : warn ? { borderTop: "3px solid var(--warn)" } : {}}>
      <span className="platform-stat-value">{value}</span>
      <span className="platform-stat-label">{label}</span>
      {sub ? <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>{sub}</span> : null}
    </div>
  );
}

export function OverviewDashboard() {
  const [from, setFrom] = useState(firstOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnalyticsOverview(from, to, scope)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [from, to, scope]);

  function applyPreset(f: string, t: string) {
    setFrom(f);
    setTo(t);
  }

  const kpis = data?.kpis;

  return (
    <div className="overview-dashboard">
      {/* Date bar */}
      <div className="overview-date-bar">
        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-soft)" }}>Date range:</span>
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: "var(--ink-soft)" }}>–</span>
        <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
        <button className="overview-preset-btn" onClick={() => applyPreset(firstOfMonthStr(), todayStr())}>This Month</button>
        <button className="overview-preset-btn" onClick={() => { const r = lastMonthRange(); applyPreset(r.from, r.to); }}>Last Month</button>
        <button className="overview-preset-btn" onClick={() => applyPreset(nDaysAgoStr(7), todayStr())}>Last 7 Days</button>
        <button className="overview-preset-btn" onClick={() => applyPreset(nDaysAgoStr(30), todayStr())}>Last 30 Days</button>
        <button className="overview-preset-btn" onClick={() => applyPreset(firstOfQuarterStr(), todayStr())}>This Quarter</button>
        {loading ? <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Refreshing…</span> : null}
        <div style={{ marginLeft: "auto", display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}>
          <button
            style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem", fontWeight: scope === "mine" ? 700 : 400, background: scope === "mine" ? "var(--accent)" : "var(--bg)", color: scope === "mine" ? "#fff" : "var(--ink)", border: "none", cursor: "pointer" }}
            onClick={() => setScope("mine")}
          >My Approvals</button>
          <button
            style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem", fontWeight: scope === "all" ? 700 : 400, background: scope === "all" ? "var(--accent)" : "var(--bg)", color: scope === "all" ? "#fff" : "var(--ink)", border: "none", cursor: "pointer" }}
            onClick={() => setScope("all")}
          >All Users</button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {/* KPI Cards */}
      <div className="platform-stats-grid">
        <KpiCard label="Total Invoices" value={kpis?.totalInvoices ?? "—"} />
        <KpiCard label="Approved Amount" value={kpis != null ? fmtInr(kpis.approvedAmountMinor) : "—"} sub={kpis != null ? `${kpis.approvedCount} invoices` : undefined} accent />
        <KpiCard label="Pending Amount" value={kpis != null ? fmtInr(kpis.pendingAmountMinor) : "—"} warn />
        <KpiCard label="Exported" value={kpis?.exportedCount ?? "—"} />
        <KpiCard label="Needs Review" value={kpis?.needsReviewCount ?? "—"} warn={!!kpis && kpis.needsReviewCount > 0} />
      </div>

      {/* Charts 2×2 */}
      {data ? (
        <>
          <div className="overview-charts-grid">
            {/* Daily Approval Count */}
            <div className="overview-chart-card">
              <h4>Daily Approvals (count)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.dailyApprovals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                  <Tooltip formatter={(v: number) => [v, "Approved"]} />
                  <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Approved Amount */}
            <div className="overview-chart-card">
              <h4>Daily Approved Amount (INR)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.dailyApprovals} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtInrShort(v)} width={52} />
                  <Tooltip formatter={(v: number) => [fmtInr(v), "Amount"]} />
                  <Bar dataKey="amountMinor" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Ingestion */}
            <div className="overview-chart-card">
              <h4>Daily Invoice Ingestion Volume</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.dailyIngestion} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ingestionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                  <Tooltip formatter={(v: number) => [v, "Invoices"]} />
                  <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="url(#ingestionGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Status Donut */}
            <div className="overview-chart-card">
              <h4>Status Breakdown</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  <Legend iconType="circle" iconSize={10} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vendor Charts */}
          <div className="overview-vendors-grid">
            <div className="overview-chart-card">
              <h4>Top 10 Vendors by Approved Amount</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.topVendorsByApproved}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtInrShort(v)} />
                  <YAxis type="category" dataKey="vendor" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [fmtInr(v), "Approved"]} />
                  <Bar dataKey="amountMinor" radius={[0, 3, 3, 0]}>
                    {data.topVendorsByApproved.map((_, i) => (
                      <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overview-chart-card">
              <h4>Top 10 Vendors by Pending Amount</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.topVendorsByPending}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtInrShort(v)} />
                  <YAxis type="category" dataKey="vendor" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [fmtInr(v), "Pending"]} />
                  <Bar dataKey="amountMinor" radius={[0, 3, 3, 0]}>
                    {data.topVendorsByPending.map((_, i) => (
                      <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : !loading ? (
        <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>No data available for selected range.</p>
      ) : null}
    </div>
  );
}

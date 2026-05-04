interface ProofRow {
  icon: string;
  tone: "default" | "accent" | "warn";
  title: string;
  subtitle: string;
  timestamp: string;
}

const PROOF_ROWS: ReadonlyArray<ProofRow> = [
  {
    icon: "bolt",
    tone: "default",
    title: "128 invoices ingested",
    subtitle: "across 8 client orgs · ₹4.21 Cr value",
    timestamp: "10:21"
  },
  {
    icon: "cloud_upload",
    tone: "accent",
    title: "12 vouchers exported to Tally",
    subtitle: "Batch B-2604-014 · Sundaram Textiles",
    timestamp: "17:32"
  },
  {
    icon: "receipt_long",
    tone: "warn",
    title: "2 GSTIN mismatches caught",
    subtitle: "Held before payment · saved ₹38,400 ITC",
    timestamp: "14:08"
  }
];

function proofIconClass(tone: ProofRow["tone"]): string {
  if (tone === "accent") return "proof-icon accent";
  if (tone === "warn") return "proof-icon warn";
  return "proof-icon";
}

export function LoginBrandPanel() {
  return (
    <aside className="auth-left" aria-hidden="true">
      <div className="brand-panel-top">
        <div className="brand-row">
          <span className="mark">₹</span>
          <span className="name">LedgerBuddy</span>
        </div>
        <span className="ver">v 4.12 · Apr 2026</span>
      </div>
      <div className="brand-panel-body">
        <div className="brand-pill">
          <span className="brand-pill-dot" />
          Built for Indian CA practices
        </div>
        <h1 className="brand-tagline">
          From inbox to <em>Tally voucher</em> in <em>under a minute</em>.
        </h1>
        <p className="brand-sub">
          AP automation for chartered accountants. Ingests bills, reconciles GST &amp; TDS, and posts straight to Tally — across every client org you manage.
        </p>
        <div className="proof-card">
          <div className="proof-card-head">
            <span className="proof-card-eyebrow">Today across the firm</span>
            <span className="proof-card-stamp">14-Apr-2026 · IST</span>
          </div>
          {PROOF_ROWS.map((row) => (
            <div key={row.icon} className="proof-row">
              <div className={proofIconClass(row.tone)}>
                <span className="material-symbols-outlined">{row.icon}</span>
              </div>
              <div className="text">
                <div className="t">{row.title}</div>
                <div className="s">{row.subtitle}</div>
              </div>
              <span className="ts">{row.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="brand-foot">
        <span className="quote">"It replaced 11 hours of data entry a week. Mahir Khan, CA."</span>
        <span className="brand-foot-status">
          <span className="brand-foot-status-dot" />
          All systems operational
        </span>
      </div>
    </aside>
  );
}

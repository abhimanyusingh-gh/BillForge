// UserSettings.jsx — full-page user settings, opened from the top-nav account menu
function UserSettings({ initialTab = "profile", onClose }) {
  const [tab, setTab] = React.useState(initialTab);
  const [photo, setPhoto] = React.useState(null);
  const fileRef = React.useRef(null);

  const tabs = [
    { id: "profile",       label: "Profile",          icon: "person" },
    { id: "password",      label: "Password",         icon: "lock" },
    { id: "twofa",         label: "Two-factor auth",  icon: "shield" },
    { id: "notifications", label: "Notifications",    icon: "notifications" },
    { id: "audit",         label: "Audit log",        icon: "schedule" },
    { id: "preferences",   label: "Preferences",      icon: "tune" },
  ];

  return (
    <div style={{ maxWidth: 1040 }}>
      <div className="page-header">
        <h1>User settings</h1>
        <span className="count">Reena Patel · reena@khan-ca.in</span>
        <div className="page-tools">
          <button onClick={onClose} style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Back
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
        {/* Tab rail */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 14 }}>
          {tabs.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: 0, background: on ? "var(--accent-soft-bg)" : "transparent", color: on ? "var(--accent)" : "var(--ink)", font: "600 13px var(--font-sans)", cursor: "pointer", textAlign: "left" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <div style={{ background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 20, minHeight: 440 }}>
          {tab === "profile"       ? <ProfileTab photo={photo} setPhoto={setPhoto} fileRef={fileRef} /> : null}
          {tab === "password"      ? <PasswordTab /> : null}
          {tab === "twofa"         ? <TwoFactorTab /> : null}
          {tab === "notifications" ? <NotificationsTab /> : null}
          {tab === "audit"         ? <AuditTab /> : null}
          {tab === "preferences"   ? <PreferencesTab /> : null}
        </div>
      </div>
    </div>
  );
}

// ---------- shared bits ----------
const usFieldLabel = { font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" };
const usInput = { height: 32, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 13px var(--font-sans)", outline: "none", width: "100%", boxSizing: "border-box" };

function UsField({ label, hint, children, mono }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={usFieldLabel}>{label}</span>
      {children}
      {hint ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{hint}</span> : null}
    </label>
  );
}

function UsRow({ title, sub, control, danger }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 13px var(--font-sans)", color: danger ? "var(--warn)" : "var(--ink)" }}>{title}</div>
        {sub ? <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{sub}</div> : null}
      </div>
      {control}
    </div>
  );
}

function UsToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
            style={{ width: 36, height: 20, borderRadius: 999, border: 0, background: on ? "var(--accent)" : "var(--bg-sunken)", position: "relative", cursor: "pointer", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: "white", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .15s" }} />
    </button>
  );
}

function UsSectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ font: "700 16px var(--font-sans)", color: "var(--ink)" }}>{children}</div>
      {sub ? <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

// ---------- Profile ----------
function ProfileTab({ photo, setPhoto, fileRef }) {
  const [name, setName] = React.useState("Reena Patel");
  const [phone, setPhone] = React.useState("+91 98765 43210");
  const [tz, setTz] = React.useState("Asia/Kolkata (IST)");
  const [lang, setLang] = React.useState("English (India)");
  const [signature, setSignature] = React.useState("Reena Patel\nSenior Accountant\nKhan & Associates, CA");

  const onPick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setPhoto(r.result); r.readAsDataURL(f);
  };

  return (
    <div>
      <UsSectionTitle sub="Visible to teammates and on approval emails.">Profile</UsSectionTitle>

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0 16px", borderBottom: "1px solid var(--line-soft)", marginBottom: 16 }}>
        <button onClick={() => fileRef.current?.click()}
                style={{ position: "relative", width: 64, height: 64, borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)", background: photo ? "transparent" : "var(--accent-soft-bg)", color: "var(--accent)", font: "700 22px var(--font-sans)", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "RP"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
        <div style={{ flex: 1 }}>
          <div style={{ font: "700 14px var(--font-sans)", color: "var(--ink)" }}>Profile photo</div>
          <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>PNG or JPG · max 2 MB · square crops best</div>
          <div style={{ display: "inline-flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={{ height: 28, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Upload new</button>
            {photo ? <button onClick={() => setPhoto(null)} style={{ height: 28, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--ink-soft)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Remove</button> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <UsField label="Full name"><input style={usInput} value={name} onChange={e => setName(e.target.value)} /></UsField>
        <UsField label="Work email" hint="Managed by your firm — contact owner to change.">
          <input style={{ ...usInput, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-sunken)" }} value="reena@khan-ca.in" disabled />
        </UsField>
        <UsField label="Phone"><input style={{ ...usInput, fontFamily: "var(--font-mono)", fontSize: 12 }} value={phone} onChange={e => setPhone(e.target.value)} /></UsField>
        <UsField label="Role" hint="Only firm owners can change roles.">
          <input style={{ ...usInput, color: "var(--ink-soft)", background: "var(--bg-sunken)" }} value="Senior Accountant" disabled />
        </UsField>
        <UsField label="Time zone">
          <select style={{ ...usInput, padding: "0 8px" }} value={tz} onChange={e => setTz(e.target.value)}>
            <option>Asia/Kolkata (IST)</option><option>Asia/Dubai</option><option>Asia/Singapore</option><option>Europe/London</option><option>America/New_York</option>
          </select>
        </UsField>
        <UsField label="Language">
          <select style={{ ...usInput, padding: "0 8px" }} value={lang} onChange={e => setLang(e.target.value)}>
            <option>English (India)</option><option>English (UK)</option><option>हिन्दी</option><option>தமிழ்</option><option>ગુજરાતી</option>
          </select>
        </UsField>
      </div>

      <div style={{ marginTop: 14 }}>
        <UsField label="Email signature" hint="Appended to approval requests and vendor replies you send from LedgerBuddy.">
          <textarea style={{ ...usInput, height: 88, padding: "8px 10px", resize: "vertical", fontFamily: "var(--font-sans)" }} value={signature} onChange={e => setSignature(e.target.value)} />
        </UsField>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Cancel</button>
        <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Save changes</button>
      </div>
    </div>
  );
}

// ---------- Password ----------
function PasswordTab() {
  const [cur, setCur] = React.useState("");
  const [n1, setN1] = React.useState("");
  const [n2, setN2] = React.useState("");
  const strength = (() => {
    let s = 0;
    if (n1.length >= 10) s++;
    if (/[A-Z]/.test(n1)) s++;
    if (/[a-z]/.test(n1)) s++;
    if (/\d/.test(n1)) s++;
    if (/[^A-Za-z0-9]/.test(n1)) s++;
    return s;
  })();
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"][strength];
  const strengthColor = strength <= 1 ? "var(--warn)" : strength <= 3 ? "#b8770b" : "var(--emerald)";
  const matches = n1 && n1 === n2;
  const ready = cur.length > 0 && n1.length >= 10 && matches && strength >= 3;

  return (
    <div>
      <UsSectionTitle sub="Last changed 47 days ago. You'll be signed out of other devices on save.">Password</UsSectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <UsField label="Current password"><input type="password" style={{ ...usInput, fontFamily: "var(--font-mono)" }} value={cur} onChange={e => setCur(e.target.value)} /></UsField>
          <UsField label="New password">
            <input type="password" style={{ ...usInput, fontFamily: "var(--font-mono)" }} value={n1} onChange={e => setN1(e.target.value)} placeholder="At least 10 characters" />
            {n1 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3 }}>
                  {[0,1,2,3,4].map(i => <span key={i} style={{ height: 4, borderRadius: 2, background: i < strength ? strengthColor : "var(--bg-sunken)" }} />)}
                </div>
                <span style={{ font: "600 11px var(--font-sans)", color: strengthColor }}>{strengthLabel}</span>
              </div>
            ) : null}
          </UsField>
          <UsField label="Confirm new password">
            <input type="password" style={{ ...usInput, fontFamily: "var(--font-mono)", borderColor: n2 && !matches ? "var(--warn)" : "var(--line)" }} value={n2} onChange={e => setN2(e.target.value)} />
            {n2 && !matches ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--warn)" }}>Passwords don't match</span> : null}
          </UsField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button disabled={!ready} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: ready ? "var(--accent)" : "var(--bg-sunken)", color: ready ? "white" : "var(--ink-muted)", font: "600 13px var(--font-sans)", cursor: ready ? "pointer" : "not-allowed" }}>Update password</button>
          </div>
        </div>
        <div style={{ background: "var(--bg-sunken)", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ font: "700 12px var(--font-sans)", color: "var(--ink)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>Requirements</div>
          <ul style={{ margin: 0, paddingLeft: 18, font: "500 12px var(--font-sans)", color: "var(--ink-soft)", lineHeight: 1.7 }}>
            <li>Minimum 10 characters</li>
            <li>Mix of upper, lower, digit, symbol</li>
            <li>Cannot reuse last 5 passwords</li>
            <li>Must differ from your email and name</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---------- Two-factor ----------
function TwoFactorTab() {
  const [authApp, setAuthApp] = React.useState(true);
  const [sms, setSms] = React.useState(false);
  const [showCodes, setShowCodes] = React.useState(false);
  const codes = ["F8K2-9P3M", "Q7L1-W4XN", "B3R6-T2VC", "Y9D5-A1ZH", "K2J8-M6PR", "N4S0-C7BE", "X1T9-G3UF", "H6Q5-L8DO"];

  return (
    <div>
      <UsSectionTitle sub="Required for accounts with approval permissions. Your firm enforces 2FA on all members.">Two-factor authentication</UsSectionTitle>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--emerald-soft-bg)", color: "var(--emerald)", borderRadius: 8, marginBottom: 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified</span>
        <span style={{ font: "600 12.5px var(--font-sans)" }}>2FA is ON · authenticator app set up 12-Feb-2026</span>
      </div>

      <UsRow title="Authenticator app" sub="Google Authenticator, 1Password, Authy — recommended."
             control={<UsToggle on={authApp} onChange={setAuthApp} />} />
      <UsRow title="SMS backup" sub={sms ? "+91 98765 43210 verified" : "Less secure — only enable as a backup."}
             control={<UsToggle on={sms} onChange={setSms} />} />
      <UsRow title="Recovery codes" sub="One-time codes for when you lose your device. Store somewhere safe."
             control={
               <div style={{ display: "inline-flex", gap: 6 }}>
                 <button onClick={() => setShowCodes(s => !s)} style={{ height: 28, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>{showCodes ? "Hide" : "View codes"}</button>
                 <button style={{ height: 28, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Regenerate</button>
               </div>
             } />

      {showCodes ? (
        <div style={{ marginTop: 12, padding: 14, background: "var(--bg-sunken)", border: "1px dashed var(--line)", borderRadius: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {codes.map(c => <code key={c} style={{ font: "600 13px var(--font-mono)", color: "var(--ink)", textAlign: "center", padding: "6px 4px", background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 4 }}>{c}</code>)}
          </div>
          <div style={{ marginTop: 10, font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>Each code works once. 8 remaining.</div>
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <UsSectionTitle sub="Devices currently signed in to your account.">Active sessions</UsSectionTitle>
        {[
          { dev: "MacBook Pro · Chrome 124", loc: "Mumbai, IN · 103.21.x.x", ts: "Now",       cur: true },
          { dev: "iPhone 15 · LedgerBuddy iOS", loc: "Mumbai, IN · 49.36.x.x", ts: "12 min ago" },
          { dev: "Windows · Edge 122",        loc: "Pune, IN · 117.218.x.x",  ts: "3 days ago" },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--ink-soft)" }}>{s.dev.includes("iPhone") ? "smartphone" : "computer"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>{s.dev} {s.cur ? <span style={{ marginLeft: 6, font: "600 10px var(--font-sans)", color: "var(--emerald)", textTransform: "uppercase", letterSpacing: ".06em" }}>· this device</span> : null}</div>
              <div style={{ font: "500 11.5px var(--font-mono)", color: "var(--ink-soft)" }}>{s.loc} · {s.ts}</div>
            </div>
            {!s.cur ? <button style={{ height: 26, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line)", background: "transparent", color: "var(--warn)", font: "600 11px var(--font-sans)", cursor: "pointer" }}>Sign out</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Notifications ----------
function NotificationsTab() {
  const [prefs, setPrefs] = React.useState({
    daily_summary: { email: true,  inapp: true,  push: false },
    needs_review:  { email: false, inapp: true,  push: true  },
    awaiting_appr: { email: true,  inapp: true,  push: true  },
    export_done:   { email: false, inapp: true,  push: false },
    bridge_offline:{ email: true,  inapp: true,  push: true  },
    bank_changed:  { email: true,  inapp: true,  push: true  },
    weekly_digest: { email: true,  inapp: false, push: false },
  });
  const set = (key, ch, v) => setPrefs(p => ({ ...p, [key]: { ...p[key], [ch]: v } }));

  const rows = [
    { id: "daily_summary", title: "Daily summary",          sub: "Inbox snapshot at 09:00 IST every weekday" },
    { id: "needs_review",  title: "Invoice needs review",   sub: "When AI flags a risk signal on a parsed bill" },
    { id: "awaiting_appr", title: "Awaiting your approval", sub: "Routed to you in the approval chain" },
    { id: "export_done",   title: "Tally export complete",  sub: "Batch finished or partially failed" },
    { id: "bridge_offline",title: "Tally bridge offline",   sub: "Bridge agent has been unreachable for 5+ min" },
    { id: "bank_changed",  title: "Vendor bank changed",    sub: "Any vendor whose bank details changed in last 7 days" },
    { id: "weekly_digest", title: "Weekly digest",          sub: "Volume, exceptions, and team activity — Monday 09:00" },
  ];

  const Cell = ({ k, ch }) => (
    <td style={{ textAlign: "center" }}>
      <UsToggle on={prefs[k][ch]} onChange={(v) => set(k, ch, v)} />
    </td>
  );

  return (
    <div>
      <UsSectionTitle sub="Channel preferences for events that mention you. Firm-wide alerts (e.g. compliance) are always email.">Notifications</UsSectionTitle>

      <table className="lbtable" style={{ width: "100%", marginTop: 4 }}>
        <thead>
          <tr>
            <th style={{ width: "auto" }}>Event</th>
            <th style={{ width: 90, textAlign: "center" }}>Email</th>
            <th style={{ width: 90, textAlign: "center" }}>In-app</th>
            <th style={{ width: 90, textAlign: "center" }}>Push</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>{r.title}</div>
                <div style={{ font: "500 11.5px var(--font-sans)", color: "var(--ink-soft)", marginTop: 1 }}>{r.sub}</div>
              </td>
              <Cell k={r.id} ch="email" />
              <Cell k={r.id} ch="inapp" />
              <Cell k={r.id} ch="push" />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <UsField label="Quiet hours" hint="Suppress push & in-app between these times.">
          <div style={{ display: "inline-flex", gap: 6 }}>
            <input style={{ ...usInput, width: 110, fontFamily: "var(--font-mono)" }} defaultValue="20:00" />
            <span style={{ alignSelf: "center", color: "var(--ink-muted)" }}>—</span>
            <input style={{ ...usInput, width: 110, fontFamily: "var(--font-mono)" }} defaultValue="08:30" />
          </div>
        </UsField>
        <UsField label="Daily summary delivery time">
          <input style={{ ...usInput, width: 110, fontFamily: "var(--font-mono)" }} defaultValue="09:00" />
        </UsField>
      </div>
    </div>
  );
}

// ---------- Audit log ----------
function AuditTab() {
  const events = [
    { ts: "14-Apr-2026 10:21:42", action: "Approved invoice",         target: "AP-INV-22041 · Hari Vishnu Industries", ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "14-Apr-2026 10:18:11", action: "Marked invoice reviewed",  target: "RJIL-92834 · Sundaram Textiles",         ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "14-Apr-2026 09:47:03", action: "Signed in",                target: "—",                                       ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "13-Apr-2026 18:02:19", action: "Exported batch to Tally",  target: "B-2604-013 · 8 vouchers",                ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "13-Apr-2026 16:44:50", action: "Updated vendor bank",      target: "Madurai Sweets — A/C ····4421",          ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "13-Apr-2026 11:12:08", action: "Invited team member",      target: "sneha@khan-ca.in (AP Clerk)",            ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "12-Apr-2026 21:03:55", action: "Signed in",                target: "—",                                       ip: "49.36.x.x",  dev: "iPhone · LB iOS" },
    { ts: "12-Apr-2026 17:32:14", action: "Exported batch to Tally",  target: "B-2604-014 · 12 vouchers",               ip: "103.21.x.x", dev: "MacBook · Chrome" },
    { ts: "12-Apr-2026 09:14:01", action: "Changed notification prefs", target: "Daily summary → 09:00",                ip: "103.21.x.x", dev: "MacBook · Chrome" },
  ];
  return (
    <div>
      <UsSectionTitle sub="Last 90 days of actions performed by you. Firm-wide audit lives under Configuration → Audit.">Your audit log</UsSectionTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...usInput, flex: 1 }} placeholder="Search action or target…" />
        <select style={{ ...usInput, width: 160, padding: "0 8px" }}>
          <option>All actions</option><option>Sign-in events</option><option>Approvals</option><option>Edits</option><option>Exports</option>
        </select>
        <button style={{ height: 32, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export CSV
        </button>
      </div>
      <table className="lbtable" style={{ width: "100%" }}>
        <thead><tr><th style={{ width: 180 }}>When</th><th style={{ width: 220 }}>Action</th><th>Target</th><th style={{ width: 140 }}>IP</th><th style={{ width: 180 }}>Device</th></tr></thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{e.ts}</td>
              <td style={{ font: "600 12.5px var(--font-sans)" }}>{e.action}</td>
              <td className="mono-cell" style={{ color: "var(--ink)" }}>{e.target}</td>
              <td className="mono-cell" style={{ color: "var(--ink-soft)" }}>{e.ip}</td>
              <td style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)" }}>{e.dev}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Preferences ----------
function PreferencesTab() {
  const [density, setDensity] = React.useState("comfortable");
  const [keys, setKeys] = React.useState(true);
  const [autoAdv, setAutoAdv] = React.useState(true);
  const [defaultLanding, setDefaultLanding] = React.useState("dashboard");

  return (
    <div>
      <UsSectionTitle sub="Tweaks that only affect your account.">Preferences</UsSectionTitle>

      <UsRow title="Default landing page" sub="Where LedgerBuddy opens after sign-in."
             control={
               <select style={{ ...usInput, width: 200, padding: "0 8px" }} value={defaultLanding} onChange={e => setDefaultLanding(e.target.value)}>
                 <option value="dashboard">Overview</option>
                 <option value="action">Action Required</option>
                 <option value="invoices">Invoices</option>
                 <option value="recon">Reconciliation</option>
               </select>
             } />

      <UsRow title="Table density" sub="Affects rows per screen across all data tables."
             control={
               <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
                 {[
                   { id: "compact", label: "Compact" },
                   { id: "comfortable", label: "Comfortable" },
                   { id: "spacious", label: "Spacious" },
                 ].map(o => {
                   const on = density === o.id;
                   return <button key={o.id} onClick={() => setDensity(o.id)} style={{ height: 28, padding: "0 12px", border: 0, borderLeft: o.id === "comfortable" || o.id === "spacious" ? "1px solid var(--line)" : 0, background: on ? "var(--accent-soft-bg)" : "var(--bg-panel)", color: on ? "var(--accent)" : "var(--ink)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>{o.label}</button>;
                 })}
               </div>
             } />

      <UsRow title="Keyboard shortcuts" sub="J/K to walk queue, A to approve, R to reject, ⌘K for search."
             control={<UsToggle on={keys} onChange={setKeys} />} />

      <UsRow title="Auto-advance after approval" sub="Move to the next item in the action queue automatically."
             control={<UsToggle on={autoAdv} onChange={setAutoAdv} />} />

      <UsRow title="Show monetary values in" sub="Affects display only — exports always use full precision."
             control={
               <select style={{ ...usInput, width: 200, padding: "0 8px" }} defaultValue="lakh">
                 <option value="full">Full (₹3,18,60,000)</option>
                 <option value="lakh">Lakh / Crore (₹3.19 Cr)</option>
                 <option value="million">Million (₹31.86 M)</option>
               </select>
             } />

      <UsRow title="Date format"
             control={
               <select style={{ ...usInput, width: 200, padding: "0 8px" }} defaultValue="dd-mmm">
                 <option value="dd-mmm">14-Apr-2026</option>
                 <option value="dd-mm">14/04/2026</option>
                 <option value="iso">2026-04-14</option>
               </select>
             } />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: "var(--accent)", color: "white", font: "600 13px var(--font-sans)", cursor: "pointer" }}>Save preferences</button>
      </div>
    </div>
  );
}

window.UserSettings = UserSettings;

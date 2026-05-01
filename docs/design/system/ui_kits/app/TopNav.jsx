// TopNav.jsx — sticky top bar with realm switcher + user profile menu
function TopNav({ realm, onOpenPalette, onToggleTheme, dark, theme, onSetTheme, onOpenUserSettings, onSignOut }) {
  const [menu, setMenu] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState(null);
  const fileRef = React.useRef(null);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!menu) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  const onPick = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setPhoto(r.result); r.readAsDataURL(f);
  };

  const themeOpts = [
    { id: "light",  label: "Light",       sub: "Clean & accessible",    bg: "#ffffff", ink: "#0f172a" },
    { id: "dark",   label: "Dark",        sub: "Easy on the eyes",      bg: "#0b1220", ink: "#e2e8f0" },
    { id: "system", label: "System",      sub: "Match my OS",           bg: "linear-gradient(135deg, #ffffff 50%, #0b1220 50%)", ink: "#64748b" },
  ];
  const currentTheme = theme || (dark ? "dark" : "light");

  return (
    <header className="app-topnav">
      <div className="realm-pill-group">
        <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-muted)" }}>Client org</span>
        <button className="realm-pill" onClick={onOpenPalette}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_tree</span>
          {realm}
          <span className="kbd">⌘K</span>
        </button>
      </div>
      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <button className="iconbtn" title="Search"><span className="material-symbols-outlined">search</span></button>
        <button className="iconbtn" title="Notifications"><span className="material-symbols-outlined">notifications</span></button>
        <button className="iconbtn" title="Toggle theme" onClick={onToggleTheme}>
          <span className="material-symbols-outlined">{dark ? "light_mode" : "dark_mode"}</span>
        </button>

        <div ref={ref} style={{ position: "relative" }}>
          <button onClick={() => setMenu(o => !o)} title="Account"
                  style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid var(--line)", background: photo ? "transparent" : "var(--accent-soft-bg)", color: "var(--accent)", font: "700 12px var(--font-sans)", cursor: "pointer", overflow: "hidden", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "RP"}
          </button>
          {menu ? (
            <div style={{ position: "absolute", right: 0, top: 38, width: 320, background: "var(--bg-panel)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 14px 40px rgba(15,23,42,.18)", zIndex: 80, overflow: "hidden" }}>
              {/* Identity */}
              <div style={{ padding: "14px 14px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line-soft)" }}>
                <button onClick={() => fileRef.current?.click()} title="Change photo"
                        style={{ position: "relative", width: 48, height: 48, borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)", background: photo ? "transparent" : "var(--accent-soft-bg)", color: "var(--accent)", font: "700 16px var(--font-sans)", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "RP"}
                  <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .15s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                  </span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "700 13px var(--font-sans)", color: "var(--ink)" }}>Reena Patel</div>
                  <div style={{ font: "500 11px var(--font-mono)", color: "var(--ink-soft)" }}>reena@khan-ca.in</div>
                  <div style={{ marginTop: 4, font: "600 10px var(--font-sans)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".06em" }}>Senior Accountant · 5 client orgs</div>
                </div>
              </div>

              {/* Theme picker */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line-soft)" }}>
                <div style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)", marginBottom: 6 }}>Theme</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {themeOpts.map(t => {
                    const on = currentTheme === t.id;
                    return (
                      <button key={t.id} onClick={() => onSetTheme?.(t.id)}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 6px", borderRadius: 8, border: "1px solid " + (on ? "var(--accent)" : "var(--line)"), background: on ? "var(--accent-soft-bg)" : "var(--bg-panel)", color: "var(--ink)", cursor: "pointer" }}>
                        <span style={{ width: 32, height: 22, borderRadius: 4, background: t.bg, border: "1px solid var(--line)" }} />
                        <span style={{ font: "600 11px var(--font-sans)", color: on ? "var(--accent)" : "var(--ink)" }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Menu items */}
              <div style={{ padding: 6 }}>
                {[
                  { icon: "person",       label: "Edit profile",    sub: "Name, role, contact",      tab: "profile" },
                  { icon: "lock",         label: "Update password", sub: "Last changed 47 days ago", onClick: () => { setMenu(false); setPwOpen(true); } },
                  { icon: "shield",       label: "Two-factor auth", sub: "Authenticator app · ON",   tab: "twofa" },
                  { icon: "notifications",label: "Notifications",   sub: "Daily summary at 09:00 IST", tab: "notifications" },
                  { icon: "schedule",     label: "Audit log",       sub: "Your recent actions",      tab: "audit" },
                ].map(m => (
                  <button key={m.label} onClick={m.onClick || (() => { setMenu(false); onOpenUserSettings?.(m.tab); })} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 6, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-sunken)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--ink-soft)" }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: "600 12.5px var(--font-sans)", color: "var(--ink)" }}>{m.label}</div>
                      <div style={{ font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>{m.sub}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ padding: 6, borderTop: "1px solid var(--line-soft)" }}>
                <button onClick={() => { setMenu(false); onSignOut?.(); }} style={{ width: "100%", height: 30, borderRadius: 6, border: "1px solid var(--warn)", background: "transparent", color: "var(--warn)", font: "600 12px var(--font-sans)", cursor: "pointer" }}>Sign out</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {pwOpen ? <PasswordModal onClose={() => setPwOpen(false)} /> : null}
    </header>
  );
}

function PasswordModal({ onClose }) {
  const [cur, setCur] = React.useState("");
  const [n1, setN1] = React.useState("");
  const [n2, setN2] = React.useState("");

  // strength
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
  const inputCss = { height: 32, padding: "0 10px", border: "1px solid var(--line)", background: "var(--bg-main)", color: "var(--ink)", borderRadius: 6, font: "500 13px var(--font-mono)", outline: "none" };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
        <div className="modal-head">
          <div>
            <h2>Update password</h2>
            <div style={{ font: "500 12px var(--font-sans)", color: "var(--ink-soft)", marginTop: 2 }}>You'll be signed out of other devices.</div>
          </div>
          <button className="iconbtn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Current password</span>
            <input type="password" style={inputCss} value={cur} onChange={e => setCur(e.target.value)} autoFocus />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>New password</span>
            <input type="password" style={inputCss} value={n1} onChange={e => setN1(e.target.value)} placeholder="At least 10 characters" />
            {n1 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3 }}>
                  {[0,1,2,3,4].map(i => <span key={i} style={{ height: 4, borderRadius: 2, background: i < strength ? strengthColor : "var(--bg-sunken)" }} />)}
                </div>
                <span style={{ font: "600 11px var(--font-sans)", color: strengthColor }}>{strengthLabel}</span>
              </div>
            ) : null}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ font: "600 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--ink-soft)" }}>Confirm new password</span>
            <input type="password" style={{ ...inputCss, borderColor: n2 && !matches ? "var(--warn)" : "var(--line)" }} value={n2} onChange={e => setN2(e.target.value)} />
            {n2 && !matches ? <span style={{ font: "500 11px var(--font-sans)", color: "var(--warn)" }}>Passwords don't match</span> : null}
          </label>
          <div style={{ background: "var(--bg-sunken)", borderRadius: 8, padding: "8px 10px", font: "500 11px var(--font-sans)", color: "var(--ink-soft)" }}>
            <div style={{ font: "600 10px var(--font-sans)", color: "var(--ink)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Requirements</div>
            <div>· Minimum 10 characters · Mix of upper, lower, digit, symbol</div>
            <div>· Cannot reuse last 5 passwords</div>
          </div>
        </div>
        <div className="modal-foot">
          <button onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-panel)", color: "var(--ink)", font: "600 13px var(--font-sans)" }}>Cancel</button>
          <button disabled={!ready} onClick={onClose} style={{ height: 32, padding: "0 14px", borderRadius: 8, border: 0, background: ready ? "var(--accent)" : "var(--bg-sunken)", color: ready ? "white" : "var(--ink-muted)", font: "600 13px var(--font-sans)", cursor: ready ? "pointer" : "not-allowed" }}>Update password</button>
        </div>
      </div>
    </div>
  );
}

window.TopNav = TopNav;
window.PasswordModal = PasswordModal;

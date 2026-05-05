import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/state/sessionStore";
import { useTheme } from "@/state/useTheme";
import type { ThemeMode } from "@/state/sessionStore";

const THEME_OPTIONS: ReadonlyArray<{ id: ThemeMode; label: string; sub: string; swatchClass: string }> = [
  { id: "light", label: "Light", sub: "Clean & accessible", swatchClass: "theme-swatch theme-swatch-light" },
  { id: "dark", label: "Dark", sub: "Easy on the eyes", swatchClass: "theme-swatch theme-swatch-dark" },
  { id: "system", label: "System", sub: "Match my OS", swatchClass: "theme-swatch theme-swatch-system" }
];

const DEFERRED_ITEMS: ReadonlyArray<{ icon: string; label: string; sub: string }> = [
  { icon: "person", label: "Edit profile", sub: "Settings page in Step 6" },
  { icon: "shield", label: "Two-factor auth", sub: "Settings page in Step 6" },
  { icon: "notifications", label: "Notifications", sub: "Settings page in Step 6" },
  { icon: "schedule", label: "Audit log", sub: "Settings page in Step 6" }
];

function avatarInitials(email: string): string {
  if (email.length === 0) return "U";
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function AvatarMenu() {
  const user = useSessionStore((state) => state.user);
  const clearSession = useSessionStore((state) => state.clearSession);
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initials = avatarInitials(user?.email ?? "");

  const onUpdatePassword = () => {
    setOpen(false);
    if (typeof window !== "undefined") window.location.hash = "#/change-password";
  };

  const onSignOut = () => {
    setOpen(false);
    clearSession();
    if (typeof window !== "undefined") window.location.hash = "#/login";
  };

  return (
    <div className="avatar-wrap" ref={ref}>
      <button
        type="button"
        className="avatar-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initials}
      </button>
      {open ? (
        <div className="avatar-menu" role="menu">
          <div className="avatar-menu-identity">
            <div className="avatar-menu-avatar">{initials}</div>
            <div className="avatar-menu-identity-text">
              <div className="avatar-menu-name">{user?.email ?? "Signed in"}</div>
              {user?.role ? <div className="avatar-menu-role">{user.role}</div> : null}
            </div>
          </div>
          <div className="avatar-menu-section">
            <div className="avatar-menu-section-title">Theme</div>
            <div className="theme-grid">
              {THEME_OPTIONS.map((option) => {
                const selected = theme === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`theme-tile${selected ? " theme-tile-selected" : ""}`}
                    onClick={() => setTheme(option.id)}
                    aria-pressed={selected}
                    title={option.sub}
                  >
                    <span className={option.swatchClass} />
                    <span className="theme-tile-label">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="avatar-menu-list">
            <button type="button" className="avatar-menu-item" onClick={onUpdatePassword}>
              <span className="material-symbols-outlined avatar-menu-item-icon">lock</span>
              <div className="avatar-menu-item-text">
                <div className="avatar-menu-item-label">Update password</div>
                <div className="avatar-menu-item-sub">Change your sign-in password</div>
              </div>
            </button>
            {DEFERRED_ITEMS.map((item) => (
              <button
                type="button"
                key={item.label}
                className="avatar-menu-item avatar-menu-item-disabled"
                disabled
                title={item.sub}
              >
                <span className="material-symbols-outlined avatar-menu-item-icon">{item.icon}</span>
                <div className="avatar-menu-item-text">
                  <div className="avatar-menu-item-label">{item.label}</div>
                  <div className="avatar-menu-item-sub">{item.sub}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="avatar-menu-foot">
            <button type="button" className="avatar-signout" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

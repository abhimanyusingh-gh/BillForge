import { PlatformSection } from "@/features/platform-admin/PlatformSection";

const TENANT_MODE = {
  TEST: "test",
  LIVE: "live"
} as const;

type TenantMode = (typeof TENANT_MODE)[keyof typeof TENANT_MODE];

interface PlatformOnboardForm {
  tenantName: string;
  adminEmail: string;
  adminDisplayName: string;
  mode: string;
}

interface PlatformOnboardSectionProps {
  form: PlatformOnboardForm;
  collapsed: boolean;
  onToggle: () => void;
  onChange: (form: PlatformOnboardForm) => void;
  onSubmit: () => void;
  helpText?: string;
}

export function PlatformOnboardSection({
  form,
  collapsed,
  onToggle,
  onChange,
  onSubmit,
  helpText
}: PlatformOnboardSectionProps) {
  const mode: TenantMode = form.mode === TENANT_MODE.LIVE ? TENANT_MODE.LIVE : TENANT_MODE.TEST;
  const ready = form.tenantName.length > 2 && /\S+@\S+\.\S+/.test(form.adminEmail);
  return (
    <PlatformSection
      title="Onboard new tenant"
      icon="add_business"
      collapsed={collapsed}
      onToggle={onToggle}
      helpText={helpText}
      subtitle="Creates a tenant org + first admin user. The admin receives a temporary password."
    >
      <div className="pa-card-body">
        <div className="pa-onboard">
          <label>
            <span>Tenant name</span>
            <input
              value={form.tenantName}
              onChange={(event) => onChange({ ...form, tenantName: event.target.value })}
              placeholder="e.g. Khan & Associates, CA"
            />
          </label>
          <label>
            <span>Admin name</span>
            <input
              value={form.adminDisplayName}
              onChange={(event) => onChange({ ...form, adminDisplayName: event.target.value })}
              placeholder="Mahir Khan"
            />
          </label>
          <label>
            <span>Admin email</span>
            <input
              value={form.adminEmail}
              onChange={(event) => onChange({ ...form, adminEmail: event.target.value })}
              placeholder="admin@firm.in"
            />
          </label>
          <label>
            <span>Tenant mode</span>
            <select
              value={mode}
              onChange={(event) => onChange({ ...form, mode: event.target.value })}
            >
              <option value={TENANT_MODE.TEST}>Test</option>
              <option value={TENANT_MODE.LIVE}>Live</option>
            </select>
          </label>
        </div>
        <div className="pa-onboard-actions">
          <span className="pa-onboard-hint">
            <span className="material-symbols-outlined">info</span>
            Welcome email sent to <b>{form.adminEmail || "admin@…"}</b> with sign-in link.
          </span>
          <span className="pa-onboard-spacer" />
          <button
            type="button"
            className="pa-btn pa-btn-primary"
            onClick={onSubmit}
            disabled={!ready}
          >
            <span className="material-symbols-outlined">add</span>
            Create tenant
          </button>
        </div>
      </div>
    </PlatformSection>
  );
}

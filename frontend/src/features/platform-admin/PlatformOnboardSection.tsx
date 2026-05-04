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
  return (
    <PlatformSection
      title="Onboard Tenant Admin"
      icon="add_business"
      collapsed={collapsed}
      onToggle={onToggle}
      helpText={helpText}
      subtitle="Creates a tenant org + first admin user."
      actions={
        <button type="button" className="app-button app-button-primary" onClick={onSubmit}>
          <span className="material-symbols-outlined">add_task</span>
          Create Tenant Admin
        </button>
      }
    >
      <div className="pa-card-body">
        <div className="pa-onboard">
          <label>
            <span>Tenant Name</span>
            <input
              value={form.tenantName}
              onChange={(event) => onChange({ ...form, tenantName: event.target.value })}
              placeholder="e.g. Acme Corp"
            />
          </label>
          <label>
            <span>Tenant Admin Email</span>
            <input
              value={form.adminEmail}
              onChange={(event) => onChange({ ...form, adminEmail: event.target.value })}
              placeholder="admin@tenant.com"
            />
          </label>
          <label>
            <span>Admin Name (optional)</span>
            <input
              value={form.adminDisplayName}
              onChange={(event) => onChange({ ...form, adminDisplayName: event.target.value })}
              placeholder="Full Name"
            />
          </label>
          <label>
            <span>Tenant Mode</span>
            <select
              value={mode}
              onChange={(event) => onChange({ ...form, mode: event.target.value })}
            >
              <option value={TENANT_MODE.TEST}>Test</option>
              <option value={TENANT_MODE.LIVE}>Live</option>
            </select>
          </label>
        </div>
      </div>
    </PlatformSection>
  );
}

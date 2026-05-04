import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useTenantWorkspace } from "@/hooks/useTenantWorkspace";
import { OverviewDashboard } from "@/features/overview/OverviewDashboard";
import { LoginPage } from "@/features/auth/LoginPage";
import { ChangePasswordPanel } from "@/features/auth/ChangePasswordPanel";
import { PlatformAdminTopNav } from "@/features/platform-admin/PlatformAdminTopNav";
import { PlatformActivityMonitor } from "@/features/platform-admin/PlatformActivityMonitor";
import { PlatformOnboardSection } from "@/features/platform-admin/PlatformOnboardSection";
import { PlatformUsageOverviewSection } from "@/features/platform-admin/PlatformUsageOverviewSection";
import { PlatformAnalyticsDashboard } from "@/features/platform-admin/PlatformAnalyticsDashboard";
import { WorkspaceTopNav } from "@/features/workspace/WorkspaceTopNav";
import { WorkspaceTabBar } from "@/features/workspace/WorkspaceTabBar";
import { AppShell } from "@/features/workspace/AppShell";
import { useTabHashRouting } from "@/features/workspace/useTabHashRouting";
import type { TenantViewTab } from "@/types";
import { TenantConfigTab } from "@/features/tenant-admin/TenantConfigTab";
import { InvoiceView } from "@/features/invoices/InvoiceView";
import { ExportHistoryDashboard } from "@/features/exports/ExportHistoryDashboard";
import { EmptyState } from "@/components/common/EmptyState";
import { BankConnectionsTab } from "@/features/tenant-admin/BankConnectionsTab";
import { BankStatementsTab } from "@/features/tenant-admin/BankStatementsTab";
import { InvoiceDetailPage } from "@/components/invoice/InvoiceDetailPage";
import { TriagePage } from "@/features/triage/TriagePage";
import { ActionRequiredPage } from "@/features/invoices/ActionRequiredPage";
import { UserSettingsPage } from "@/features/user-settings/UserSettingsPage";
const MailboxesPage = lazy(() =>
  import("@/features/admin/mailboxes/MailboxesPage").then((m) => ({ default: m.MailboxesPage }))
);
const ClientOrgsPage = lazy(() =>
  import("@/features/admin/onboarding/ClientOrgsPage").then((m) => ({ default: m.ClientOrgsPage }))
);
const TdsDashboardPage = lazy(() =>
  import("@/features/reports/TdsDashboardPage").then((m) => ({ default: m.TdsDashboardPage }))
);
const VendorListPage = lazy(() =>
  import("@/features/vendors/VendorListPage").then((m) => ({ default: m.VendorListPage }))
);
const VendorDetailPage = lazy(() =>
  import("@/features/vendors/VendorDetailPage").then((m) => ({ default: m.VendorDetailPage }))
);
import { readStandaloneHashRoute, STANDALONE_HASH_PATH, type StandaloneHashRoute } from "@/features/workspace/tabHashConfig";
import { parseVendorDetailHash } from "@/features/vendors/vendorDetailHashState";
import { useActionRequiredQueue } from "@/hooks/useActionRequiredQueue";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/common/ToastContainer";

function useStandaloneHashRoute(): StandaloneHashRoute | null {
  const [route, setRoute] = useState<StandaloneHashRoute | null>(() =>
    typeof window === "undefined" ? null : readStandaloneHashRoute(window.location.hash)
  );
  useEffect(() => {
    const handler = () => setRoute(readStandaloneHashRoute(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return route;
}

export function App() {
  const { toasts, addToast, removeToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const standaloneRoute = useStandaloneHashRoute();
  const workspace = useTenantWorkspace({ addToast });

  const {
    authLoading,
    session,
    tenantUsers,
    platformUsage,
    inviteEmail,
    setInviteEmail,
    onboardingForm,
    setOnboardingForm,
    platformOnboardForm,
    setPlatformOnboardForm,
    setNavCounts,
    gmailConnection,
    mailboxes,
    bankAccounts,
    bankStatements,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    loginSubmitting,
    activeTab,
    setActiveTab,
    selectedPlatformTenantId,
    setSelectedPlatformTenantId,
    platformOnboardCollapsed,
    setPlatformOnboardCollapsed,
    platformUsageCollapsed,
    setPlatformUsageCollapsed,
    platformActivityCollapsed,
    setPlatformActivityCollapsed,
    showChangePassword,
    setShowChangePassword,
    changePasswordForm,
    setChangePasswordForm,
    platformOnboardResult,
    setPlatformOnboardResult,
    error,
    setError,
    platformStats,
    selectedPlatformTenant,
    handleConnectGmail,
    handleChangePassword,
    handleLogout,
    handleLogin,
    handleCompleteOnboarding,
    handlePlatformOnboardTenantAdmin,
    handleUploadBankStatement,
    handleInviteUser,
    handleRoleChange,
    handleToggleUserEnabled,
    handleRemoveUser,
    handleAssignMailboxUser,
    handleRemoveMailboxAssignment,
    handleRemoveMailbox,
    handleAddBankAccount,
    handleRefreshBankBalance,
    handleRevokeBankAccount,
    handleToggleTenantEnabled,
    loadGmailConnectionStatus,
    loadPlatformUsage,
    loadBankStatements
  } = workspace;

  if (authLoading) {
    return (
      <div className="layout">
        <main className="content content-list-expanded">
          <section className="panel list-panel"><h2>Authenticating...</h2></section>
        </main>
      </div>
    );
  }

  const invoiceDetailId = new URLSearchParams(window.location.search).get("invoiceDetail");
  if (session && invoiceDetailId) {
    return (
      <div className="layout">
        <InvoiceDetailPage invoiceId={invoiceDetailId} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  if (!session) {
    const verified = new URLSearchParams(window.location.search).get("verified") === "true";
    return (
      <>
        {verified && <div className="verified-banner">Email verified! You can now log in.</div>}
        <LoginPage
          email={loginEmail}
          password={loginPassword}
          submitting={loginSubmitting}
          error={error}
          onEmailChange={setLoginEmail}
          onPasswordChange={setLoginPassword}
          onSubmit={() => { void handleLogin(); }}
        />
      </>
    );
  }

  if (showChangePassword) {
    return (
      <ChangePasswordPanel
        form={changePasswordForm}
        mustChange={session.flags.must_change_password}
        error={error}
        onFieldChange={(field, value) => setChangePasswordForm((form) => ({ ...form, [field]: value }))}
        onSubmit={() => { void handleChangePassword(); }}
        onCancel={() => {
          setShowChangePassword(false);
          setError(null);
          setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        }}
      />
    );
  }

  const caps = session.user.capabilities;
  const isPlatformAdmin = session.user.isPlatformAdmin;
  const requiresTenantSetup = session.flags.requires_tenant_setup;
  const canManageUsers = caps.canManageUsers === true;
  const canManageMailboxes = caps.canManageMailboxes === true;
  const canManageConnections = caps.canManageConnections === true;
  const canViewConfig = canManageUsers || caps.canConfigureWorkflow === true || caps.canConfigureGlCodes === true || caps.canConfigureCompliance === true;
  const canViewConnections = canManageConnections;
  const canViewAllInvoices = caps.canViewAllInvoices === true;

  const themeToggle = (
    <button
      type="button"
      className="app-button app-button-secondary"
      style={{ padding: "0.3rem 0.5rem" }}
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="material-symbols-outlined" style={{ fontSize: "1.1rem" }}>{theme === "dark" ? "light_mode" : "dark_mode"}</span>
    </button>
  );

  if (isPlatformAdmin) {
    return (
      <div className="layout layout-platform pa-shell">
        <PlatformAdminTopNav
          userEmail={session.user.email}
          onLogout={handleLogout}
          onChangePassword={() => setShowChangePassword(true)}
          counts={{ tenants: platformStats.tenants, failedDocuments: platformStats.failedDocuments }}
          themeToggle={themeToggle}
        />
        <main className="pa-main">
          {activeTab === "dashboard" && (
            <>
              <PlatformOnboardSection
                form={platformOnboardForm}
                collapsed={platformOnboardCollapsed}
                onToggle={() => setPlatformOnboardCollapsed((value) => !value)}
                onChange={setPlatformOnboardForm}
                onSubmit={() => { void handlePlatformOnboardTenantAdmin(); }}
                helpText="Create a new tenant organization and its first admin user. The admin will receive a temporary password."
              />
              {platformOnboardResult && (
                <div className="tenant-created-success">
                  <strong>Tenant created.</strong> Temporary password for <code>{platformOnboardResult.adminEmail}</code>: <code>{platformOnboardResult.tempPassword}</code>
                  <button type="button" className="app-button app-button-secondary tenant-created-dismiss" onClick={() => setPlatformOnboardResult(null)}>Dismiss</button>
                </div>
              )}
              <PlatformAnalyticsDashboard usage={platformUsage} />
              <PlatformUsageOverviewSection
                usage={platformUsage}
                selectedTenantId={selectedPlatformTenantId}
                collapsed={platformUsageCollapsed}
                onToggle={() => setPlatformUsageCollapsed((value) => !value)}
                onRefresh={() => { void loadPlatformUsage(); }}
                onSelectTenant={setSelectedPlatformTenantId}
                onToggleEnabled={(tenantId, enabled) => { void handleToggleTenantEnabled(tenantId, enabled); }}
              />
              <PlatformActivityMonitor
                selectedTenant={selectedPlatformTenant}
                collapsed={platformActivityCollapsed}
                onToggle={() => setPlatformActivityCollapsed((value) => !value)}
                onRefresh={() => { void loadPlatformUsage(); }}
              />
            </>
          )}
        </main>
        <div role="alert" aria-live="assertive">
          {error && <p className="error">{error}</p>}
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  const topNav = (
    <WorkspaceTopNav
      userEmail={session.user.email}
      onLogout={handleLogout}
      onChangePassword={() => setShowChangePassword(true)}
      onOpenUserSettings={() => {
        window.location.hash = STANDALONE_HASH_PATH.userSettings;
      }}
      themeToggle={themeToggle}
    />
  );

  const showSubNav = canViewConnections && (activeTab === "config" || activeTab === "connections");
  const subNav = showSubNav ? (
    <WorkspaceTabBar
      activeTab={activeTab}
      canViewTenantConfig={canViewConfig}
      canViewConnections={canViewConnections}
      onTabChange={setActiveTab}
    />
  ) : null;

  return (
    <div className="layout">
      <TenantAppShell
        tenantName={session.tenant.name}
        activeTab={activeTab}
        activeStandaloneRoute={standaloneRoute}
        onTabChange={setActiveTab}
        canViewTenantConfig={canViewConfig}
        canViewConnections={canViewConnections}
        topNav={topNav}
        subNav={subNav}
      >
        {requiresTenantSetup && canManageUsers && (
          <div className="editor-card">
            <div className="editor-header">
              <h3>Tenant Onboarding</h3>
              <button type="button" onClick={() => void handleCompleteOnboarding()}>Complete Onboarding</button>
            </div>
            <div className="edit-grid">
              <label>
                Tenant Name
                <input value={onboardingForm.tenantName} onChange={(e) => setOnboardingForm((form) => ({ ...form, tenantName: e.target.value }))} />
              </label>
              <label>
                Admin Email
                <input value={onboardingForm.adminEmail} onChange={(e) => setOnboardingForm((form) => ({ ...form, adminEmail: e.target.value }))} />
              </label>
            </div>
          </div>
        )}

        {requiresTenantSetup && !canManageUsers && (
          <EmptyState icon="hourglass_top" heading="Tenant setup in progress" description="Your tenant is being set up. Please contact your tenant administrator to complete the setup." />
        )}

        {standaloneRoute === "triage" && <TriagePage />}

        {standaloneRoute === "mailboxes" && canManageMailboxes && (
          <Suspense fallback={<div role="status" aria-busy="true">Loading mailboxes…</div>}>
            <MailboxesPage />
          </Suspense>
        )}

        {standaloneRoute === "reportsTds" && (
          <Suspense fallback={<div role="status" aria-busy="true">Loading TDS dashboard…</div>}>
            <TdsDashboardPage />
          </Suspense>
        )}

        {standaloneRoute === "vendors" && (
          <Suspense fallback={<div role="status" aria-busy="true">Loading vendors…</div>}>
            <VendorListPage />
          </Suspense>
        )}

        {standaloneRoute === "vendorDetail" && <VendorDetailRoute />}

        {standaloneRoute === "clientOrgs" && (
          <Suspense fallback={<div role="status" aria-busy="true">Loading client organizations…</div>}>
            <ClientOrgsPage />
          </Suspense>
        )}

        {standaloneRoute === "payments" && (
          <EmptyState icon="payments" heading="Payments" description="Payments aren't enabled for this client org yet." />
        )}

        {standaloneRoute === "bankStatements" && (
          <EmptyState icon="description" heading="Bank Statements" description="No bank statements connected. Add a connection in Setup → Connections." />
        )}

        {standaloneRoute === "tallySync" && <ExportHistoryDashboard addToast={addToast} />}

        {standaloneRoute === "inboxRouting" && (
          <EmptyState icon="alt_route" heading="Inbox Routing" description="Inbox routing rules not configured." />
        )}

        {standaloneRoute === "actionRequired" && (
          <ActionRequiredPage
            onSelectInvoice={(invoiceId) => {
              window.location.search = `?invoiceDetail=${encodeURIComponent(invoiceId)}`;
            }}
          />
        )}

        {standaloneRoute === "userSettings" && (
          <UserSettingsPage
            userEmail={session.user.email}
            userRoleLabel={session.user.role}
            onChangePassword={() => setShowChangePassword(true)}
            onClose={() => {
              window.location.hash = "";
            }}
          />
        )}

        {!standaloneRoute && activeTab === "overview" && (
          <OverviewDashboard
            onNavigateActionRequired={() => {
              window.location.hash = STANDALONE_HASH_PATH.actionRequired;
            }}
            onNavigateExports={() => setActiveTab("exports")}
          />
        )}

        {!standaloneRoute && activeTab === "dashboard" && (
          <InvoiceView
            tenantId={session.tenant.id}
            userId={session.user.id}
            userEmail={session.user.email}
            canViewAllInvoices={canViewAllInvoices}
            requiresTenantSetup={requiresTenantSetup}
            tenantMode={session.tenant.mode}
            capabilities={caps}
            tenantUsers={canManageUsers ? tenantUsers : undefined}
            onGmailStatusRefresh={() => void loadGmailConnectionStatus()}
            onNavCountsChange={setNavCounts}
            onSessionExpired={handleLogout}
            addToast={addToast}
          />
        )}

        {!standaloneRoute && activeTab === "exports" && <ExportHistoryDashboard addToast={addToast} />}

        {!standaloneRoute && activeTab === "config" && canViewConfig && (
          <TenantConfigTab
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
            capabilities={caps}
            gmailConnection={gmailConnection}
            onConnectGmail={() => void handleConnectGmail()}
            inviteEmail={inviteEmail}
            onInviteEmailChange={setInviteEmail}
            onInviteUser={() => void handleInviteUser(inviteEmail)}
            tenantUsers={tenantUsers}
            onRoleChange={(userId, role) => void handleRoleChange(userId, role)}
            onToggleUserEnabled={(userId, enabled) => void handleToggleUserEnabled(userId, enabled)}
            onRemoveUser={(userId) => void handleRemoveUser(userId)}
          />
        )}

        {!standaloneRoute && activeTab === "statements" && canViewConnections && (
          <BankStatementsTab
            bankStatements={bankStatements}
            onUploadBankStatement={(file, gstin, gstinLabel) => void handleUploadBankStatement(file, gstin, gstinLabel)}
            onStatementsChanged={() => void loadBankStatements()}
          />
        )}

        {!standaloneRoute && activeTab === "connections" && canViewConnections && (
          <BankConnectionsTab
            mailboxes={mailboxes}
            tenantUsers={tenantUsers}
            onAddGmailInbox={() => void handleConnectGmail()}
            onAssignMailboxUser={(id, uid) => void handleAssignMailboxUser(id, uid)}
            onRemoveMailboxAssignment={(id, uid) => void handleRemoveMailboxAssignment(id, uid)}
            onRemoveMailbox={(id) => void handleRemoveMailbox(id)}
            bankAccounts={bankAccounts}
            onAddBankAccount={(aa, name) => void handleAddBankAccount(aa, name)}
            onRefreshBankBalance={(id) => void handleRefreshBankBalance(id)}
            onRevokeBankAccount={(id) => void handleRevokeBankAccount(id)}
          />
        )}

        <div role="alert" aria-live="assertive">
          {error && <p className="error">{error}</p>}
        </div>
      </TenantAppShell>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

interface TenantAppShellProps {
  tenantName: string;
  activeTab: TenantViewTab;
  activeStandaloneRoute: StandaloneHashRoute | null;
  onTabChange: (tab: TenantViewTab) => void;
  canViewTenantConfig: boolean;
  canViewConnections: boolean;
  topNav: ReactNode;
  subNav: ReactNode;
  children: ReactNode;
}

function VendorDetailRoute() {
  const [route, setRoute] = useState(() =>
    typeof window === "undefined" ? null : parseVendorDetailHash(window.location.hash)
  );
  useEffect(() => {
    const handler = () => setRoute(parseVendorDetailHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  if (!route) return null;
  return (
    <Suspense fallback={<div role="status" aria-busy="true">Loading vendor…</div>}>
      <VendorDetailPage vendorId={route.vendorId} />
    </Suspense>
  );
}

function TenantAppShell({ tenantName, activeTab, activeStandaloneRoute, onTabChange, canViewTenantConfig, canViewConnections, topNav, subNav, children }: TenantAppShellProps) {
  const { migration } = useTabHashRouting({ activeTab, onTabChange });
  const { totalCount: actionRequiredCount } = useActionRequiredQueue();
  const navigateToStandaloneRoute = useCallback((route: StandaloneHashRoute) => {
    window.location.hash = STANDALONE_HASH_PATH[route];
  }, []);
  return (
    <AppShell
      tenantName={tenantName}
      activeTab={activeTab}
      activeStandaloneRoute={activeStandaloneRoute}
      onTabChange={onTabChange}
      onStandaloneRouteChange={navigateToStandaloneRoute}
      canViewTenantConfig={canViewTenantConfig}
      canViewConnections={canViewConnections}
      invoiceActionRequiredCount={actionRequiredCount}
      topNav={topNav}
      subNav={subNav}
      migration={migration}
    >
      {children}
    </AppShell>
  );
}

/**
 * @jest-environment jsdom
 */
import {
  useAuthStore,
  ACTIVE_TENANT_ID_STORAGE_KEY,
  TENANT_SETUP_COMPLETED_STORAGE_KEY
} from "@/stores/authStore";
import { resetStores } from "@/test-utils/resetStores";

const TENANT = "tenant-abc";
const LEGACY_SETUP_EVENT = "ledgerbuddy:tenant-setup-completed-change";

beforeEach(() => {
  window.sessionStorage.clear();
  resetStores();
});

describe("authStore.setActiveTenantId", () => {
  it("persists the id under the legacy raw-string sessionStorage key", () => {
    useAuthStore.getState().setActiveTenantId(TENANT);
    expect(window.sessionStorage.getItem(ACTIVE_TENANT_ID_STORAGE_KEY)).toBe(TENANT);
  });

  it("clears storage when called with null", () => {
    useAuthStore.getState().setActiveTenantId(TENANT);
    useAuthStore.getState().setActiveTenantId(null);
    expect(window.sessionStorage.getItem(ACTIVE_TENANT_ID_STORAGE_KEY)).toBeNull();
    expect(useAuthStore.getState().activeTenantId).toBeNull();
  });
});

describe("authStore.setTenantSetupCompleted", () => {
  it("persists 'true' under the legacy raw-string sessionStorage key", () => {
    useAuthStore.getState().setTenantSetupCompleted(true);
    expect(window.sessionStorage.getItem(TENANT_SETUP_COMPLETED_STORAGE_KEY)).toBe("true");
  });

  it("removes the storage entry when set to false", () => {
    useAuthStore.getState().setTenantSetupCompleted(true);
    useAuthStore.getState().setTenantSetupCompleted(false);
    expect(window.sessionStorage.getItem(TENANT_SETUP_COMPLETED_STORAGE_KEY)).toBeNull();
  });

  it("does NOT dispatch the legacy tenant-setup-completed-change event (retired in #173 Sub-PR C)", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    useAuthStore.getState().setTenantSetupCompleted(true);
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).not.toContain(LEGACY_SETUP_EVENT);
    dispatchSpy.mockRestore();
  });
});

describe("authStore.clearAuth", () => {
  it("clears both tenant id and setup flag in one call (logout contract)", () => {
    useAuthStore.getState().setActiveTenantId(TENANT);
    useAuthStore.getState().setTenantSetupCompleted(true);

    useAuthStore.getState().clearAuth();

    expect(window.sessionStorage.getItem(ACTIVE_TENANT_ID_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(TENANT_SETUP_COMPLETED_STORAGE_KEY)).toBeNull();
    expect(useAuthStore.getState().activeTenantId).toBeNull();
    expect(useAuthStore.getState().tenantSetupCompleted).toBe(false);
  });
});

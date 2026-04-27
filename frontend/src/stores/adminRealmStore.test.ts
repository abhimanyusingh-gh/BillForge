/**
 * @jest-environment jsdom
 */
import {
  useAdminRealmStore,
  ADMIN_CLIENT_ORG_QUERY_PARAM,
  ADMIN_CLIENT_ORG_STORAGE_KEY
} from "@/stores/adminRealmStore";
import {
  useActiveRealmStore,
  CLIENT_ORG_URL_SYNC_EVENT
} from "@/stores/activeRealmStore";
import { resetStores } from "@/test-utils/resetStores";

const ORG = "65a1b2c3d4e5f6a7b8c9d0e1";
const LEGACY_ADMIN_EVENT = "ledgerbuddy:admin-client-org-filter-change";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  resetStores();
});

describe("adminRealmStore", () => {
  it("setAdminRealm writes URL + persists to sessionStorage as raw string (no JSON envelope)", () => {
    useAdminRealmStore.getState().setAdminRealm(ORG);
    expect(new URLSearchParams(window.location.search).get(ADMIN_CLIENT_ORG_QUERY_PARAM)).toBe(ORG);
    expect(window.sessionStorage.getItem(ADMIN_CLIENT_ORG_STORAGE_KEY)).toBe(ORG);
  });

  it("setAdminRealm(null) clears URL + storage", () => {
    useAdminRealmStore.getState().setAdminRealm(ORG);
    useAdminRealmStore.getState().setAdminRealm(null);
    expect(new URLSearchParams(window.location.search).get(ADMIN_CLIENT_ORG_QUERY_PARAM)).toBeNull();
    expect(window.sessionStorage.getItem(ADMIN_CLIENT_ORG_STORAGE_KEY)).toBeNull();
  });

  it("dispatches the cross-store URL sync event", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    useAdminRealmStore.getState().setAdminRealm(ORG);
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).toContain(CLIENT_ORG_URL_SYNC_EVENT);
    dispatchSpy.mockRestore();
  });

  it("does NOT dispatch the legacy ADMIN_CLIENT_ORG_CHANGE_EVENT (lock contract — Sub-PR B removal)", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    useAdminRealmStore.getState().setAdminRealm(ORG);
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).not.toContain(LEGACY_ADMIN_EVENT);
    dispatchSpy.mockRestore();
  });

  it("propagates id to the active realm store via the URL-sync event", () => {
    useAdminRealmStore.getState().setAdminRealm(ORG);
    expect(useActiveRealmStore.getState().id).toBe(ORG);
  });

  it("rehydrates from URL on popstate", () => {
    expect(useAdminRealmStore.getState().id).toBeNull();
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useAdminRealmStore.getState().id).toBe(ORG);
  });

  it("rejects non-ObjectId URL values", () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=garbage`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(useAdminRealmStore.getState().id).toBeNull();
  });

  it("resetStores() restores the initial state", () => {
    useAdminRealmStore.getState().setAdminRealm(ORG);
    expect(useAdminRealmStore.getState().id).toBe(ORG);
    resetStores();
    expect(useAdminRealmStore.getState().id).toBeNull();
  });
});

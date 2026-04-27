/**
 * @jest-environment jsdom
 */
import {
  setActiveClientOrgId,
  ACTIVE_CLIENT_ORG_QUERY_PARAM,
  ACTIVE_CLIENT_ORG_STORAGE_KEY
} from "@/hooks/useActiveClientOrg";
import { CLIENT_ORG_URL_SYNC_EVENT } from "@/stores/activeRealmStore";
import { useAdminRealmStore } from "@/stores/adminRealmStore";
import { resetStores } from "@/test-utils/resetStores";

const ORG = "65a1b2c3d4e5f6a7b8c9d0e1";
const LEGACY_ACTIVE_EVENT = "ledgerbuddy:active-client-org-change";
const LEGACY_ADMIN_EVENT = "ledgerbuddy:admin-client-org-filter-change";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  resetStores();
});

describe("setActiveClientOrgId", () => {
  it("writes the id to the URL query param", () => {
    setActiveClientOrgId(ORG);
    expect(new URLSearchParams(window.location.search).get(ACTIVE_CLIENT_ORG_QUERY_PARAM)).toBe(ORG);
  });

  it("persists the id in sessionStorage", () => {
    setActiveClientOrgId(ORG);
    expect(window.sessionStorage.getItem(ACTIVE_CLIENT_ORG_STORAGE_KEY)).toBe(ORG);
  });

  it("dispatches the cross-store URL sync event so the admin realm store rehydrates", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    setActiveClientOrgId(ORG);
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).toContain(CLIENT_ORG_URL_SYNC_EVENT);
    dispatchSpy.mockRestore();
  });

  it("does NOT dispatch legacy ACTIVE/ADMIN client-org events (removed in #173 Sub-PR B)", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    setActiveClientOrgId(ORG);
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).not.toContain(LEGACY_ACTIVE_EVENT);
    expect(types).not.toContain(LEGACY_ADMIN_EVENT);
    dispatchSpy.mockRestore();
  });

  it("propagates state to the admin realm store via the URL-sync event", () => {
    setActiveClientOrgId(ORG);
    expect(useAdminRealmStore.getState().id).toBe(ORG);
  });

  it("clears URL + storage when called with null", () => {
    setActiveClientOrgId(ORG);
    setActiveClientOrgId(null);
    expect(new URLSearchParams(window.location.search).get(ACTIVE_CLIENT_ORG_QUERY_PARAM)).toBeNull();
    expect(window.sessionStorage.getItem(ACTIVE_CLIENT_ORG_STORAGE_KEY)).toBeNull();
  });
});

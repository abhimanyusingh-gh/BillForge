/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import {
  useAdminClientOrgFilter,
  ADMIN_CLIENT_ORG_QUERY_PARAM
} from "@/hooks/useAdminClientOrgFilter";
import { CLIENT_ORG_URL_SYNC_EVENT } from "@/stores/activeRealmStore";
import { useActiveRealmStore } from "@/stores/activeRealmStore";
import { resetStores } from "@/test-utils/resetStores";

const ORG_VALID = "65a1b2c3d4e5f6a7b8c9d0e1";
const LEGACY_ADMIN_EVENT = "ledgerbuddy:admin-client-org-filter-change";

function urlValue(): string | null {
  return new URLSearchParams(window.location.search).get(ADMIN_CLIENT_ORG_QUERY_PARAM);
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.sessionStorage.clear();
  resetStores();
});

describe("useAdminClientOrgFilter", () => {
  it("returns null when URL has no clientOrgId param", () => {
    const { result } = renderHook(() => useAdminClientOrgFilter());
    expect(result.current.clientOrgId).toBeNull();
  });

  it("reads a valid ObjectId from the URL on mount", () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG_VALID}`);
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    const { result } = renderHook(() => useAdminClientOrgFilter());
    expect(result.current.clientOrgId).toBe(ORG_VALID);
  });

  it("rejects invalid (non-ObjectId) URL values and returns null", () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=garbage`);
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    const { result } = renderHook(() => useAdminClientOrgFilter());
    expect(result.current.clientOrgId).toBeNull();
  });

  it("setClientOrgId(id) writes the param to the URL", () => {
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(ORG_VALID));
    expect(urlValue()).toBe(ORG_VALID);
    expect(result.current.clientOrgId).toBe(ORG_VALID);
  });

  it("setClientOrgId(null) deletes the URL param", () => {
    window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG_VALID}`);
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(null));
    expect(urlValue()).toBeNull();
    expect(result.current.clientOrgId).toBeNull();
  });

  it("preserves other URL query params when writing", () => {
    window.history.replaceState({}, "", "/?tab=overview&foo=bar");
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(ORG_VALID));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("overview");
    expect(params.get("foo")).toBe("bar");
    expect(params.get(ADMIN_CLIENT_ORG_QUERY_PARAM)).toBe(ORG_VALID);
  });

  it("dispatches the cross-store URL sync event so the active realm store rehydrates", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(ORG_VALID));
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).toContain(CLIENT_ORG_URL_SYNC_EVENT);
    dispatchSpy.mockRestore();
  });

  it("does NOT dispatch the legacy ADMIN_CLIENT_ORG_CHANGE_EVENT (removed in #173 Sub-PR B)", () => {
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(ORG_VALID));
    const types = dispatchSpy.mock.calls.map((call) => (call[0] as Event).type);
    expect(types).not.toContain(LEGACY_ADMIN_EVENT);
    dispatchSpy.mockRestore();
  });

  it("propagates state to the active realm store via the URL-sync event", () => {
    const { result } = renderHook(() => useAdminClientOrgFilter());
    act(() => result.current.setClientOrgId(ORG_VALID));
    expect(useActiveRealmStore.getState().id).toBe(ORG_VALID);
  });

  it("reacts to popstate events (browser back/forward navigation)", () => {
    const { result } = renderHook(() => useAdminClientOrgFilter());
    expect(result.current.clientOrgId).toBeNull();
    act(() => {
      window.history.replaceState({}, "", `/?${ADMIN_CLIENT_ORG_QUERY_PARAM}=${ORG_VALID}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.clientOrgId).toBe(ORG_VALID);
  });
});

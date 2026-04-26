/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import {
  useTenantSetupCompleted,
  writeTenantSetupCompleted,
  TENANT_SETUP_COMPLETED_STORAGE_KEY
} from "@/hooks/useTenantSetupCompleted";

jest.mock("@/api/client", () => ({
  clearStoredSessionToken: () => {
    window.localStorage.removeItem("ledgerbuddy_session_token");
    window.sessionStorage.removeItem("activeTenantId");
    window.sessionStorage.removeItem("tenantSetupCompleted");
  }
}));

import { clearStoredSessionToken } from "@/api/client";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("hooks/useTenantSetupCompleted — logout-clears-flag (#193 bot review case c)", () => {
  it("clearStoredSessionToken wipes the flag so the next mount stays gated until /session re-writes it", () => {
    writeTenantSetupCompleted(true);
    expect(window.sessionStorage.getItem(TENANT_SETUP_COMPLETED_STORAGE_KEY)).toBe("true");

    clearStoredSessionToken();

    expect(window.sessionStorage.getItem(TENANT_SETUP_COMPLETED_STORAGE_KEY)).toBeNull();
    const { result } = renderHook(() => useTenantSetupCompleted());
    expect(result.current).toBe(false);
  });
});

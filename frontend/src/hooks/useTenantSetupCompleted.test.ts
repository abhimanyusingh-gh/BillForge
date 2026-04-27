/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import {
  useTenantSetupCompleted,
  writeTenantSetupCompleted,
  TENANT_SETUP_COMPLETED_STORAGE_KEY
} from "@/hooks/useTenantSetupCompleted";
import { resetStores } from "@/test-utils/resetStores";

jest.mock("@/api/client", () => {
  const { useAuthStore } = jest.requireActual("@/stores/authStore");
  return {
    clearStoredSessionToken: () => {
      window.localStorage.removeItem("ledgerbuddy_session_token");
      useAuthStore.getState().clearAuth();
    }
  };
});

import { clearStoredSessionToken } from "@/api/client";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetStores();
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

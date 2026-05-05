import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChangePassword } from "@/features/auth/change-password/useChangePassword";
import { useSessionStore } from "@/state/sessionStore";
import { asTenantId, asUserId } from "@/types/ids";

const changePasswordMock = vi.fn();

vi.mock("@/api/authService", () => ({
  authService: {
    login: vi.fn(),
    fetchSession: vi.fn(),
    changePassword: (...args: unknown[]) => changePasswordMock(...args)
  }
}));

function seedAuthenticatedSession() {
  act(() => {
    useSessionStore.setState({
      user: { id: asUserId("u1"), email: "u@x.in", role: "OWNER" },
      tenant: { id: asTenantId("t1"), name: "Acme" },
      flags: { mustChangePassword: true, requiresTenantSetup: false },
      accessToken: "tok"
    });
  });
}

beforeEach(() => {
  changePasswordMock.mockReset();
  act(() => {
    useSessionStore.getState().clearSession();
  });
  window.location.hash = "";
});

afterEach(() => {
  act(() => {
    useSessionStore.getState().clearSession();
  });
});

describe("useChangePassword", () => {
  it("blocks submit until the form is valid", async () => {
    seedAuthenticatedSession();
    const { result } = renderHook(() => useChangePassword());

    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      await result.current.submit();
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("submits to the service, clears the must-change flag, and routes home on success", async () => {
    seedAuthenticatedSession();
    changePasswordMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useChangePassword());

    act(() => {
      result.current.setField("currentPassword", "OldPass!1");
      result.current.setField("newPassword", "NewStrong1!");
      result.current.setField("confirmPassword", "NewStrong1!");
    });

    await waitFor(() => expect(result.current.canSubmit).toBe(true));

    await act(async () => {
      await result.current.submit();
    });

    expect(changePasswordMock).toHaveBeenCalledWith({
      currentPassword: "OldPass!1",
      newPassword: "NewStrong1!"
    });
    expect(useSessionStore.getState().flags.mustChangePassword).toBe(false);
    expect(window.location.hash).toBe("#/");
  });

  it("surfaces backend errors without changing session state", async () => {
    seedAuthenticatedSession();
    changePasswordMock.mockRejectedValueOnce(new Error("Wrong current password"));

    const { result } = renderHook(() => useChangePassword());

    act(() => {
      result.current.setField("currentPassword", "OldPass!1");
      result.current.setField("newPassword", "NewStrong1!");
      result.current.setField("confirmPassword", "NewStrong1!");
    });

    await waitFor(() => expect(result.current.canSubmit).toBe(true));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.error).toBe("Wrong current password");
    expect(useSessionStore.getState().flags.mustChangePassword).toBe(true);
  });
});

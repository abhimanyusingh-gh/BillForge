import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AvatarMenu } from "@/features/chrome/topnav/AvatarMenu";
import { useSessionStore } from "@/state/sessionStore";
import { asTenantId, asUserId } from "@/types/ids";

function seedSession() {
  act(() => {
    useSessionStore.setState({
      user: { id: asUserId("u1"), email: "reena@khan-ca.in", role: "OWNER" },
      tenant: { id: asTenantId("t1"), name: "Khan & Associates" },
      flags: { mustChangePassword: false, requiresTenantSetup: false },
      accessToken: "tok"
    });
  });
}

beforeEach(() => {
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

describe("AvatarMenu", () => {
  it("opens the menu and shows the signed-in identity", () => {
    seedSession();
    render(<AvatarMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByText("reena@khan-ca.in")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
  });

  it("updates the persisted theme when a swatch is selected", () => {
    seedSession();
    render(<AvatarMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dark/ }));
    expect(useSessionStore.getState().theme).toBe("dark");
  });

  it("navigates to change-password and closes when Update password is clicked", () => {
    seedSession();
    render(<AvatarMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Update password/ }));
    expect(window.location.hash).toBe("#/change-password");
  });

  it("disables the post-MVP settings entries", () => {
    seedSession();
    render(<AvatarMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByRole("button", { name: /Edit profile/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Two-factor auth/ })).toBeDisabled();
  });

  it("clears the session and routes to login on sign out", () => {
    seedSession();
    render(<AvatarMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Account menu/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
    expect(window.location.hash).toBe("#/login");
  });
});

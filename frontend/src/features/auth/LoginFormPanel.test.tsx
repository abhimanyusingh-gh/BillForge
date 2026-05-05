import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginFormPanel } from "@/features/auth/LoginFormPanel";

describe("LoginFormPanel", () => {
  function renderPanel(overrides: Partial<Parameters<typeof LoginFormPanel>[0]> = {}) {
    const onEmailChange = vi.fn();
    const onPasswordChange = vi.fn();
    const onSubmit = vi.fn();
    const props = {
      email: "",
      password: "",
      submitting: false,
      error: null,
      onEmailChange,
      onPasswordChange,
      onSubmit,
      ...overrides
    };
    render(<LoginFormPanel {...props} />);
    return { onEmailChange, onPasswordChange, onSubmit };
  }

  it("renders the welcome heading and inputs", () => {
    renderPanel();
    expect(screen.getByText("Sign in to LedgerBuddy")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeEnabled();
  });

  it("propagates email and password changes via callbacks", () => {
    const { onEmailChange, onPasswordChange } = renderPanel();
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "user@firm.in" }
    });
    expect(onEmailChange).toHaveBeenCalledWith("user@firm.in");
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" }
    });
    expect(onPasswordChange).toHaveBeenCalledWith("secret");
  });

  it("submits the form when the user clicks Sign in", () => {
    const { onSubmit } = renderPanel({ email: "u@x.in", password: "pw" });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows an alert and disables Submit while submitting", () => {
    renderPanel({ submitting: true, error: "Invalid email or password." });
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("toggles password visibility", () => {
    renderPanel({ password: "secret" });
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(password.type).toBe("text");
  });
});

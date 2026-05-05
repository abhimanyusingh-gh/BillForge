import { describe, expect, it } from "vitest";
import {
  evaluateChangePassword,
  passwordStrengthLabel,
  passwordStrengthScore,
  passwordStrengthTone
} from "@/domain/auth/passwordPolicy";

describe("passwordPolicy", () => {
  it("guides a user from empty form through weak + mismatch to a strong, acceptable password", () => {
    const empty = evaluateChangePassword({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    expect(passwordStrengthScore("")).toBe(0);
    expect(empty.strength).toBe(0);
    expect(empty.label).toBe("Too short");
    expect(empty.tone).toBe("weak");
    expect(empty.showMismatch).toBe(false);
    expect(empty.isAcceptable).toBe(false);

    const weakNoConfirm = evaluateChangePassword({
      currentPassword: "DemoPass!1",
      newPassword: "abc",
      confirmPassword: ""
    });
    expect(weakNoConfirm.strength).toBe(passwordStrengthScore("abc"));
    expect(weakNoConfirm.label).toBe(passwordStrengthLabel(weakNoConfirm.strength));
    expect(weakNoConfirm.tone).toBe(passwordStrengthTone(weakNoConfirm.strength));
    expect(weakNoConfirm.tone).toBe("weak");
    expect(weakNoConfirm.showMismatch).toBe(false);
    expect(weakNoConfirm.isAcceptable).toBe(false);

    const mismatch = evaluateChangePassword({
      currentPassword: "DemoPass!1",
      newPassword: "abc",
      confirmPassword: "ab"
    });
    expect(mismatch.matches).toBe(false);
    expect(mismatch.showMismatch).toBe(true);
    expect(mismatch.isAcceptable).toBe(false);

    const strongNoCurrent = evaluateChangePassword({
      currentPassword: "",
      newPassword: "Sup3rStr0ng!Pass",
      confirmPassword: "Sup3rStr0ng!Pass"
    });
    expect(strongNoCurrent.tone).toBe("strong");
    expect(strongNoCurrent.matches).toBe(true);
    expect(strongNoCurrent.isAcceptable).toBe(false);

    const accepted = evaluateChangePassword({
      currentPassword: "DemoPass!1",
      newPassword: "Sup3rStr0ng!Pass",
      confirmPassword: "Sup3rStr0ng!Pass"
    });
    expect(accepted.strength).toBe(5);
    expect(accepted.label).toBe("Excellent");
    expect(accepted.tone).toBe("strong");
    expect(accepted.matches).toBe(true);
    expect(accepted.showMismatch).toBe(false);
    expect(accepted.isAcceptable).toBe(true);

    expect(passwordStrengthLabel(99)).toBe("Excellent");
  });
});

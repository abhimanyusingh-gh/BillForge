import { describe, expect, it } from "vitest";
import {
  evaluateChangePassword,
  passwordStrengthLabel,
  passwordStrengthScore,
  passwordStrengthTone
} from "@/domain/auth/passwordPolicy";

describe("passwordStrengthScore", () => {
  it("scores zero for an empty string", () => {
    expect(passwordStrengthScore("")).toBe(0);
  });

  it("rewards length, casing, digits, and symbols additively", () => {
    expect(passwordStrengthScore("aaaaaaaaaa")).toBe(2);
    expect(passwordStrengthScore("Aaaaaaaaaa")).toBe(3);
    expect(passwordStrengthScore("Aaaaaaaaa1")).toBe(4);
    expect(passwordStrengthScore("Aaaaaaaa1!")).toBe(5);
  });
});

describe("passwordStrengthLabel", () => {
  it("maps scores to human-readable labels with clamping", () => {
    expect(passwordStrengthLabel(0)).toBe("Too short");
    expect(passwordStrengthLabel(3)).toBe("Good");
    expect(passwordStrengthLabel(5)).toBe("Excellent");
    expect(passwordStrengthLabel(99)).toBe("Excellent");
  });
});

describe("passwordStrengthTone", () => {
  it("buckets scores into weak/fair/strong tones", () => {
    expect(passwordStrengthTone(0)).toBe("weak");
    expect(passwordStrengthTone(1)).toBe("weak");
    expect(passwordStrengthTone(2)).toBe("fair");
    expect(passwordStrengthTone(3)).toBe("fair");
    expect(passwordStrengthTone(4)).toBe("strong");
    expect(passwordStrengthTone(5)).toBe("strong");
  });
});

describe("evaluateChangePassword", () => {
  it("rejects submissions when the new password is too weak", () => {
    const result = evaluateChangePassword({
      currentPassword: "old",
      newPassword: "weak",
      confirmPassword: "weak"
    });
    expect(result.matches).toBe(true);
    expect(result.isAcceptable).toBe(false);
  });

  it("flags mismatched confirmation only after the user starts typing in confirm", () => {
    const empty = evaluateChangePassword({
      currentPassword: "old",
      newPassword: "Aaaaaaaa1!",
      confirmPassword: ""
    });
    expect(empty.showMismatch).toBe(false);
    expect(empty.isAcceptable).toBe(false);

    const mismatch = evaluateChangePassword({
      currentPassword: "old",
      newPassword: "Aaaaaaaa1!",
      confirmPassword: "different"
    });
    expect(mismatch.showMismatch).toBe(true);
    expect(mismatch.isAcceptable).toBe(false);
  });

  it("accepts a strong matching password with a current password", () => {
    const result = evaluateChangePassword({
      currentPassword: "OldPass!1",
      newPassword: "NewStrong1!",
      confirmPassword: "NewStrong1!"
    });
    expect(result.isAcceptable).toBe(true);
    expect(result.tone).toBe("strong");
    expect(result.label).toBe("Excellent");
  });

  it("rejects when current password is empty even if new password is strong", () => {
    const result = evaluateChangePassword({
      currentPassword: "",
      newPassword: "NewStrong1!",
      confirmPassword: "NewStrong1!"
    });
    expect(result.isAcceptable).toBe(false);
  });
});

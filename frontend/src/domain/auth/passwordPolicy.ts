const PASSWORD_STRENGTH_LABELS = [
  "Too short",
  "Weak",
  "Fair",
  "Good",
  "Strong",
  "Excellent"
] as const;

type PasswordStrengthLabel = (typeof PASSWORD_STRENGTH_LABELS)[number];

const MIN_PASSWORD_STRENGTH_TO_SUBMIT = 3;
const MIN_PASSWORD_LENGTH = 10;

export function passwordStrengthScore(value: string): number {
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export function passwordStrengthLabel(score: number): PasswordStrengthLabel {
  const clamped = Math.max(0, Math.min(score, PASSWORD_STRENGTH_LABELS.length - 1));
  return PASSWORD_STRENGTH_LABELS[clamped];
}

type PasswordStrengthTone = "weak" | "fair" | "strong";

export function passwordStrengthTone(score: number): PasswordStrengthTone {
  if (score <= 1) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordValidation {
  strength: number;
  label: PasswordStrengthLabel;
  tone: PasswordStrengthTone;
  matches: boolean;
  showMismatch: boolean;
  isAcceptable: boolean;
}

export function evaluateChangePassword(input: ChangePasswordInput): ChangePasswordValidation {
  const strength = passwordStrengthScore(input.newPassword);
  const matches = input.newPassword.length > 0 && input.newPassword === input.confirmPassword;
  const showMismatch = input.confirmPassword.length > 0 && !matches;
  const isAcceptable =
    matches &&
    strength >= MIN_PASSWORD_STRENGTH_TO_SUBMIT &&
    input.currentPassword.length > 0;

  return {
    strength,
    label: passwordStrengthLabel(strength),
    tone: passwordStrengthTone(strength),
    matches,
    showMismatch,
    isAcceptable
  };
}

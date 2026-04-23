import { tokens } from "./tokens";

export const SPINNER_SIZE = {
  sm: 14,
  md: 20,
  lg: 32
} as const;

export type SpinnerSize = keyof typeof SPINNER_SIZE;

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ size = "md", label = "Loading" }: SpinnerProps) {
  const px = SPINNER_SIZE[size];
  return (
    <span
      role="status"
      aria-label={label}
      aria-live="polite"
      style={{
        display: "inline-block",
        width: px,
        height: px,
        border: `2px solid ${tokens.color.line}`,
        borderTopColor: tokens.color.accent.base,
        borderRadius: "999px",
        animation: "spin 0.7s linear infinite"
      }}
    />
  );
}

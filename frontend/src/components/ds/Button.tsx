import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const BUTTON_VARIANT = {
  primary: "primary",
  secondary: "secondary",
  destructive: "destructive",
  ghost: "ghost"
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT;

export const BUTTON_SIZE = {
  sm: "sm",
  md: "md"
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZE;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "app-button-primary",
  secondary: "app-button-secondary",
  destructive: "app-button-primary",
  ghost: "app-button-secondary"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    disabled,
    className,
    children,
    type,
    style,
    ...rest
  },
  ref
) {
  const classes = [
    "app-button",
    VARIANT_CLASS[variant],
    size === "sm" ? "app-button-sm" : null,
    loading ? "app-button-loading" : null,
    className ?? null
  ]
    .filter(Boolean)
    .join(" ");

  const destructiveStyle =
    variant === "destructive"
      ? { background: "var(--warn)", borderColor: "var(--warn)", ...style }
      : variant === "ghost"
      ? { background: "transparent", ...style }
      : style;

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={destructiveStyle}
      {...rest}
    >
      {icon ? (
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
});

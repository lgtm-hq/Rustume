import { Button as KobalteButton } from "@kobalte/core/button";
import { splitProps, type ParentComponent } from "solid-js";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  class?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export const Button: ParentComponent<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "variant",
    "size",
    "disabled",
    "loading",
    "class",
    "children",
  ]);

  const variant = () => local.variant || "primary";
  const size = () => local.size || "md";

  const baseClasses =
    "inline-flex items-center justify-center font-body font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    primary: "bg-ink text-paper hover:bg-ink/90 active:bg-ink/80 shadow-soft",
    secondary: "bg-surface text-ink border border-border hover:bg-border/50 active:bg-border",
    ghost: "text-ink hover:bg-surface active:bg-border",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-soft",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm rounded-md gap-1.5",
    md: "px-4 py-2 text-sm rounded-lg gap-2",
    lg: "px-6 py-3 text-base rounded-lg gap-2",
  };

  return (
    <KobalteButton
      class={`${baseClasses} ${variantClasses[variant()]} ${sizeClasses[size()]} ${local.class || ""}`}
      disabled={local.disabled || local.loading}
      {...others}
    >
      {local.loading && (
        <svg
          class="animate-spin -ml-1 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {local.children}
    </KobalteButton>
  );
};

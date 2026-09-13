import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:text-slate-900",
  danger: "border border-red-200 text-red-600 hover:bg-red-50",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

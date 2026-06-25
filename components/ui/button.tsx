import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-orange-500 via-orange-400 to-purple-600 hover:scale-105 text-white shadow-[0_0_30px_rgba(255,120,0,.35)]",

  secondary:
    "bg-purple-700 hover:bg-purple-600 text-white",

  outline:
    "border border-white/20 bg-white/5 hover:bg-white/10 text-white",

  default:
    "bg-white/10 hover:bg-white/20 text-white border border-white/10",

  info:
    "bg-blue-600 hover:bg-blue-500 text-white",

  success:
    "bg-emerald-600 hover:bg-emerald-500 text-white",

  warning:
    "bg-amber-500 hover:bg-amber-400 text-black",

  danger:
    "bg-red-600 hover:bg-red-500 text-white",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5",
  lg: "px-7 py-4",
};

export function Button({
  children,
  href,
  variant = "primary",
  size,
  full = false,
  className = "",
  ...props
}: ButtonProps) {

  // No explicit size preserves the original (marketing) padding used by the header.
  const sizeClass = size ? sizeStyles[size] : "px-7 py-4";

  const classes = `
      inline-flex
      items-center
      justify-center
      rounded-xl
      ${sizeClass}
      font-semibold
      transition-all
      duration-300
      ${variantStyles[variant]}
      ${full ? "w-full" : ""}
      ${className}
  `;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;

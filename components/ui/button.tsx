import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "outline";
  full?: boolean;
}

export default function Button({
  children,
  href,
  variant = "primary",
  full = false,
  className = "",
  ...props
}: ButtonProps) {

  const styles = {
    primary:
      "bg-gradient-to-r from-orange-500 via-orange-400 to-purple-600 hover:scale-105 text-white shadow-[0_0_30px_rgba(255,120,0,.35)]",

    secondary:
      "bg-purple-700 hover:bg-purple-600 text-white",

    outline:
      "border border-white/20 bg-white/5 hover:bg-white/10 text-white"
  };

  const classes = `
      inline-flex
      items-center
      justify-center
      rounded-xl
      px-7
      py-4
      font-semibold
      transition-all
      duration-300
      ${styles[variant]}
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
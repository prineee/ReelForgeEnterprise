import { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

// Shadcn-style structural primitives consumed across the dashboard.
export function Card({ children, className = "", hover = false, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`
        rounded-3xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        transition-all
        duration-300
        hover:border-purple-500/40
        ${hover ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(124,58,237,0.18)]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", hover: _hover, ...rest }: Props) {
  return (
    <div {...rest} className={`flex flex-col gap-1.5 p-6 pb-2 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", hover: _hover, ...rest }: Props) {
  return (
    <div {...rest} className={`text-lg font-semibold text-white ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", hover: _hover, ...rest }: Props) {
  return (
    <div {...rest} className={`p-6 pt-2 ${className}`}>
      {children}
    </div>
  );
}

// Original marketing card preserved as the default export (unchanged styling).
export default function MarketingCard({ children, className = "", hover: _hover, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`
        rounded-3xl
        border
        border-white/10
        bg-white/5
        backdrop-blur-xl
        p-8
        transition-all
        duration-300
        hover:border-purple-500/40
        hover:-translate-y-2
        hover:shadow-[0_0_60px_rgba(124,58,237,0.20)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className = "",
}: Props) {
  return (
    <div
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
import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export default function Container({
  children,
  className = "",
}: ContainerProps) {
  return (
    <div
      className={`
        w-full
        max-w-7xl
        mx-auto
        px-5
        sm:px-6
        lg:px-8
        xl:px-10
        ${className}
      `}
    >
      {children}
    </div>
  );
}
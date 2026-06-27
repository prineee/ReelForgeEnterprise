import type { ReactNode } from "react";
import Container from "../shared/Container";
interface Props {
  children: ReactNode;
  className?: string;
}

export default function Section({
  children,
  className = "",
}: Props) {
  return (
    <section
      className={`py-24 relative ${className}`}
    >
      <Container>
        {children}
      </Container>
    </section>
  );
}
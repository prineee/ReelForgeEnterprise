import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { focusRing } from "./tokens";

export type SecondaryButtonProps = Omit<ComponentProps<typeof Button>, "variant">;

/** Secondary action — solid purple. Wraps the shared Button. */
export function SecondaryButton({ className, ...props }: SecondaryButtonProps) {
  return (
    <Button variant="secondary" className={cn(focusRing, className)} {...props} />
  );
}

export default SecondaryButton;

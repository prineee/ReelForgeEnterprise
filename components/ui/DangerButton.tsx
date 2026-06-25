import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { focusRing } from "./tokens";

export type DangerButtonProps = Omit<ComponentProps<typeof Button>, "variant">;

/** Destructive action — solid red. Wraps the shared Button. */
export function DangerButton({ className, ...props }: DangerButtonProps) {
  return (
    <Button variant="danger" className={cn(focusRing, className)} {...props} />
  );
}

export default DangerButton;

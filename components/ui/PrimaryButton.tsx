import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { focusRing } from "./tokens";

export type PrimaryButtonProps = Omit<ComponentProps<typeof Button>, "variant">;

/** Brand primary action — orange→purple gradient. Wraps the shared Button. */
export function PrimaryButton({ className, ...props }: PrimaryButtonProps) {
  return (
    <Button variant="primary" className={cn(focusRing, className)} {...props} />
  );
}

export default PrimaryButton;

import { Tv } from "lucide-react";
import { StudioShowcase } from "./StudioShowcase";

/** Cartoon Studio showcase section. */
export function CartoonStudioShowcase() {
  return (
    <StudioShowcase
      id="cartoon-studio"
      eyebrow="Cartoon Studio"
      title="Animated stories that come alive"
      description="Generate fully animated cartoons with consistent characters, scripted dialogue and scene-to-scene continuity — from a single idea to a finished episode."
      icon={<Tv className="h-3.5 w-3.5" />}
      bullets={[
        "Consistent animated characters",
        "AI-written dialogue & voice casting",
        "Multi-scene story continuity",
        "Ready for YouTube & shorts",
      ]}
      ctaLabel="Open Cartoon Studio"
      ctaHref="/register?plan=pro"
      mediaSide="left"
      accent="bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-600"
    />
  );
}

export default CartoonStudioShowcase;

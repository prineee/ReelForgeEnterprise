import { Clapperboard } from "lucide-react";
import { StudioShowcase } from "./StudioShowcase";

/** Movie Studio showcase section. */
export function MovieStudioShowcase() {
  return (
    <StudioShowcase
      id="movie-studio"
      eyebrow="Movie Studio"
      title="Direct cinematic films, shot by shot"
      description="Describe a scene and our AI handles camera angles, lighting and genre direction. Build full sequences with consistent characters and a coherent story arc."
      icon={<Clapperboard className="h-3.5 w-3.5" />}
      bullets={[
        "Shot-by-shot camera & lighting control",
        "Genre-aware direction and pacing",
        "Character continuity across every scene",
        "Export in 1080p or 4K",
      ]}
      ctaLabel="Open Movie Studio"
      ctaHref="/register?plan=pro"
      mediaSide="right"
    />
  );
}

export default MovieStudioShowcase;

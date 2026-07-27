import Link from "next/link";
import { ChevronLeft, ChevronRight, Clapperboard, GanttChartSquare, LayoutGrid, UserCircle2 } from "lucide-react";
import type { SceneNavigationData } from "@/services/infrastructure/SceneStudioFactory";

export interface SceneNavigationBarProps {
  navigation: SceneNavigationData;
}

/**
 * Module 10 — Previous/Next Scene use the same sceneNumber ordering the
 * rest of Scene Studio already establishes. "Jump to Storyboard" and
 * "Jump to Timeline" both open the movie's real Workspace
 * (app/movie-studio/workspace/[movieId], Storyboard Studio sprint) with
 * this scene selected via its existing `?scene=` convention — Timeline
 * is a tab within that workspace's own tab shell (client-side state, not
 * URL-addressable), so both links honestly point at the one real
 * destination rather than pretending a deep link to a specific tab
 * exists. "Jump to Character" links to Character Studio's real detail
 * page for each character in this scene.
 */
export function SceneNavigationBar({ navigation }: SceneNavigationBarProps) {
  const { movieId, previousSceneId, nextSceneId, characterLinks } = navigation;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
      <NavLink href={previousSceneId ? `/movie-studio/scenes/${previousSceneId}` : undefined} icon={<ChevronLeft className="h-3.5 w-3.5" />} label="Previous Scene" />
      <NavLink href={nextSceneId ? `/movie-studio/scenes/${nextSceneId}` : undefined} icon={<ChevronRight className="h-3.5 w-3.5" />} label="Next Scene" trailing />

      <span className="mx-1 h-4 w-px bg-white/10" />

      <NavLink href={`/movie-studio/workspace/${movieId}`} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Open in Storyboard" />
      <NavLink href={`/movie-studio/workspace/${movieId}`} icon={<GanttChartSquare className="h-3.5 w-3.5" />} label="Open in Timeline" />
      <NavLink href={`/movie-studio/workspace/${movieId}`} icon={<Clapperboard className="h-3.5 w-3.5" />} label="Jump to Workspace" />

      {characterLinks.length > 0 && (
        <>
          <span className="mx-1 h-4 w-px bg-white/10" />
          {characterLinks.map((character) => (
            <NavLink
              key={character.characterId}
              href={`/movie-studio/characters/${character.characterId}`}
              icon={<UserCircle2 className="h-3.5 w-3.5" />}
              label={character.name}
            />
          ))}
        </>
      )}
    </div>
  );
}

function NavLink({ href, icon, label, trailing }: { href?: string; icon: React.ReactNode; label: string; trailing?: boolean }) {
  const className =
    "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5";

  if (!href) {
    return (
      <span className={`${className} cursor-not-allowed opacity-30`}>
        {!trailing && icon}
        {label}
        {trailing && icon}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {!trailing && icon}
      {label}
      {trailing && icon}
    </Link>
  );
}

export default SceneNavigationBar;

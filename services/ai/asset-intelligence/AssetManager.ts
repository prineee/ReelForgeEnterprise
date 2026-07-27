/**
 * AssetManager.ts
 *
 * The facade for this directory, mirroring
 * services/ai/director-engine/AIDirectorEngine.ts's role one layer up.
 * Crucially, catalog() takes an already-computed
 * AIDirectorEngine.AIDirectorPlan as input rather than recomputing any of
 * it — StoryPlan and MovieTimelinePlan are read directly from that plan,
 * never re-derived via new StoryPlanner()/SceneSequencer()/
 * MovieTimelineBuilder() instances. This is what "reuse the AI Director
 * Engine, do not duplicate StoryPlanner/CharacterMemory/Timeline" means
 * concretely: AssetManager composes with the Director Engine's *output*,
 * not its *classes* run a second time.
 *
 * No AI model calls, no media generation, no network access anywhere in
 * this directory.
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { AIDirectorPlan } from "../director-engine/AIDirectorEngine";

import { CharacterLibrary, type CharacterLibraryEntry } from "./CharacterLibrary";
import { LocationLibrary, type LocationLibraryEntry } from "./LocationLibrary";
import { ShotLibrary, type ShotPreset } from "./ShotLibrary";
import { TransitionLibrary, type TransitionPreset } from "./TransitionLibrary";
import { MusicPlanner, type MusicPlan } from "./MusicPlanner";
import { VoicePlanner, type VoicePlan } from "./VoicePlanner";
import { AssetDependencyGraph } from "./AssetDependencyGraph";

export interface AssetCatalog {
  characters: readonly CharacterLibraryEntry[];
  locations: readonly LocationLibraryEntry[];
  shotsUsed: readonly ShotPreset[];
  transitionsUsed: readonly TransitionPreset[];
  musicPlan: MusicPlan;
  voicePlan: VoicePlan;
  dependencyGraph: AssetDependencyGraph;
}

export class AssetManager {
  constructor(
    private readonly characterLibrary: CharacterLibrary = new CharacterLibrary(),
    private readonly locationLibrary: LocationLibrary = new LocationLibrary(),
    private readonly shotLibrary: ShotLibrary = new ShotLibrary(),
    private readonly transitionLibrary: TransitionLibrary = new TransitionLibrary(),
    private readonly musicPlanner: MusicPlanner = new MusicPlanner(),
    private readonly voicePlanner: VoicePlanner = new VoicePlanner()
  ) {}

  /**
   * Catalogs every asset concept for a movie, reusing AIDirectorEngine's
   * already-computed plan (storyPlan/timeline) rather than recomputing
   * them.
   */
  catalog(movie: MovieBlueprint, directorPlan: AIDirectorPlan): AssetCatalog {
    this.characterLibrary.register(movie);
    this.locationLibrary.register(movie);

    const musicPlan = this.musicPlanner.plan(movie, directorPlan.storyPlan, directorPlan.timeline);
    const voicePlan = this.voicePlanner.plan(movie);

    const dependencyGraph = new AssetDependencyGraph();
    dependencyGraph.build(movie);

    const shotsUsed = this.uniqueBy(
      movie.cameraPlans.map((plan) => this.shotLibrary.matchCameraPlan(plan)).filter((preset): preset is ShotPreset => preset !== undefined),
      (preset) => preset.id
    );
    const transitionsUsed = this.uniqueBy(
      movie.cameraPlans.map((plan) => this.transitionLibrary.get(plan.transitionToNext)),
      (preset) => preset.transition
    );

    return {
      characters: this.characterLibrary.list(),
      locations: this.locationLibrary.list(),
      shotsUsed,
      transitionsUsed,
      musicPlan,
      voicePlan,
      dependencyGraph,
    };
  }

  getCharacterLibrary(): CharacterLibrary {
    return this.characterLibrary;
  }

  getLocationLibrary(): LocationLibrary {
    return this.locationLibrary;
  }

  getShotLibrary(): ShotLibrary {
    return this.shotLibrary;
  }

  getTransitionLibrary(): TransitionLibrary {
    return this.transitionLibrary;
  }

  private uniqueBy<T, K>(items: readonly T[], keyFn: (item: T) => K): T[] {
    const seen = new Set<K>();
    const result: T[] = [];
    for (const item of items) {
      const key = keyFn(item);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }
}

/**
 * TransitionLibrary.ts
 *
 * A fixed catalog of guidance for every SceneTransition value
 * (services/ai/director/OutputSchema.ts) — one entry per enum member, so
 * `get()` always succeeds for any real CameraPlan.transitionToNext. Pure
 * lookup data, no AI model calls.
 */

import { SceneTransition } from "../director/OutputSchema";

export interface TransitionPreset {
  transition: SceneTransition;
  name: string;
  guidance: string;
  typicalUseCase: string;
}

const TRANSITION_PRESETS: Readonly<Record<SceneTransition, TransitionPreset>> = {
  [SceneTransition.Cut]: {
    transition: SceneTransition.Cut,
    name: "Cut",
    guidance: "Instantaneous change — use when continuity of action or urgency should be preserved.",
    typicalUseCase: "Standard scene-to-scene progression within the same sequence.",
  },
  [SceneTransition.FadeIn]: {
    transition: SceneTransition.FadeIn,
    name: "Fade In",
    guidance: "Gradual rise from black — signals the start of a new sequence or the passage of significant time.",
    typicalUseCase: "Opening a movie or a new act.",
  },
  [SceneTransition.FadeOut]: {
    transition: SceneTransition.FadeOut,
    name: "Fade Out",
    guidance: "Gradual fall to black — signals closure or a significant time jump ahead.",
    typicalUseCase: "Ending a movie, act, or emotionally conclusive beat.",
  },
  [SceneTransition.Dissolve]: {
    transition: SceneTransition.Dissolve,
    name: "Dissolve",
    guidance: "One image gradually blends into the next — softens a location or time change.",
    typicalUseCase: "Moving between related locations or a moderate time skip.",
  },
  [SceneTransition.Wipe]: {
    transition: SceneTransition.Wipe,
    name: "Wipe",
    guidance: "One shot visually pushes the other off-frame — a stylized, energetic transition.",
    typicalUseCase: "Stylistic sequences, montages.",
  },
  [SceneTransition.MatchCut]: {
    transition: SceneTransition.MatchCut,
    name: "Match Cut",
    guidance: "Cuts between two visually/thematically similar compositions — draws an explicit parallel.",
    typicalUseCase: "Thematic connections across time or characters.",
  },
  [SceneTransition.JumpCut]: {
    transition: SceneTransition.JumpCut,
    name: "Jump Cut",
    guidance: "An abrupt, intentionally jarring cut within continuous action — signals disorientation or compressed time.",
    typicalUseCase: "Tension, urgency, stylistic disruption.",
  },
  [SceneTransition.None]: {
    transition: SceneTransition.None,
    name: "None",
    guidance: "No transition declared — flagged elsewhere (see SceneContinuityEngine.ts's ENVIRONMENT_JUMP check) when it precedes a location change.",
    typicalUseCase: "Placeholder — should generally be replaced with an explicit transition before final rendering.",
  },
};

export class TransitionLibrary {
  get(transition: SceneTransition): TransitionPreset {
    return TRANSITION_PRESETS[transition];
  }

  list(): readonly TransitionPreset[] {
    return Object.values(TRANSITION_PRESETS);
  }
}

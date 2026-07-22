import { LockedCharacter } from "./CharacterLockEngine";

export interface SceneInput {
  scene_number: number;
  title: string;
  location: string;
  camera_angle: string;
  visual_prompt: string;
  voiceover: string;
  duration_seconds: number;
}

export interface ScenePromptResult {
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
}

export class ScenePromptBuilder {
  static build(
    scene: SceneInput,
    character: LockedCharacter
  ): ScenePromptResult {

    const imagePrompt = `
Movie Scene ${scene.scene_number}

Scene Title:
${scene.title}

Location:
${scene.location}

Character:
${character.masterPrompt}

Camera:
${scene.camera_angle}

Scene Description:
${scene.visual_prompt}

Requirements:

- Same actor identity
- Same face
- Same hairstyle
- Same wardrobe
- Same body proportions
- Cinematic composition
- Hollywood lighting
- Ultra realistic
- High dynamic range
- 8K
- Professional color grading
- Production quality
`;

    const videoPrompt = `
Animate this cinematic scene.

Duration:
${scene.duration_seconds} seconds

Character:
${character.masterPrompt}

Scene:
${scene.visual_prompt}

Camera Movement:

Maintain ${scene.camera_angle}

Natural movement.

Realistic facial expressions.

Natural body movement.

Hollywood cinematography.

Keep character identity perfectly consistent.

No sudden appearance changes.
`;

    return {
      imagePrompt,
      videoPrompt,
      negativePrompt: character.negativePrompt,
    };
  }
}
import { LockedCharacter } from "./CharacterLockEngine";

export interface ReferenceImage {
  prompt: string;
  negativePrompt: string;
  aspectRatio: "1:1";
}

export class ReferenceImageBuilder {
  static build(
    character: LockedCharacter
  ): ReferenceImage {
    const prompt = `
Professional character reference sheet.

Character:
${character.masterPrompt}

Requirements:

- Full body
- Front facing
- Neutral pose
- Looking directly at camera
- White studio background
- Soft cinematic lighting
- Highly detailed face
- Natural skin texture
- Realistic proportions
- Symmetrical face
- Ultra realistic
- 8K quality
- Character turnaround reference
- Production reference image

This image will be used as the permanent identity for all future movie scenes.
`;

    return {
      prompt,

      negativePrompt:
        character.negativePrompt,

      aspectRatio: "1:1",
    };
  }
}
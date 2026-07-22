export interface CharacterProfile {
  id?: string;

  name: string;

  age?: string;

  gender?: string;

  appearance?: string;

  personality?: string;

  style?: string;

  wardrobe?: string;

  voice?: string;
}

export interface LockedCharacter {
  id: string;

  name: string;

  masterPrompt: string;

  referencePrompt: string;

  negativePrompt: string;

  consistencySeed: number;
}

export class CharacterLockEngine {

  static build(
    character: CharacterProfile
  ): LockedCharacter {

    const masterPrompt = [
      `${character.name}`,
      character.age
        ? `${character.age} years old`
        : "",

      character.gender ?? "",

      character.appearance ?? "",

      character.personality ?? "",

      character.style ?? "",

      character.wardrobe ?? "",

      "same face",

      "same hairstyle",

      "same body proportions",

      "same clothing",

      "same colors",

      "same identity",

      "cinematic lighting",

      "ultra realistic",

      "8k",

      "high detail",

      "movie quality"
    ]
      .filter(Boolean)
      .join(", ");

    const referencePrompt = [
      character.name,

      "front portrait",

      "neutral expression",

      "looking at camera",

      "full facial details",

      "consistent identity",

      "reference image",

      "photorealistic",

      "high quality"
    ].join(", ");

    const negativePrompt = [
      "different face",

      "different hairstyle",

      "different clothes",

      "extra fingers",

      "multiple people",

      "duplicate face",

      "deformed",

      "cropped",

      "low quality",

      "blurry",

      "cartoon",

      "anime"
    ].join(", ");

    return {

      id:
        character.id ??
        crypto.randomUUID(),

      name:
        character.name,

      masterPrompt,

      referencePrompt,

      negativePrompt,

      consistencySeed:
        Math.floor(
          Math.random() *
            100000000
        ),
    };
  }
}
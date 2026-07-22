import { generateReferenceImage } from "@/services/ai/gemini";

export interface CharacterReference {
  name: string;
  image: unknown;
}

export class CharacterReferenceGenerator {
  static async generate(characters: any[]) {
    const results: CharacterReference[] = [];

    for (const character of characters) {
      const prompt = `
Ultra realistic cinematic character.

Name: ${character.name}

Age: ${character.age}

Gender: ${character.gender}

Appearance:
${character.appearance}

Hollywood movie quality.

Consistent face.

Neutral pose.

White background.
`;

      const image =
        await generateReferenceImage(prompt);

      results.push({
        name: character.name,
        image,
      });
    }

    return results;
  }
}
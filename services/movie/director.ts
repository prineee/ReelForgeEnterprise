import { generateMovieBible } from "@/services/ai/gemini";
import { buildDirectorPrompt } from "./directorPrompt";

export interface CharacterProfile {
  name: string;
  age?: string;
  gender?: string;
  appearance?: string;
  personality?: string;
}

export interface DirectorInput {
  title: string;
  genre: string;
  plot: string;
  duration: number;
  style: string;
  language?: string;
  audience?: string;
  ending?: string;
  mood?: string;
  characters: CharacterProfile[];
}

export interface DirectorResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class MovieDirector {
  static async generate(
    input: DirectorInput
  ): Promise<DirectorResult> {
    try {
      if (!input.title.trim()) {
        return {
          success: false,
          error: "Movie title is required.",
        };
      }

      if (!input.plot.trim()) {
        return {
          success: false,
          error: "Movie plot is required.",
        };
      }

      const prompt = buildDirectorPrompt({
        title: input.title,
        genre: input.genre,
        plot: input.plot,
        duration: input.duration,
        style: input.style,
        language: input.language,
        audience: input.audience,
        ending: input.ending,
        mood: input.mood,
        characters: input.characters,
      });

      const movie = await generateMovieBible(prompt);

      if (!movie) {
        return {
          success: false,
          error: "Gemini returned empty response.",
        };
      }

      return {
        success: true,
        data: movie,
      };
    } catch (error) {
      console.error(
        "MovieDirector Error:",
        error
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Movie generation failed.",
      };
    }
  }
}
import { CharacterLockEngine } from "./CharacterLockEngine";
import { MovieAssembler } from "./MovieAssembler";
import { OperationPoller } from "./OperationPoller";
import { SceneQueueManager } from "./SceneQueueManager";
import { CharacterReferenceGenerator } from "./CharacterReferenceGenerator";
import { ReferenceImageBuilder } from "./ReferenceImageBuilder";
import { GeminiSceneDirector } from "./GeminiSceneDirector";
import type { SceneInput } from "./ScenePromptBuilder";

export interface MovieCharacter {
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

export interface MoviePipelineInput {
  title: string;
  scenes: SceneInput[];
  characters: MovieCharacter[];
}

export interface RenderedScene {
  sceneNumber: number;
  operationId: string;
  imagePrompt: string;
  videoPrompt: string;
}

export interface MoviePipelineResult {
  success: boolean;
  referencePrompt: string;
  scenes: RenderedScene[];
  error?: string;
}

export class MovieRenderPipeline {
  static async render(
    movie: MoviePipelineInput
  ): Promise<MoviePipelineResult> {
    try {
      if (!movie.characters.length) {
        return {
          success: false,
          referencePrompt: "",
          scenes: [],
          error: "Movie requires at least one character.",
        };
      }

      // Generate AI reference images for every character
const references =
  await CharacterReferenceGenerator.generate(
    movie.characters
  );

console.log(
  "Character References Generated:",
  references.length
);

// Lock the main character identity
const lockedCharacter =
  CharacterLockEngine.build(
    movie.characters[0]
  );

// Build the master reference prompt
const reference =
  ReferenceImageBuilder.build(
    lockedCharacter
  );

const renderedScenes: RenderedScene[] = [];
       const queue = new SceneQueueManager();

      for (const scene of movie.scenes) {
        const result =
          await GeminiSceneDirector.generate(
            scene,
            lockedCharacter
          );
          queue.add(
  scene.scene_number,
  result.operationId
);

queue.start(
  scene.scene_number
);
const completed =
  await OperationPoller.wait(
    result.operationId
  );

       renderedScenes.push({
  sceneNumber: scene.scene_number,
  operationId: completed.operationId,
  imagePrompt: result.imagePrompt,
  videoPrompt: result.videoPrompt,
});
        queue.complete(
  scene.scene_number
);

        console.log(
          `Scene ${scene.scene_number} submitted.`
        );
      }
console.log(
  "Queue Summary:",
  queue.getAll()
);

console.log(
  `Completed ${queue.completedCount()} of ${movie.scenes.length} scenes`
);
const completedScenes = renderedScenes.map((scene) => ({
  sceneNumber: scene.sceneNumber,

  // Placeholder until Railway Worker returns
  // the actual Cloudinary URL.
  videoUrl: "",
}));

const movieResult =
  await MovieAssembler.assemble(
    completedScenes
  );

if (!movieResult.success) {
  return {
    success: false,
    referencePrompt: reference.prompt,
    scenes: renderedScenes,
    error: movieResult.error,
  };
}
      return {
        success: true,
        referencePrompt:
          reference.prompt,
        scenes: renderedScenes,
      };
    } catch (error) {
      console.error(
        "MovieRenderPipeline:",
        error
      );

      return {
        success: false,
        referencePrompt: "",
        scenes: [],
        error:
          error instanceof Error
            ? error.message
            : "Unknown pipeline error.",
      };
    }
  }
}
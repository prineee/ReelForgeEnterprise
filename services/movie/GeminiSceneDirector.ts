import { generateSceneVideo } from "@/services/ai/gemini";
import { LockedCharacter } from "./CharacterLockEngine";
import {
  SceneInput,
  ScenePromptBuilder,
} from "./ScenePromptBuilder";

export interface GeneratedScene {
  imagePrompt: string;
  videoPrompt: string;
  operationId?: string;
}

export class GeminiSceneDirector {
  static async generate(
    scene: SceneInput,
    character: LockedCharacter
  ): Promise<GeneratedScene> {

    const prompts =
      ScenePromptBuilder.build(
        scene,
        character
      );

    const operation =
      await generateSceneVideo({
        prompt:
          prompts.videoPrompt,

        negativePrompt:
          prompts.negativePrompt,

        duration:
          scene.duration_seconds,
      });

    return {

      imagePrompt:
        prompts.imagePrompt,

      videoPrompt:
        prompts.videoPrompt,

      operationId:
        operation.operationId,
    };
  }
}
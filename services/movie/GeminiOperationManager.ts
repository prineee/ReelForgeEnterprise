import {
  checkVideoOperation,
} from "@/services/ai/gemini";

export interface SceneOperation {

  sceneNumber: number;

  operationId: string;

}

export interface CompletedScene {

  sceneNumber: number;

  videoUrl: string;

}

export class GeminiOperationManager {

  static async waitForCompletion(

    operations: SceneOperation[]

  ): Promise<CompletedScene[]> {

    const completed: CompletedScene[] = [];

    for (const operation of operations) {

      console.log(
        `Waiting Scene ${operation.sceneNumber}`
      );

      let finished = false;

      while (!finished) {

        const result =
          await checkVideoOperation(
            operation.operationId
          );

        if (result.completed) {

          completed.push({

            sceneNumber:
              operation.sceneNumber,

            videoUrl:
              result.videoUrl,

          });

          finished = true;

        } else {

          await new Promise(
            resolve =>
              setTimeout(resolve, 5000)
          );

        }

      }

    }

    return completed;

  }

}
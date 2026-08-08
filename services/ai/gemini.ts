// @ts-ignore - @google/genai ships a d.ts that TS module resolution flags as "not a module"
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
  apiKey,
});

const GEMINI_REQUEST_TIMEOUT_MS = 30000;

/** Races `promise` against a timeout; rejects with `message` if the timeout wins. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export interface VideoRequest {
  prompt: string;
  negativePrompt?: string;
  duration?: number;
}

export interface VideoOperation {
  operationId: string;
}

export async function generateMovieBible(
  prompt: string
): Promise<string> {

  const response =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await withTimeout<any>(
      ai.models.generateContent({

        model: "gemini-2.5-flash",

        contents: prompt,

      }),
      GEMINI_REQUEST_TIMEOUT_MS,
      "Gemini request timeout"
    );

  return response.text ?? "";

}

export async function generateReferenceImage(
  prompt: string
) {

  const response =
    await ai.models.generateImages({

      model: "imagen-4.0-generate-001",

      prompt,

    });

  return response;

}

export async function generateSceneVideo(
  request: VideoRequest
): Promise<VideoOperation> {

  console.log("================================");
  console.log("Generating Video using Veo");
  console.log(request.prompt);
  console.log("================================");

  const operation =
    await ai.models.generateVideos({

      model: "veo-3.1-generate-preview",

      prompt: request.prompt,

      config: {

        aspectRatio: "9:16",

        durationSeconds:
          request.duration ?? 8,

        resolution: "720p",

        numberOfVideos: 1,

      },

    });

  return {

    operationId: operation.name,

  };

}

export async function checkVideoOperation(
  operationId: string
) {

  let operation =
    await ai.operations.getVideosOperation({

      operation: Object.assign(new GenerateVideosOperation(), {
        name: operationId,
      }),

    });

  while (!operation.done) {

    await new Promise(resolve =>
      setTimeout(resolve, 5000)
    );

    operation =
      await ai.operations.getVideosOperation({

        operation,

      });

  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = operation.response as any;

  return {

    completed: true,

    operationId,

    videoUrl:
      response.generatedVideos?.[0]?.video?.uri ?? "",

  };

}

export async function downloadVideo(
  url: string
): Promise<Buffer> {

  const response =
    await fetch(url);

  const buffer =
    await response.arrayBuffer();

  return Buffer.from(buffer);

}
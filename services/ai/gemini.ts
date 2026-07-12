import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is missing from your environment variables."
  );
}

export const gemini = new GoogleGenAI({
  apiKey,
});

export interface GenerateOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generateJSON({
  prompt,
  systemInstruction = "",
  temperature = 0.8,
  maxOutputTokens = 8192,
}: GenerateOptions) {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";

    const cleaned = text
      .replace(/^```json/, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini JSON Error:", error);
    throw error;
  }
}

export async function generateText({
  prompt,
  systemInstruction = "",
  temperature = 0.8,
  maxOutputTokens = 8192,
}: GenerateOptions) {
  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens,
      },
    });

    return response.text ?? "";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    throw error;
  }
}

export async function generateMovieBible(prompt: string) {
  return generateJSON({
    prompt,
    systemInstruction: `
You are ReelForge Enterprise AI Director.

You are an Oscar-winning Hollywood film director.

Always respond ONLY with valid JSON.

Never include markdown.

Maintain character consistency.

Maintain camera consistency.

Maintain cinematic storytelling.

Maintain visual continuity.

Return production-ready JSON.
`,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });
}
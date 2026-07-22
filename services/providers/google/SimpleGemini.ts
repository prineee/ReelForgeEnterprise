// @ts-ignore - @google/genai ships a d.ts that TS module resolution flags as "not a module"
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

export async function askGemini(prompt:string){

    const response =
        await ai.models.generateContent({
            model:"gemini-3.5-flash",
            contents:prompt
        });

    return response.text;
}
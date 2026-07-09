import { GoogleGenAI } from "@google/genai";
import { MODEL } from "../config.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Thin adapter so client.js's retry loop can treat every provider the same
// way: call(input, sharedOptions) => Promise<string>. All Gemini-specific
// field mapping (systemInstruction, responseSchema, abortSignal) lives here.
export const geminiProvider = {
  name: "gemini",
  model: MODEL,

  async call(input, { systemInstruction, generationConfig = {}, responseSchema, abortSignal }) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: input,
      config: {
        ...generationConfig,
        ...(systemInstruction && { systemInstruction }),
        ...(responseSchema && {
          responseMimeType: "application/json",
          responseSchema,
        }),
        abortSignal,
      },
    });

    return response.text ?? "";
  },
};
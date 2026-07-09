import { OPENROUTER_MODEL, OPENROUTER_BASE_URL } from "../config.js";

// Only enabled if a key is present — nothing changes for apps that don't set
// OPENROUTER_API_KEY. Presence of the key is what turns fallback on, not a
// separate feature flag, so there's one less thing to misconfigure.
export const isOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);

// Same call(input, sharedOptions) => Promise<string> shape as geminiProvider,
// so client.js's retry loop doesn't need to know which provider it's talking
// to. Translates our shared option shape into OpenAI-compatible chat
// completions, since that's what OpenRouter (and most aggregators) expose.
export const openRouterProvider = {
  name: "openrouter",
  model: OPENROUTER_MODEL,

  async call(input, { systemInstruction, generationConfig = {}, responseSchema, abortSignal }) {
    const messages = [
      ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
      { role: "user", content: input },
    ];

    const body = {
      model: OPENROUTER_MODEL,
      messages,
      ...(generationConfig.temperature !== undefined && {
        temperature: generationConfig.temperature,
      }),
      ...(generationConfig.maxOutputTokens !== undefined && {
        max_tokens: generationConfig.maxOutputTokens,
      }),
      // Best-effort hint — not every free model on OpenRouter honors JSON
      // mode, which is exactly why quizValidation.js still cleans and
      // validates the output defensively regardless of provider.
      ...(responseSchema && { response_format: { type: "json_object" } }),
    };

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: abortSignal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // Identifies the app to OpenRouter; harmless if they ignore it.
        "X-Title": "Study Assistant",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      const error = new Error(`OpenRouter request failed with status ${res.status}`);
      error.status = res.status;
      error.preview = errorBody.slice(0, 300);
      throw error;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },
};
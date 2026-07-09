// ---------------------------------------------------------------------------
// Central configuration. Nothing behavioral lives here — just numbers and
// shapes other modules import, so tuning the service means editing this file
// instead of hunting through logic.
// ---------------------------------------------------------------------------

// Gemini 3.5 Flash is the current GA "workhorse" flash model (it's what
// gemini-flash-latest points to as of mid-2026). It supports structured JSON
// output (responseSchema) natively, which is what createQuiz() relies on.
// gemini-2.5-flash still works and is a safe fallback, but Google's own docs
// and examples have moved to the 3.5 line — check
// https://ai.google.dev/gemini-api/docs/models and the deprecations page
// before shipping, since Gemini model lifecycles move fast.
export const MODEL = "gemini-3.5-flash";

// --- Fallback provider (optional) --------------------------------------------
// If OPENROUTER_API_KEY is set, generate() will fall back to OpenRouter's free
// model router after Gemini exhausts its retries on a quota/upstream/network
// failure. "openrouter/free" auto-selects an available free model rather than
// pinning one — free model IDs on OpenRouter rotate often, so hardcoding a
// specific one (e.g. "meta-llama/llama-3.3-70b-instruct:free") tends to break
// silently when that model is pulled. Override via OPENROUTER_MODEL if you
// want a specific model instead.
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// --- Reliability ------------------------------------------------------------
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_RETRIES = 2; // total attempts = MAX_RETRIES + 1
export const BASE_RETRY_DELAY_MS = 500;
export const MAX_RETRY_DELAY_MS = 4_000;

// --- Input protection --------------------------------------------------------
// Source text beyond this is truncated (see textUtils.js) rather than chunked.
// Chunking would require every task to merge partial results differently
// (a quiz can't just concatenate two quizzes-from-half-the-text into one
// 10-question quiz the way a summary could concatenate two summaries), which
// would change behavior per task. Truncation keeps every function's contract
// identical to before; true multi-chunk support can be added later per task
// if a caller needs whole-document coverage.
export const MAX_INPUT_LENGTH = 20_000;

// --- Quiz shape --------------------------------------------------------------
export const QUIZ_QUESTION_COUNT = 10;
export const QUIZ_CHOICE_COUNT = 4;

// --- Flashcards ---------------------------------------------------------------
export const MIN_FLASHCARDS = 10;
export const MAX_FLASHCARDS = 20;

// --- Per-task generation tuning ------------------------------------------------
// Field names here are camelCase because they map straight onto
// GenerateContentConfig from @google/genai (temperature, maxOutputTokens, ...).
export const GENERATION_CONFIGS = {
  summary: { temperature: 0.3, maxOutputTokens: 1200 },
  flashcards: { temperature: 0.4, maxOutputTokens: 5000 },
  quiz: { temperature: 0.2, maxOutputTokens: 5000 },
  explanation: { temperature: 0.6, maxOutputTokens: 1200 },
  notes: { temperature: 0.4, maxOutputTokens: 2500 },
};

// Native structured-output schema for quizzes, passed as
// config.responseSchema + config.responseMimeType = "application/json".
// This constrains Gemini's output at generation time; we still validate the
// parsed result ourselves (see quizValidation.js) because a schema-conformant
// response can still be truncated mid-stream or hit maxOutputTokens.
export const QUIZ_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: QUIZ_QUESTION_COUNT,
      maxItems: QUIZ_QUESTION_COUNT,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          choices: {
            type: "array",
            minItems: QUIZ_CHOICE_COUNT,
            maxItems: QUIZ_CHOICE_COUNT,
            items: { type: "string" },
          },
          correctIndex: {
            type: "integer",
            minimum: 0,
            maximum: QUIZ_CHOICE_COUNT - 1,
          },
        },
        required: ["question", "choices", "correctIndex"],
      },
    },
  },
  required: ["questions"],
};
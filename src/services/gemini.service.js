// Public API of this module is unchanged from before the refactor:
// askGemini, summarizeText, createFlashcard, createQuiz, explainConcept,
// generateNotes. Everything else now lives in ./ai/*.
import { generate } from "./ai/client.js";
import { assertHasContent } from "./ai/textUtils.js";
import {
  GENERATION_CONFIGS,
  QUIZ_RESPONSE_SCHEMA,
  QUIZ_QUESTION_COUNT,
  QUIZ_CHOICE_COUNT,
} from "./ai/config.js";
import {
  SUMMARY_SYSTEM_INSTRUCTION,
  FLASHCARD_SYSTEM_INSTRUCTION,
  QUIZ_SYSTEM_INSTRUCTION,
  EXPLANATION_SYSTEM_INSTRUCTION,
  NOTES_SYSTEM_INSTRUCTION,
} from "./ai/prompts.js";
import { parseAndValidateQuiz } from "./ai/quizValidation.js";
import { formatQuizAsMarkdown } from "./ai/quizRenderer.js";

// ---------------------------------------------------------------------------
// Free-form ask
// ---------------------------------------------------------------------------
export async function askGemini(prompt) {
  assertHasContent(prompt, "prompt");
  return generate(prompt, { task: "ask" });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
export async function summarizeText(text) {
  assertHasContent(text, "text to summarize");
  return generate(`Summarize the following content:\n\n${text}`, {
    task: "summary",
    systemInstruction: SUMMARY_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.summary,
  });
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
export async function createFlashcard(text) {
  assertHasContent(text, "content for flashcards");
  return generate(`Create study flashcards from the following content:\n\n${text}`, {
    task: "flashcards",
    systemInstruction: FLASHCARD_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.flashcards,
  });
}

// ---------------------------------------------------------------------------
// Quiz — the most failure-prone task. generate() is given a validateResponse
// callback that cleans, truncation-checks, parses, and schema-validates the
// raw JSON; any problem throws a GenerationValidationError, which the retry
// loop in client.js treats as retryable instead of failing immediately.
// ---------------------------------------------------------------------------
export async function createQuiz(text) {
  assertHasContent(text, "content for the quiz");

  let payload;
  await generate(`Generate a multiple-choice quiz from the following content:\n\n${text}`, {
    task: "quiz",
    systemInstruction: QUIZ_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.quiz,
    responseSchema: QUIZ_RESPONSE_SCHEMA,
    validateResponse: (raw) => {
      payload = parseAndValidateQuiz(raw, {
        questionCount: QUIZ_QUESTION_COUNT,
        choiceCount: QUIZ_CHOICE_COUNT,
      });
    },
  });

  return formatQuizAsMarkdown(payload);
}

// ---------------------------------------------------------------------------
// Concept explanation
// ---------------------------------------------------------------------------
export async function explainConcept(text) {
  assertHasContent(text, "concept");
  return generate(`Explain the following concept:\n\n${text}`, {
    task: "explanation",
    systemInstruction: EXPLANATION_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.explanation,
  });
}

// ---------------------------------------------------------------------------
// Study notes
// ---------------------------------------------------------------------------
export async function generateNotes(text) {
  assertHasContent(text, "content for notes");
  return generate(`Convert the following into organized study notes:\n\n${text}`, {
    task: "notes",
    systemInstruction: NOTES_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.notes,
  });
}
import { GenerationValidationError } from "./errors.js";
import { QUIZ_QUESTION_COUNT, QUIZ_CHOICE_COUNT } from "./config.js";

// Strips markdown code fences the model sometimes wraps JSON in despite
// instructions not to, and drops any stray preamble before the first `{`.
export function cleanJson(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  return cleaned;
}

// Cheap truncation detector: walk the string counting brace/bracket depth
// (ignoring braces inside quoted strings) and check it lands back at zero.
// A response cut off by maxOutputTokens or a dropped connection almost always
// ends mid-object, which this catches before we ever hand it to JSON.parse.
export function isBalancedJson(json) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of json) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") depth -= 1;
  }

  return depth === 0;
}

export function validateQuizPayload(
  payload,
  { questionCount = QUIZ_QUESTION_COUNT, choiceCount = QUIZ_CHOICE_COUNT } = {}
) {
  if (!payload || typeof payload !== "object") {
    throw new GenerationValidationError("Quiz payload is not an object.");
  }
  if (!Array.isArray(payload.questions)) {
    throw new GenerationValidationError("Quiz payload is missing a questions array.");
  }
  if (payload.questions.length !== questionCount) {
    throw new GenerationValidationError(
      `Expected ${questionCount} questions but received ${payload.questions.length}.`
    );
  }

  payload.questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;

    if (typeof q.question !== "string" || !q.question.trim()) {
      throw new GenerationValidationError(`${label} is missing question text.`);
    }
    if (!Array.isArray(q.choices) || q.choices.length !== choiceCount) {
      throw new GenerationValidationError(`${label} does not have exactly ${choiceCount} choices.`);
    }
    if (q.choices.some((c) => typeof c !== "string" || !c.trim())) {
      throw new GenerationValidationError(`${label} has an empty or non-string choice.`);
    }

    const normalizedChoices = new Set(q.choices.map((c) => c.trim().toLowerCase()));
    if (normalizedChoices.size !== choiceCount) {
      throw new GenerationValidationError(`${label} has duplicate choices.`);
    }

    if (
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex >= choiceCount
    ) {
      throw new GenerationValidationError(`${label} has an invalid correctIndex.`);
    }
  });

  return payload;
}

// The single entry point createQuiz() calls. Runs cleanup, truncation
// detection, JSON.parse, and schema validation in order, throwing a
// GenerationValidationError with a specific `reason` at the first problem —
// generate()'s retry loop treats all of these as retryable.
export function parseAndValidateQuiz(raw, options = {}) {
  const cleaned = cleanJson(raw);

  if (!cleaned) {
    throw new GenerationValidationError("Quiz response was empty after cleanup.", {
      reason: "empty",
    });
  }

  if (!isBalancedJson(cleaned)) {
    throw new GenerationValidationError("Quiz response appears to be truncated.", {
      reason: "truncated_json",
      preview: cleaned.slice(-200),
    });
  }

  let payload;
  try {
    payload = JSON.parse(cleaned);
  } catch (err) {
    throw new GenerationValidationError(`Quiz response was not valid JSON: ${err.message}`, {
      reason: "malformed_json",
      preview: cleaned.slice(-200),
    });
  }

  return validateQuizPayload(payload, options);
}
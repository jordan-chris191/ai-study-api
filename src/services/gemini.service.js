import { GoogleGenAI } from "@google/genai";
import { AppError } from "../utils/AppError.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash-lite";

// Tune generation behavior per task instead of using one setting for everything.
// Lower temperature = more consistent/structured output (quiz, summary).
// Higher temperature = more natural variation (explanations, notes).
// NOTE: field names inside generation_config are snake_case on this API
// (e.g. max_output_tokens) — not maxOutputTokens like the older generateContent
// config object. JSON-mode output is NOT configured here — see response_format below.
const GENERATION_CONFIGS = {
  summary: { temperature: 0.3, max_output_tokens: 1200 },
  flashcards: { temperature: 0.4, max_output_tokens: 2500 },
  quiz: { temperature: 0.4, max_output_tokens: 3000 },
  explanation: { temperature: 0.6, max_output_tokens: 1200 },
  notes: { temperature: 0.4, max_output_tokens: 2500 },
};

// Structured output for the quiz: a separate top-level `response_format` field
// (not part of generation_config), which also lets us enforce a JSON Schema
// instead of just asking nicely in the prompt.
const QUIZ_RESPONSE_FORMAT = {
  type: "text",
  mime_type: "application/json",
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 10,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            choices: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" },
            },
            correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          },
          required: ["question", "choices", "correctIndex"],
        },
      },
    },
    required: ["questions"],
  },
};

// ---------------------------------------------------------------------------
// Core call — every exported function funnels through here.
// ---------------------------------------------------------------------------
async function generate(input, { systemInstruction, generationConfig, responseFormat } = {}) {
  try {
    const interaction = await ai.interactions.create({
      model: MODEL,
      input,
      // NOTE: the Interactions API (still in beta as of this writing) expects
      // snake_case field names on the wire, unlike the rest of the @google/genai
      // SDK which is camelCase. Confirmed via live 400 errors:
      // "Unknown parameter 'generationConfig'. Did you mean 'generation_config'?"
      // response_format is a top-level field, NOT nested inside generation_config
      // ("Unknown parameter 'response_mime_type' at 'generation_config'.").
      ...(systemInstruction && { system_instruction: systemInstruction }),
      ...(generationConfig && { generation_config: generationConfig }),
      ...(responseFormat && { response_format: responseFormat }),
    });
    return interaction.output_text;
  } catch (err) {
    // A failure here is the upstream API/service's fault, not the caller's —
    // surface it as a 500 rather than lumping it in with input-validation errors.
    console.error("Gemini generation failed:", err);
    throw new AppError("Something went wrong generating content. Please try again.", 500);
  }
}

function assertHasContent(text, label = "content") {
  if (!text || !text.trim()) {
    throw new AppError(`No ${label} was provided.`, 400);
  }
}

// ---------------------------------------------------------------------------
// Free-form ask
// ---------------------------------------------------------------------------
export async function askGemini(prompt) {
  assertHasContent(prompt, "prompt");
  return generate(prompt);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const SUMMARY_SYSTEM_INSTRUCTION = `You are an expert study assistant who condenses source material into dense, exam-ready summaries.

Rules:
- Output valid Markdown only — no preamble, no closing remarks.
- Structure with ## headings for major topics and bullet points beneath them.
- Bold key terms and concepts on first use (**like this**).
- Keep only information a student needs to understand and recall the material. Cut filler, repeated examples, and restated points.
- If the source contains a formula, equation, or notation, reproduce it exactly using inline code or a code block.
- End with a "## Key Takeaways" section: 3-6 bullets capturing the most exam-relevant points.
- Do not introduce facts that are not in the source text.`;

export async function summarizeText(text) {
  assertHasContent(text, "text to summarize");
  return generate(`Summarize the following content:\n\n${text}`, {
    systemInstruction: SUMMARY_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.summary,
  });
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------
const FLASHCARD_SYSTEM_INSTRUCTION = `You are an expert educator who writes spaced-repetition-style flashcards.

Rules:
- Produce between 10 and 20 flashcards, driven by how much distinct, testable material is in the source — do not pad to hit a number.
- Each flashcard tests exactly ONE concept. Never combine two ideas into one question.
- Questions must be answerable from the source alone, phrased concisely (under ~20 words where possible).
- Answers must be self-contained: someone reading only the answer should understand it without re-reading the question.
- No duplicate or near-duplicate questions.
- Prefer "why" and "how" questions over pure recall when the source supports it — they retain better.
- Output valid Markdown only, no preamble, using exactly this format for every card:

## Flashcard {n}

**Question**
...

**Answer**
...`;

export async function createFlashcard(text) {
  assertHasContent(text, "content for flashcards");
  return generate(`Create study flashcards from the following content:\n\n${text}`, {
    systemInstruction: FLASHCARD_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.flashcards,
  });
}

// ---------------------------------------------------------------------------
// Quiz — the most failure-prone task, so this one asks the model for
// structured JSON, validates it in code, and shuffles/renders deterministically
// instead of trusting the model to shuffle and format correctly itself.
// ---------------------------------------------------------------------------
const QUIZ_SYSTEM_INSTRUCTION = `You are an expert assessment writer. You generate multiple-choice quiz questions strictly from the material you're given.

Rules:
- Generate exactly 10 questions.
- Each question has exactly 4 answer choices.
- Exactly one choice is correct; the other 3 must be plausible but clearly wrong to someone who understood the material (no throwaway joke options).
- Do not reuse the same correct-answer wording across questions.
- Every question must be answerable from the given content alone.
- Respond with ONLY a JSON object matching this exact shape, no markdown fences, no commentary:

{
  "questions": [
    {
      "question": "string",
      "choices": ["string", "string", "string", "string"],
      "correctIndex": 0
    }
  ]
}

"correctIndex" is the 0-based index into "choices" of the correct answer.`;

function validateQuizPayload(payload) {
  if (!payload || !Array.isArray(payload.questions)) {
    throw new AppError("Quiz response was not in the expected format.", 500);
  }
  payload.questions.forEach((q, i) => {
    if (typeof q.question !== "string" || !q.question.trim()) {
      throw new AppError(`Question ${i + 1} is missing text.`, 500);
    }
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      throw new AppError(`Question ${i + 1} does not have exactly 4 choices.`, 500);
    }
    if (new Set(q.choices).size !== 4) {
      throw new AppError(`Question ${i + 1} has duplicate choices.`, 500);
    }
    if (
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex > 3
    ) {
      throw new AppError(`Question ${i + 1} has an invalid correctIndex.`, 500);
    }
  });
  return payload;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Renders validated quiz JSON into Markdown, shuffling answer order ourselves
// (rather than asking the model to) so "shuffled" is guaranteed, not just requested.
function formatQuizAsMarkdown(payload) {
  const letters = ["A", "B", "C", "D"];
  const answerKey = [];
  let markdown = "";

  payload.questions.forEach((q, i) => {
    const order = shuffle([0, 1, 2, 3]);
    const shuffledChoices = order.map((originalIdx) => q.choices[originalIdx]);
    const correctLetter = letters[order.indexOf(q.correctIndex)];
    answerKey.push(`${i + 1}. ${correctLetter}`);

    markdown += `**${i + 1}. ${q.question}**\n\n`;
    shuffledChoices.forEach((choice, idx) => {
      markdown += `${letters[idx]}. ${choice}\n`;
    });
    markdown += "\n";
  });

  markdown += `## Answer Key\n\n${answerKey.join("\n")}\n`;
  return markdown;
}

export async function createQuiz(text) {
  assertHasContent(text, "content for the quiz");
  const raw = await generate(`Generate a multiple-choice quiz from the following content:\n\n${text}`, {
    systemInstruction: QUIZ_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.quiz,
    responseFormat: QUIZ_RESPONSE_FORMAT,
  });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new AppError("Quiz generation returned invalid JSON. Try again.", 500);
  }

  validateQuizPayload(payload);
  return formatQuizAsMarkdown(payload);
}

// ---------------------------------------------------------------------------
// Concept explanation
// ---------------------------------------------------------------------------
const EXPLANATION_SYSTEM_INSTRUCTION = `You teach college-level concepts clearly and efficiently.

Rules:
- Output valid Markdown.
- Start with a one-sentence plain-language definition before any detail.
- Break the explanation into small numbered steps or stages where the concept has a logical progression.
- Include at least one concrete example.
- Use an analogy only if it genuinely clarifies the concept — skip it rather than force one.
- Be concise: prioritize clarity over completeness. Do not pad with restatements.`;

export async function explainConcept(text) {
  assertHasContent(text, "concept");
  return generate(`Explain the following concept:\n\n${text}`, {
    systemInstruction: EXPLANATION_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.explanation,
  });
}

// ---------------------------------------------------------------------------
// Study notes
// ---------------------------------------------------------------------------
const NOTES_SYSTEM_INSTRUCTION = `You convert raw content into organized, exam-focused study notes.

Rules:
- Output valid Markdown with ## headings per topic and nested bullet points.
- Under each topic include, where applicable: key definitions, important facts, and a worked example.
- Add a "**Memory tip:**" line after any concept that's easy to confuse or forget — only when a genuinely useful mnemonic or distinction exists, not for every bullet.
- End with a "## Likely Exam Questions" section: 3-5 questions this material is likely to be tested on.
- Do not add information not present in or reasonably implied by the source content.`;

export async function generateNotes(text) {
  assertHasContent(text, "content for notes");
  return generate(`Convert the following into organized study notes:\n\n${text}`, {
    systemInstruction: NOTES_SYSTEM_INSTRUCTION,
    generationConfig: GENERATION_CONFIGS.notes,
  });
}
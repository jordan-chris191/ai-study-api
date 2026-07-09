import { AppError } from "../../utils/AppError.js";

// Thrown by a task's validateResponse callback (see client.js) when Gemini's
// output is structurally unusable — empty, truncated, malformed JSON, or
// schema-invalid. Distinct from a plain input-validation AppError because
// these are worth retrying: the same prompt often succeeds on a second try.
export class GenerationValidationError extends Error {
  constructor(message, { reason = "invalid_schema", preview, retryable = true } = {}) {
    super(message);
    this.name = "GenerationValidationError";
    this.reason = reason;
    this.preview = preview;
    this.retryable = retryable;
  }
}

// Normalizes whatever generate() catches — SDK errors, abort errors, our own
// GenerationValidationError, network failures — into one shape the retry
// loop and logger can both reason about, without either of them needing to
// know the specifics of the @google/genai error classes.
export function classifyError(err) {
  if (err instanceof GenerationValidationError) {
    return {
      type: err.reason,
      retryable: err.retryable,
      status: 502,
      message: "The AI returned a response we couldn't use. Please try again.",
      preview: err.preview,
    };
  }

  if (err?.name === "AbortError") {
    return {
      type: "timeout",
      retryable: true,
      status: 504,
      message: "The AI request took too long and was cancelled.",
    };
  }

  // @google/genai surfaces API errors with a numeric status/code depending on
  // SDK version; check the common spots defensively rather than assuming one.
  const status = err?.status ?? err?.code ?? err?.response?.status;

  if (status === 429) {
    return {
      type: "rate_limit",
      retryable: true,
      status: 429,
      message: "The AI service is rate-limited right now. Please try again shortly.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      type: "authentication",
      retryable: false,
      status: 500,
      message: "The AI service rejected our credentials.",
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      type: "upstream",
      retryable: true,
      status: 502,
      message: "The AI service is temporarily unavailable. Please try again.",
    };
  }

  const networkCodes = new Set(["ENOTFOUND", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);
  if (networkCodes.has(err?.cause?.code) || /fetch failed/i.test(err?.message ?? "")) {
    return {
      type: "network",
      retryable: true,
      status: 502,
      message: "Could not reach the AI service.",
    };
  }

  return {
    type: "unknown",
    retryable: false,
    status: 500,
    message: "Something went wrong generating content. Please try again.",
  };
}

export function toAppError(classified) {
  return new AppError(classified.message, classified.status);
}
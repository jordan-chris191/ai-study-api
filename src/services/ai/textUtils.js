import { AppError } from "../../utils/AppError.js";
import { MAX_INPUT_LENGTH } from "./config.js";

export function assertHasContent(text, label = "content") {
  if (typeof text !== "string" || !text.trim()) {
    throw new AppError(`No ${label} was provided.`, 400);
  }
}

// Truncates at the nearest paragraph or sentence boundary rather than mid-word,
// so the model still gets clean, complete sentences even when we cut it off.
// See config.js for why we truncate instead of chunking.
export function truncateInput(text, maxLength = MAX_INPUT_LENGTH) {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return { text: trimmed, truncated: false };
  }

  const slice = trimmed.slice(0, maxLength);
  const paragraphBreak = slice.lastIndexOf("\n\n");
  const sentenceBreak = slice.lastIndexOf(". ");
  const breakPoint = Math.max(paragraphBreak, sentenceBreak);

  // Only honor the break if it doesn't throw away more than half the budget;
  // otherwise a hard cutoff is better than a tiny fragment.
  const cutoff = breakPoint > maxLength * 0.5 ? breakPoint + 1 : maxLength;

  return { text: slice.slice(0, cutoff).trim(), truncated: true };
}
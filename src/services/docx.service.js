import mammoth from "mammoth";
import { AppError } from "../utils/AppError.js";

export async function extractText(buffer) {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (error) {
    console.error("DOCX extraction failed:", error);
    throw new AppError("Failed to read the Word document. It may be corrupted.", 500);
  }

  if (!result.value || !result.value.trim()) {
    throw new AppError("This document doesn't contain any extractable text.", 400);
  }

  return result.value;
}
import { PDFParse, PasswordException, InvalidPDFException } from "pdf-parse";
import { AppError } from "../utils/AppError.js";

export async function extractText(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    if (!result.text || !result.text.trim()) {
      // Common for scanned/image-only PDFs with no embedded text layer.
      throw new AppError(
        "This PDF doesn't contain any extractable text (it may be a scanned image). Try a text-based PDF.",
        400
      );
    }

    return result.text;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error instanceof PasswordException) {
      throw new AppError("This PDF is password-protected and can't be read.", 400);
    }
    if (error instanceof InvalidPDFException) {
      throw new AppError("This file doesn't look like a valid PDF.", 400);
    }

    // Unexpected failure — log full details server-side, but don't
    // leak internals (stack traces, library-specific messages) to the client.
    console.error("PDF extraction failed:", error);
    throw new AppError("Failed to read the PDF. Please try a different file.", 500);
  } finally {
    // Always free the parser's resources, even on failure.
    await parser.destroy();
  }
}
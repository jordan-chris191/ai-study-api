import path from "node:path";
import { extractText as extractPdfText } from "./pdf.service.js";
import { extractText as extractDocxText } from "./docx.service.js";
import { extractText as extractPptxText } from "./pptx.service.js";
import { extractTextFromUrl } from "./website.service.js";
import { AppError } from "../utils/AppError.js";

const HANDLERS_BY_MIME = {
  "application/pdf": extractPdfText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": extractDocxText,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": extractPptxText,
};

const HANDLERS_BY_EXT = {
  ".pdf": extractPdfText,
  ".docx": extractDocxText,
  ".pptx": extractPptxText,
};

// file: an Express/multer file object ({ buffer, mimetype, originalname })
// url: a plain string
// Exactly one of the two should be provided.
export async function extractTextFromSource({ file, url }) {
  if (url) {
    return extractTextFromUrl(url);
  }

  if (!file) {
    throw new AppError("No file or URL was provided.", 400);
  }

  const handler =
    HANDLERS_BY_MIME[file.mimetype] ||
    HANDLERS_BY_EXT[path.extname(file.originalname || "").toLowerCase()];

  if (!handler) {
    throw new AppError(
      "Unsupported file type. Please upload a PDF, DOCX, or PPTX file.",
      400
    );
  }

  return handler(file.buffer);
}
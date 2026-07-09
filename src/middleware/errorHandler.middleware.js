import multer from "multer";
import { AppError } from "../utils/AppError.js";

// Must be registered LAST, after all routes, with 4 arguments
// (Express identifies error-handling middleware by arity).
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large (max 20MB)." });
    }
    return res.status(400).json({ error: err.message });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong." });
}
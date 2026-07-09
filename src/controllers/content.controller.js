import { extractTextFromSource } from "../services/document.service.js";
import {
  summarizeText,
  createFlashcard,
  createQuiz,
  explainConcept,
  generateNotes,
} from "../services/gemini.service.js";
import { AppError } from "../utils/AppError.js";

async function processSource(req, res, aiFunction, responseKey = "result") {
  try {
    const file = req.file;
    const url = req.body?.url;

    if (!file && !url) {
      return res
        .status(400)
        .json({ error: "No file uploaded and no URL provided" });
    }

    const text = await extractTextFromSource({ file, url });
    const result = await aiFunction(text);

    res.json({ [responseKey]: result });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Unexpected error in processSource:", error);
    res
      .status(500)
      .json({ error: "Something went wrong processing your request." });
  }
}

export async function summarize(req, res) {
  return processSource(req, res, summarizeText, "summary");
}

export async function flashcard(req, res) {
  return processSource(req, res, createFlashcard, "flashcards");
}

export async function quiz(req, res) {
  return processSource(req, res, createQuiz, "quiz");
}

export async function concept(req, res) {
  return processSource(req, res, explainConcept, "concept");
}

export async function notes(req, res) {
  return processSource(req, res, generateNotes, "notes");
}
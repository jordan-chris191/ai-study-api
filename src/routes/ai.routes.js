import express from "express";
import upload from "../middleware/upload.middleware.js";
import {
  summarize,
  flashcard,
  quiz,
  concept,
  notes,
} from "../controllers/content.controller.js";
import { ask } from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/ask", ask);

router.post("/summarize", upload.single("pdf"), summarize);
router.post("/flashcard", upload.single("pdf"), flashcard);
router.post("/quiz", upload.single("pdf"), quiz);
router.post("/concept", upload.single("pdf"), concept);
router.post("/notes", upload.single("pdf"), notes);

export default router;
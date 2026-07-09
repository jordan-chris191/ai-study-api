import { askGemini } from "../services/gemini.service.js";

export async function ask(req, res) {
  try {
    const { prompt } = req.body;

    const answer = await askGemini(prompt);

    res.json({ answer });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}

import * as cheerio from "cheerio";
import { AppError } from "../utils/AppError.js";

const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB safety cap

export async function extractTextFromUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new AppError("That doesn't look like a valid URL.", 400);
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new AppError("Only http(s) URLs are supported.", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(parsedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StudyAssistantBot/1.0)" },
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError("The page took too long to load.", 400);
    }
    throw new AppError("Couldn't reach that URL. Check the link and try again.", 400);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new AppError(`The page returned an error (HTTP ${response.status}).`, 400);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new AppError("That URL doesn't point to a web page (expected HTML).", 400);
  }

  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new AppError("That page is too large to process.", 400);
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer, svg, iframe, form").remove();

  const text = $("body")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  if (!text) {
    throw new AppError("Couldn't find readable text content on that page.", 400);
  }

  return text;
}
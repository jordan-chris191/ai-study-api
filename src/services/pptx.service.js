import JSZip from "jszip";
import { AppError } from "../utils/AppError.js";

// A .pptx file is a zip archive. Each slide's text lives in
// ppt/slides/slideN.xml as <a:t>...</a:t> runs. We parse that directly
// with jszip + a regex rather than depending on a pptx-specific parser
// library — several of those have had breaking API changes across
// recent major versions, while jszip's zip-reading API has been stable
// for years. Trade-off: this only extracts plain text runs, not tables,
// speaker notes, or embedded objects.
export async function extractText(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    console.error("PPTX unzip failed:", error);
    throw new AppError("This file doesn't look like a valid PPTX.", 400);
  }

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/)[1]);
      const numB = Number(b.match(/slide(\d+)\.xml/)[1]);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new AppError("No slides were found in this PPTX file.", 400);
  }

  const slideTexts = [];
  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName].async("string");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    if (runs.length) slideTexts.push(runs.join(" "));
  }

  const text = slideTexts.join("\n\n").trim();

  if (!text) {
    throw new AppError(
      "This presentation doesn't contain any extractable text (slides may be image-only).",
      400
    );
  }

  return text;
}

function decodeXmlEntities(str) {
  // NOTE: &amp; must be decoded last, or "&amp;lt;" would incorrectly
  // become "<" instead of the literal text "&lt;".
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
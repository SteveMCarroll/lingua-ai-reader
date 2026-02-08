/**
 * Downloads a Project Gutenberg book (plain text UTF-8) and splits it into
 * chapter JSON files for the Lingua AI Reader.
 *
 * Usage:
 *   npx tsx scripts/process-gutenberg.ts <gutenberg-id> <book-slug>
 *
 * Example:
 *   npx tsx scripts/process-gutenberg.ts 29506 sombrero-tres-picos
 */

import * as fs from "fs";
import * as path from "path";

const GUTENBERG_MIRROR = "https://www.gutenberg.org/cache/epub";

interface Chapter {
  index: number;
  title: string;
  paragraphs: string[];
}

interface BookData {
  id: string;
  gutenbergId: number;
  chapters: Chapter[];
}

function stripGutenbergBoilerplate(text: string): string {
  // Remove Project Gutenberg header
  const startMarkers = [
    "*** START OF THE PROJECT GUTENBERG EBOOK",
    "*** START OF THIS PROJECT GUTENBERG EBOOK",
    "***START OF THE PROJECT GUTENBERG EBOOK",
  ];
  const endMarkers = [
    "*** END OF THE PROJECT GUTENBERG EBOOK",
    "*** END OF THIS PROJECT GUTENBERG EBOOK",
    "***END OF THE PROJECT GUTENBERG EBOOK",
    "End of the Project Gutenberg",
    "End of Project Gutenberg",
  ];

  let startIdx = 0;
  for (const marker of startMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      startIdx = text.indexOf("\n", idx) + 1;
      break;
    }
  }

  let endIdx = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      endIdx = idx;
      break;
    }
  }

  return text.slice(startIdx, endIdx).trim();
}

function splitIntoChapters(text: string): Chapter[] {
  // Common Spanish chapter patterns
  const chapterPatterns = [
    /^(CAPÍTULO|CAPITULO|CAP\.)\s+([IVXLCDM\d]+)/im,
    /^(PARTE|LIBRO)\s+([IVXLCDM\d]+)/im,
  ];

  // Split on lines that match chapter headings
  const lines = text.split("\n");
  const chapters: Chapter[] = [];
  let currentTitle = "Introducción";
  let currentParagraphs: string[] = [];
  let currentPara = "";

  function flushParagraph() {
    const trimmed = currentPara.trim();
    if (trimmed) {
      currentParagraphs.push(trimmed);
    }
    currentPara = "";
  }

  function flushChapter() {
    flushParagraph();
    if (currentParagraphs.length > 0) {
      chapters.push({
        index: chapters.length,
        title: currentTitle,
        paragraphs: currentParagraphs,
      });
      currentParagraphs = [];
    }
  }

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line is a chapter heading
    let isChapterHeading = false;
    for (const pattern of chapterPatterns) {
      if (pattern.test(trimmedLine)) {
        isChapterHeading = true;
        break;
      }
    }

    // Also detect all-caps short lines as section breaks
    if (
      !isChapterHeading &&
      trimmedLine.length > 2 &&
      trimmedLine.length < 80 &&
      trimmedLine === trimmedLine.toUpperCase() &&
      /^[A-ZÁÉÍÓÚÜÑ\s\.\-,IVXLCDM\d]+$/.test(trimmedLine)
    ) {
      isChapterHeading = true;
    }

    if (isChapterHeading) {
      flushChapter();
      currentTitle = trimmedLine;
    } else if (trimmedLine === "") {
      flushParagraph();
    } else {
      currentPara += (currentPara ? " " : "") + trimmedLine;
    }
  }

  flushChapter();

  // If no chapters were detected, make the whole text one chapter
  if (chapters.length === 0) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\n/g, " "))
      .filter((p) => p.length > 0);
    chapters.push({
      index: 0,
      title: "Texto completo",
      paragraphs,
    });
  }

  return chapters;
}

async function downloadBook(gutenbergId: number): Promise<string> {
  // Try UTF-8 plain text first
  const urls = [
    `${GUTENBERG_MIRROR}/${gutenbergId}/pg${gutenbergId}.txt`,
    `${GUTENBERG_MIRROR}/${gutenbergId}/pg${gutenbergId}.txt.utf8`,
  ];

  for (const url of urls) {
    console.log(`Trying ${url}...`);
    const response = await fetch(url);
    if (response.ok) {
      console.log(`Downloaded from ${url}`);
      return await response.text();
    }
  }

  throw new Error(`Could not download Gutenberg book #${gutenbergId}`);
}

async function main() {
  const gutenbergId = parseInt(process.argv[2], 10);
  const slug = process.argv[3];

  if (!gutenbergId || !slug) {
    console.error("Usage: npx tsx scripts/process-gutenberg.ts <gutenberg-id> <book-slug>");
    process.exit(1);
  }

  console.log(`Processing Gutenberg #${gutenbergId} as "${slug}"...`);

  const rawText = await downloadBook(gutenbergId);
  const cleanText = stripGutenbergBoilerplate(rawText);
  const chapters = splitIntoChapters(cleanText);

  console.log(`Found ${chapters.length} chapters`);

  const outDir = path.join(process.cwd(), "src", "data", "content", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Write individual chapter files
  for (const chapter of chapters) {
    const filename = `chapter-${String(chapter.index).padStart(2, "0")}.json`;
    fs.writeFileSync(
      path.join(outDir, filename),
      JSON.stringify(chapter, null, 2),
      "utf-8"
    );
    console.log(`  ${filename}: "${chapter.title}" (${chapter.paragraphs.length} paragraphs)`);
  }

  // Write book metadata
  const bookData: BookData = {
    id: slug,
    gutenbergId,
    chapters: chapters.map((c) => ({
      index: c.index,
      title: c.title,
      paragraphs: [], // metadata only
    })),
  };

  fs.writeFileSync(
    path.join(outDir, "metadata.json"),
    JSON.stringify(bookData, null, 2),
    "utf-8"
  );

  console.log(`\nDone! Output in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

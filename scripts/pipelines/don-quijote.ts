/**
 * Pipeline for: Don Quijote de la Mancha — Miguel de Cervantes Saavedra
 * Gutenberg #2000
 *
 * Contains both Part 1 (52 chapters) and Part 2 (74 chapters).
 * Text starts with a table of contents, then the actual chapters begin
 * with "Capítulo primero". Each chapter heading is on its own line,
 * followed by a subtitle describing the chapter content.
 *
 * We skip the TOC by starting from the first actual "Capítulo primero"
 * that's followed by real prose content (not just more TOC entries).
 */

import type { BookPipeline, BookData } from "../process-gutenberg";
import { textToParagraphs } from "../process-gutenberg";

const pipeline: BookPipeline = {
  id: "don-quijote",
  title: "Don Quijote de la Mancha",
  author: "Miguel de Cervantes Saavedra",
  description:
    "The greatest novel in the Spanish language. Follow the adventures of the ingenious knight and his faithful squire.",
  gutenbergId: 2000,

  transform(text: string): BookData {
    const lines = text.split("\n");

    // Chapter heading pattern: "Capítulo primero", "Capítulo II", etc.
    const chapterRe = /^Capítulo\s+(primero|[IVXLC]+)\b/i;

    // Find where actual content starts (skip TOC).
    // The TOC has chapter headings bunched together with no prose between them.
    // The real content starts where a chapter heading is followed by actual paragraphs.
    let contentStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (chapterRe.test(lines[i].trim())) {
        // Check if the next ~10 lines have substantial prose (not just more headings)
        let proseLines = 0;
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const t = lines[j].trim();
          if (t.length > 80) proseLines++;
        }
        if (proseLines >= 2) {
          contentStart = i;
          break;
        }
      }
    }

    const content = lines.slice(contentStart);
    const chapters: BookData["chapters"] = [];
    let currentTitle = "";
    let currentLines: string[] = [];

    function flush() {
      const paragraphs = textToParagraphs(currentLines.join("\n"));
      if (paragraphs.length > 0 && currentTitle) {
        chapters.push({ title: currentTitle, paragraphs });
      }
      currentLines = [];
    }

    // Track chapter numbering to detect Part 2 (resets to "Capítulo Primero")
    let part = 1;
    let lastChapterSeen = 0;

    for (const line of content) {
      const trimmed = line.trim();

      if (chapterRe.test(trimmed)) {
        flush();

        // Detect Part 2: when numbering resets to "Primero" after chapter LII
        if (/primero/i.test(trimmed) && lastChapterSeen > 10) {
          part = 2;
        }
        lastChapterSeen++;

        // Build a clean title: "Capítulo II" + subtitle from next line(s)
        currentTitle = trimmed;
      } else if (currentTitle && currentLines.length === 0 && trimmed && trimmed.length < 200) {
        // First non-empty line after heading is the chapter subtitle — append to title
        currentTitle += ". " + trimmed;
      } else {
        currentLines.push(line);
      }
    }
    flush();

    return {
      id: "don-quijote",
      title: "Don Quijote de la Mancha",
      author: "Miguel de Cervantes Saavedra",
      chapters,
    };
  },
};

export default pipeline;

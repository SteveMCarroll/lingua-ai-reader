/**
 * Pipeline for: Marianela — Benito Pérez Galdós
 * Gutenberg #17340
 *
 * Clean text. Chapters are marked with "-I-", "-II-", etc.
 * No significant preface or endnotes to strip.
 */

import type { BookPipeline, BookData } from "../process-gutenberg";
import { textToParagraphs } from "../process-gutenberg";

const pipeline: BookPipeline = {
  id: "marianela",
  title: "Marianela",
  author: "Benito Pérez Galdós",
  description:
    "The moving story of a blind man and his guide. Clear, beautiful prose perfect for intermediate learners.",
  gutenbergId: 17340,

  transform(text: string): BookData {
    const lines = text.split("\n");
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

    for (const line of lines) {
      const trimmed = line.trim();

      // Chapter heading: -I-, -II-, -XXII-, etc.
      if (/^-[IVXLC]+-$/.test(trimmed)) {
        flush();
        currentTitle = trimmed;
      } else {
        currentLines.push(line);
      }
    }
    flush();

    return {
      id: "marianela",
      title: "Marianela",
      author: "Benito Pérez Galdós",
      chapters,
    };
  },
};

export default pipeline;

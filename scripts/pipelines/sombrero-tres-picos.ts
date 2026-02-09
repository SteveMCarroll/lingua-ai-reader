/**
 * Pipeline for: El sombrero de tres picos — Pedro Antonio de Alarcón
 * Gutenberg #29506
 *
 * This edition has an English academic introduction, notes, and vocabulary
 * before and after the Spanish text. The actual novel starts at
 * "PREFACIO DEL AUTOR" (the last occurrence — first is a TOC entry).
 * Chapters use ALL-CAPS descriptive titles, sometimes preceded by a
 * bare Roman numeral line. Ends at "NOTES" section.
 */

import type { BookPipeline, BookData } from "../process-gutenberg";
import { textToParagraphs } from "../process-gutenberg";

const pipeline: BookPipeline = {
  id: "sombrero-tres-picos",
  title: "El sombrero de tres picos",
  author: "Pedro Antonio de Alarcón",
  description:
    "A playful short novel about a miller's wife and a magistrate. Great dialogue, accessible vocabulary.",
  gutenbergId: 29506,

  transform(text: string): BookData {
    const lines = text.split("\n");

    // Find the LAST "PREFACIO DEL AUTOR" line (skip TOC entry)
    let startLine = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "PREFACIO DEL AUTOR") {
        startLine = i;
        break;
      }
    }

    // Find "NOTES" to stop before English endnotes
    let endLine = lines.length;
    for (let i = startLine; i < lines.length; i++) {
      if (lines[i].trim() === "NOTES") {
        endLine = i;
        break;
      }
    }

    const content = lines.slice(startLine, endLine);

    // Chapter headings are ALL-CAPS lines with 5+ alpha characters,
    // only letters/spaces/accents/punctuation (no guillemets, which excludes dialogue)
    const isChapterHeading = (line: string) => {
      const t = line.trim();
      if (t.length < 5) return false;
      if (!/^[A-ZÁÉÍÓÚÜÑ\s,¿¡!?\.…]+$/.test(t)) return false;
      const alphaCount = (t.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length;
      return alphaCount >= 5;
    };

    // Skip bare Roman numeral lines and "FIN."
    const isSkipLine = (line: string) => {
      const t = line.trim();
      return /^[IVXLC]{1,6}\.?$/.test(t) || /^FIN\.?$/.test(t);
    };

    const chapters: BookData["chapters"] = [];
    let currentTitle = "";
    let currentLines: string[] = [];

    function flush() {
      const text = currentLines.join("\n");
      const paragraphs = textToParagraphs(text);
      if (paragraphs.length > 0 && currentTitle) {
        chapters.push({
          title: currentTitle,
          isPreface: currentTitle === "PREFACIO DEL AUTOR" || undefined,
          paragraphs,
        });
      }
      currentLines = [];
    }

    for (const line of content) {
      const trimmed = line.trim();
      if (isSkipLine(trimmed)) continue;

      if (isChapterHeading(trimmed)) {
        flush();
        currentTitle = trimmed;
      } else {
        currentLines.push(line);
      }
    }
    flush();

    return {
      id: "sombrero-tres-picos",
      title: "El sombrero de tres picos",
      author: "Pedro Antonio de Alarcón",
      chapters,
    };
  },
};

export default pipeline;

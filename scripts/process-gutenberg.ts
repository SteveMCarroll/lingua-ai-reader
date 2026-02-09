/**
 * Gutenberg book processing pipeline.
 *
 * Shared steps (download, strip boilerplate) are here.
 * Per-book transforms live in scripts/pipelines/{book-id}.ts.
 *
 * Usage:
 *   npx tsx scripts/process-gutenberg.ts [book-id]
 *
 * Omit book-id to process all books. Each pipeline script exports a
 * transform(text: string) => BookData function.
 */

import * as fs from "fs";
import * as path from "path";

export interface BookChapter {
  title: string;
  isPreface?: boolean;
  paragraphs: string[];
}

export interface BookData {
  id: string;
  title: string;
  author: string;
  chapters: BookChapter[];
}

export interface BookPipeline {
  id: string;
  title: string;
  author: string;
  description: string;
  gutenbergId: number;
  transform: (text: string) => BookData;
}

const GUTENBERG_MIRROR = "https://www.gutenberg.org/cache/epub";

// ─── Shared utilities ──────────────────────────────────────────────

export function stripGutenbergBoilerplate(text: string): string {
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

/** Split text into paragraphs (blank-line separated), joining wrapped lines. */
export function textToParagraphs(text: string): string[] {
  const paragraphs: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (current) {
        paragraphs.push(current);
        current = "";
      }
    } else {
      current += (current ? " " : "") + trimmed;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

// ─── Pipeline runner ───────────────────────────────────────────────

async function downloadBook(gutenbergId: number, bookId: string): Promise<string> {
  const rawDir = path.join(process.cwd(), "scripts", "raw");
  const cachedFile = path.join(rawDir, `${bookId}.txt`);

  // Use cached download if available
  if (fs.existsSync(cachedFile)) {
    console.log(`  Using cached ${cachedFile}`);
    return fs.readFileSync(cachedFile, "utf-8");
  }

  const urls = [
    `${GUTENBERG_MIRROR}/${gutenbergId}/pg${gutenbergId}.txt`,
    `${GUTENBERG_MIRROR}/${gutenbergId}/pg${gutenbergId}.txt.utf8`,
  ];

  for (const url of urls) {
    console.log(`  Trying ${url}...`);
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      fs.mkdirSync(rawDir, { recursive: true });
      fs.writeFileSync(cachedFile, text, "utf-8");
      console.log(`  Downloaded and cached`);
      return text;
    }
  }

  throw new Error(`Could not download Gutenberg book #${gutenbergId}`);
}

async function main() {
  const specificBook = process.argv[2];

  // Dynamically import all pipeline files
  const pipelinesDir = path.join(process.cwd(), "scripts", "pipelines");
  const pipelineFiles = fs.readdirSync(pipelinesDir).filter((f) => f.endsWith(".ts"));

  const pipelines: BookPipeline[] = [];
  for (const file of pipelineFiles) {
    const mod = await import(`./pipelines/${file}`);
    pipelines.push(mod.default as BookPipeline);
  }

  const toProcess = specificBook
    ? pipelines.filter((p) => p.id === specificBook)
    : pipelines;

  if (toProcess.length === 0) {
    console.error(`Unknown book: ${specificBook}`);
    console.error(`Available: ${pipelines.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "src", "data", "content");
  fs.mkdirSync(outDir, { recursive: true });

  for (const pipeline of toProcess) {
    console.log(`\n📖 ${pipeline.title} (Gutenberg #${pipeline.gutenbergId})`);

    const rawText = await downloadBook(pipeline.gutenbergId, pipeline.id);
    const stripped = stripGutenbergBoilerplate(rawText);
    const book = pipeline.transform(stripped);

    const mainChapters = book.chapters.filter((c) => !c.isPreface);
    const prefaceChapters = book.chapters.filter((c) => c.isPreface);
    console.log(`  ${book.chapters.length} sections (${mainChapters.length} chapters, ${prefaceChapters.length} preface)`);

    for (const ch of book.chapters.slice(0, 3)) {
      const tag = ch.isPreface ? " [preface]" : "";
      console.log(`    "${ch.title}" — ${ch.paragraphs.length} paragraphs${tag}`);
    }
    if (book.chapters.length > 3) console.log(`    ... and ${book.chapters.length - 3} more`);

    const outFile = path.join(outDir, `${pipeline.id}.json`);
    fs.writeFileSync(outFile, JSON.stringify(book, null, 2), "utf-8");
    console.log(`  ✅ ${outFile}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

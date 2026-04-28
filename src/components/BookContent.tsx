import type { BookChapter } from "../data/books";
import TinySegmenter from "tiny-segmenter";

const WORD_TRIM_REGEX = /^[.,;:!?¿¡"'«»—-]+|[.,;:!?¿¡"'«»—-]+$/g;

function normalizeWord(value: string): string {
  return value.replace(WORD_TRIM_REGEX, "").toLowerCase();
}

// Singleton segmenter instance (lazy-init)
let _segmenter: InstanceType<typeof TinySegmenter> | null = null;
function getSegmenter(): InstanceType<typeof TinySegmenter> {
  if (!_segmenter) _segmenter = new TinySegmenter();
  return _segmenter;
}

/**
 * Split a paragraph into word segments suitable for [data-word] spans.
 * - Space-delimited languages (Spanish, English): split on whitespace
 * - Japanese: use TinySegmenter for morphological tokenization
 */
function splitIntoWordSegments(paragraph: string, language?: string): string[] {
  if (language === "ja") {
    return getSegmenter().segment(paragraph);
  }
  // Default: split on whitespace, preserving spaces as segments
  return paragraph.split(/(\s+)/);
}

/** Check if a segment is whitespace (should not be wrapped in a data-word span) */
function isWhitespaceSegment(segment: string, language?: string): boolean {
  if (language === "ja") {
    // In Japanese, punctuation marks and brackets are their own segments
    // but they're not "whitespace" — they just shouldn't be trimmed
    return /^\s+$/.test(segment);
  }
  return /^\s+$/.test(segment);
}

interface Props {
  chapter: BookChapter;
  fontSize: number;
  paragraphIndices?: number[];
  trackedWords?: ReadonlySet<string>;
  showTitle?: boolean;
  /** View mode: "single" (default) or "parallel" */
  viewMode?: "single" | "parallel";
  /** English paragraphs for parallel view */
  englishParagraphs?: string[];
  /** Language code for tokenization (e.g. "ja", "es") */
  language?: string;
}

export function BookContent({
  chapter,
  fontSize,
  paragraphIndices,
  trackedWords,
  showTitle = true,
  viewMode = "single",
  englishParagraphs,
  language,
}: Props) {
  const visibleParagraphIndices =
    paragraphIndices ?? chapter.paragraphs.map((_, index) => index);

  if (viewMode === "parallel" && englishParagraphs && englishParagraphs.length > 0) {
    return (
      <ParallelView
        chapter={chapter}
        englishParagraphs={englishParagraphs}
        fontSize={fontSize}
        trackedWords={trackedWords}
        language={language}
      />
    );
  }

  // Single column view (existing)
  return (
    <article
      className="prose prose-stone dark:prose-invert mx-auto max-w-2xl px-4 py-4 sm:py-6"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      {showTitle && <h2 className="mb-6 text-center text-xl font-bold">{chapter.title}</h2>}
      {visibleParagraphIndices.map((paragraphIndex) => {
        const para = chapter.paragraphs[paragraphIndex];
        return (
          <p
            key={paragraphIndex}
            data-paragraph={paragraphIndex}
            className="mb-4 text-justify"
          >
            {splitIntoWordSegments(para, language).map((segment, j) =>
              isWhitespaceSegment(segment, language) ? (
                segment
              ) : (
                <span
                  key={j}
                  data-word=""
                  className={
                    trackedWords?.has(normalizeWord(segment))
                      ? "rounded bg-emerald-100 px-0.5 dark:bg-emerald-900/50"
                      : undefined
                  }
                >
                  {segment}
                </span>
              )
            )}
          </p>
        );
      })}
    </article>
  );
}

/** Parallel view: one row per paragraph pair, each row is a 3-column grid. */
function ParallelView({
  chapter,
  englishParagraphs,
  fontSize,
  trackedWords,
  language,
}: {
  chapter: BookChapter;
  englishParagraphs: string[];
  fontSize: number;
  trackedWords?: ReadonlySet<string>;
  language?: string;
}) {
  const originalParas = chapter.paragraphs;
  const englishParas = englishParagraphs;
  const n = Math.min(originalParas.length, englishParas.length);

  const renderWord = (text: string, lang?: string) =>
    splitIntoWordSegments(text, lang).map((segment, j) =>
      isWhitespaceSegment(segment, lang) ? (
        segment
      ) : (
        <span
          key={j}
          data-word=""
          className={
            trackedWords?.has(normalizeWord(segment))
              ? "rounded bg-emerald-100 px-0.5 dark:bg-emerald-900/50"
              : undefined
          }
        >
          {segment}
        </span>
      )
    );

  return (
    <div className="parallel-view" style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}>
      <div className="parallel-title">
        <div className="parallel-title-es">{chapter.title}</div>
        <div className="parallel-gutter-vertical" />
        <div className="parallel-title-en">{chapter.titleEn ?? "CHAPTER"}</div>
      </div>
      {originalParas.slice(0, n).map((origPara, i) => (
        <div key={i} className="parallel-row">
          {/* Original language column */}
          <div className="parallel-col-es">
            <p data-paragraph={i} style={{ margin: 0, overflowWrap: "break-word", hyphens: "auto" }}>
              {renderWord(origPara, language)}
            </p>
          </div>
          {/* Gutter */}
          <div className="parallel-gutter-vertical" />
          {/* English column */}
          <div className="parallel-col-en">
            <p data-paragraph={i} style={{ margin: 0, overflowWrap: "break-word", hyphens: "auto" }}>
              {renderWord(englishParas[i] ?? "")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

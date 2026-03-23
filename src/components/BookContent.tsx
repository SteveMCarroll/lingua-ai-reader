import type { BookChapter } from "../data/books";

const WORD_TRIM_REGEX = /^[.,;:!?¿¡"'«»—-]+|[.,;:!?¿¡"'«»—-]+$/g;

function normalizeWord(value: string): string {
  return value.replace(WORD_TRIM_REGEX, "").toLowerCase();
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
}

export function BookContent({
  chapter,
  fontSize,
  paragraphIndices,
  trackedWords,
  showTitle = true,
  viewMode = "single",
  englishParagraphs,
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
            {para.split(/(\s+)/).map((segment, j) =>
              /^\s+$/.test(segment) ? (
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
}: {
  chapter: BookChapter;
  englishParagraphs: string[];
  fontSize: number;
  trackedWords?: ReadonlySet<string>;
}) {
  const spanishParas = chapter.paragraphs;
  const englishParas = englishParagraphs;
  const n = Math.min(spanishParas.length, englishParas.length);

  const renderWord = (text: string) =>
    text.split(/(\s+)/).map((segment, j) =>
      /^\s+$/.test(segment) ? (
        segment
      ) : (
        <span
          key={j}
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
      {spanishParas.slice(0, n).map((esPara, i) => (
        <div key={i} className="parallel-row">
          {/* Spanish column */}
          <div className="parallel-col-es">
            <p style={{ margin: 0, overflowWrap: "break-word", hyphens: "auto" }}>
              {renderWord(esPara)}
            </p>
          </div>
          {/* Gutter */}
          <div className="parallel-gutter-vertical" />
          {/* English column */}
          <div className="parallel-col-en">
            <p style={{ margin: 0, overflowWrap: "break-word", hyphens: "auto" }}>
              {renderWord(englishParas[i] ?? "")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

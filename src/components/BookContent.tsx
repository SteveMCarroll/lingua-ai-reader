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
}

export function BookContent({
  chapter,
  fontSize,
  paragraphIndices,
  trackedWords,
  showTitle = true,
}: Props) {
  const visibleParagraphIndices =
    paragraphIndices ?? chapter.paragraphs.map((_, index) => index);

  return (
    <article
      className="prose prose-stone dark:prose-invert mx-auto max-w-2xl px-4 py-4 sm:py-6"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      {showTitle && <h2 className="mb-6 text-center text-xl font-bold">{chapter.title}</h2>}
      {visibleParagraphIndices.map((paragraphIndex) => {
        const para = chapter.paragraphs[paragraphIndex];
        return (
        <p key={paragraphIndex} data-paragraph={paragraphIndex} className="mb-4 text-justify">
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

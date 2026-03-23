import { useRef, useEffect } from "react";
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

/** Parallel view: both languages shown as continuous columns, each paragraph bottom-padded to align pairs. */
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
  // One ref per paragraph pair
  const esRef = useRef<(HTMLDivElement | null)[]>([]);
  const enRef = useRef<(HTMLDivElement | null)[]>([]);
  if (esRef.current.length !== n) esRef.current = Array(n).fill(null);
  if (enRef.current.length !== n) enRef.current = Array(n).fill(null);

  // After mount: pad shorter paragraphs so next pair aligns vertically
  useEffect(() => {
    const esCumulative: number[] = [];
    const enCumulative: number[] = [];
    for (let i = 0; i < n; i++) {
      const esEl = esRef.current[i];
      const enEl = enRef.current[i];
      const esH = esEl?.offsetHeight ?? 0;
      const enH = enEl?.offsetHeight ?? 0;
      esCumulative.push((i > 0 ? esCumulative[i - 1] : 0) + esH);
      enCumulative.push((i > 0 ? enCumulative[i - 1] : 0) + enH);
    }
    for (let i = 0; i < n; i++) {
      const target = Math.max(esCumulative[i], enCumulative[i]);
      const esEl = esRef.current[i];
      const enEl = enRef.current[i];
      if (esEl) {
        const esPad = target - (i > 0 ? esCumulative[i - 1] : 0);
        const extra = esPad - esEl.offsetHeight;
        esEl.style.marginBottom = extra > 1 ? `${extra}px` : "0px";
      }
      if (enEl) {
        const enPad = target - (i > 0 ? enCumulative[i - 1] : 0);
        const extra = enPad - enEl.offsetHeight;
        enEl.style.marginBottom = extra > 1 ? `${extra}px` : "0px";
      }
    }
  }, [n]);

  const renderPara = (text: string, className: string) => (
    <p className={className} style={{ marginBottom: 0 }}>
      {text.split(/(\s+)/).map((segment, j) =>
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
      )}
    </p>
  );

  return (
    <div className="parallel-view" style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}>
      <div className="parallel-title">
        <div className="parallel-title-es">{chapter.title}</div>
        <div className="parallel-title-en">{chapter.titleEn ?? "CHAPTER"}</div>
      </div>
      <div className="parallel-body">
        <div className="parallel-col-es">
          {spanishParas.slice(0, n).map((para, i) => (
            <div key={i} ref={(el) => { esRef.current[i] = el; }} style={{ overflowWrap: "break-word", hyphens: "auto" }}>
              {renderPara(para, "mb-0")}
            </div>
          ))}
        </div>
        <div className="parallel-gutter-vertical" />
        <div className="parallel-col-en">
          {englishParas.slice(0, n).map((para, i) => (
            <div key={i} ref={(el) => { enRef.current[i] = el; }} style={{ overflowWrap: "break-word", hyphens: "auto" }}>
              {renderPara(para, "mb-0")}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

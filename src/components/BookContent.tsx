import type { BookChapter } from "../data/books";

interface Props {
  chapter: BookChapter;
  fontSize: number;
}

export function BookContent({ chapter, fontSize }: Props) {
  return (
    <article
      className="prose prose-stone dark:prose-invert mx-auto max-w-2xl px-4 py-6"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      <h2 className="mb-6 text-center text-xl font-bold">{chapter.title}</h2>
      {chapter.paragraphs.map((para, i) => (
        <p key={i} data-paragraph={i} className="mb-4 text-justify">
          {para.split(/(\s+)/).map((segment, j) =>
            /^\s+$/.test(segment) ? (
              segment
            ) : (
              <span key={j} data-word="">
                {segment}
              </span>
            )
          )}
        </p>
      ))}
    </article>
  );
}

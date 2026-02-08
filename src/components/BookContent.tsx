import { useEffect, useState } from "react";

interface Chapter {
  index: number;
  title: string;
  paragraphs: string[];
}

interface Props {
  bookId: string;
  chapterIndex: number;
  fontSize: number;
}

export function BookContent({ bookId, chapterIndex, fontSize }: Props) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const paddedIndex = String(chapterIndex).padStart(2, "0");
    import(`../data/content/${bookId}/chapter-${paddedIndex}.json`)
      .then((mod) => {
        setChapter(mod.default || mod);
        setLoading(false);
      })
      .catch(() => {
        setError(`Could not load chapter ${chapterIndex}`);
        setLoading(false);
      });
  }, [bookId, chapterIndex]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-blue-500" />
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="py-12 text-center text-sm text-red-500">
        {error || "Chapter not found"}
      </div>
    );
  }

  return (
    <article
      className="prose prose-stone dark:prose-invert mx-auto max-w-2xl px-4 py-6"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      <h2 className="mb-6 text-center text-xl font-bold">{chapter.title}</h2>
      {chapter.paragraphs.map((para, i) => (
        <p key={i} data-paragraph={i} className="mb-4 text-justify">
          {para}
        </p>
      ))}
    </article>
  );
}

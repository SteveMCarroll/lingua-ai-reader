import { useMemo } from "react";
import { books, type BookMeta } from "../data/books";

const PROGRESS_PREFIX = "reading-progress:";

interface StoredProgress {
  chapterIndex: number;
  pageIndex: number;
}

function getStoredProgress(bookId: string): StoredProgress | null {
  try {
    const raw = localStorage.getItem(`${PROGRESS_PREFIX}${bookId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "chapterIndex" in parsed &&
      "pageIndex" in parsed &&
      typeof parsed.chapterIndex === "number" &&
      typeof parsed.pageIndex === "number"
    ) {
      return {
        chapterIndex: parsed.chapterIndex,
        pageIndex: parsed.pageIndex,
      };
    }
  } catch {
    // ignore malformed state
  }
  return null;
}

interface Props {
  onSelectBook: (book: BookMeta) => void;
}

export function BookSelector({ onSelectBook }: Props) {
  const progressByBook = useMemo(
    () =>
      Object.fromEntries(
        books.map((book) => [book.id, getStoredProgress(book.id)])
      ) as Record<string, StoredProgress | null>,
    []
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h2 className="mb-6 text-center text-2xl font-bold text-stone-800 dark:text-stone-200">
        Escoge un libro
      </h2>
      <div className="space-y-4">
        {books.map((book) => {
          const progress = progressByBook[book.id];
          return (
            <button
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="w-full rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:scale-[0.98] dark:border-stone-700 dark:bg-stone-900 dark:hover:border-blue-600"
            >
              <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {book.title}
              </h3>
              <p className="mt-0.5 text-sm text-stone-500">{book.author}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {book.description}
              </p>
              {progress && (
                <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  Continúa en capítulo {progress.chapterIndex + 1}, página {progress.pageIndex + 1}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

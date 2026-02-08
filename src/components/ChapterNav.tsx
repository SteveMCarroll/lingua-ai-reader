import type { BookMeta } from "../data/books";

interface Props {
  book: BookMeta;
  currentChapter: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapterIndex: number) => void;
}

export function ChapterNav({ book, currentChapter, isOpen, onClose, onSelectChapter }: Props) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} />
      )}

      {/* Slide-in drawer */}
      <nav
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col bg-white shadow-xl transition-transform duration-200 dark:bg-stone-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
            Capítulos
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {book.chapters.map((ch) => (
            <button
              key={ch.index}
              onClick={() => {
                onSelectChapter(ch.index);
                onClose();
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                ch.index === currentChapter
                  ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
            >
              {ch.title}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

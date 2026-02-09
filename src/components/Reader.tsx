import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BookMeta, BookData, BookChapter } from "../data/books";
import { loadBook } from "../data/books";
import { BookContent } from "./BookContent";
import { ChapterNav } from "./ChapterNav";
import { GlossPopup } from "./GlossPopup";
import { SettingsPanel } from "./SettingsPanel";
import { useTextSelection } from "../hooks/useTextSelection";
import { useGloss } from "../hooks/useGloss";
import { useReadingPosition } from "../hooks/useReadingPosition";

interface Props {
  bookMeta: BookMeta;
  onBack: () => void;
}

export function Reader({ bookMeta, onBack }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Book loading
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    setBookData(null);
    setBookError(null);
    loadBook(bookMeta.id)
      .then(setBookData)
      .catch(() => setBookError("Could not load book"));
  }, [bookMeta.id]);

  // Settings
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("settings:fontSize");
    return saved ? parseInt(saved, 10) : 18;
  });
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("settings:dark");
    return saved ? saved === "true" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Chapter navigation
  const { getLastChapter } = useReadingPosition(bookMeta.id, 0);
  const [chapterIndex, setChapterIndex] = useState(() => {
    return getLastChapter(bookMeta.id);
  });
  const [showPreface, _setShowPreface] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Filtered chapters (skip preface by default)
  const displayChapters = useMemo(() => {
    if (!bookData) return [];
    return bookData.chapters
      .map((ch, i) => ({ ...ch, originalIndex: i }))
      .filter((ch) => showPreface || !ch.isPreface);
  }, [bookData, showPreface]);

  // Current position within displayChapters
  const displayIdx = useMemo(
    () => displayChapters.findIndex((ch) => ch.originalIndex === chapterIndex),
    [displayChapters, chapterIndex]
  );

  // If current chapter is hidden (preface filtered out), jump to first visible
  useEffect(() => {
    if (displayChapters.length > 0 && displayIdx === -1) {
      setChapterIndex(displayChapters[0].originalIndex);
    }
  }, [displayChapters, displayIdx]);

  // Text selection + glossing
  const { selection, clearSelection } = useTextSelection(contentRef);
  const { gloss, loading, error, requestGloss, clearGloss } = useGloss();

  // Reading position tracking
  useReadingPosition(bookMeta.id, chapterIndex);

  // When selection changes, request gloss
  const prevSelRef = useRef<string>("");
  useEffect(() => {
    if (selection && selection.text && selection.text !== prevSelRef.current) {
      prevSelRef.current = selection.text;
      requestGloss({
        selectedText: selection.text,
        sentence: selection.sentence,
        bookTitle: bookMeta.title,
        author: bookMeta.author,
        bookId: bookMeta.id,
      });
    }
  }, [selection, bookMeta, requestGloss]);

  const handleCloseGloss = useCallback(() => {
    clearSelection();
    clearGloss();
    prevSelRef.current = "";
  }, [clearSelection, clearGloss]);

  const handleFontSize = useCallback((size: number) => {
    setFontSize(size);
    localStorage.setItem("settings:fontSize", String(size));
  }, []);

  const handleToggleDark = useCallback(() => {
    setIsDark((d) => {
      const next = !d;
      localStorage.setItem("settings:dark", String(next));
      return next;
    });
  }, []);

  // Chapter navigation helpers
  const prevChapter = displayIdx > 0 ? displayChapters[displayIdx - 1] : null;
  const nextChapter =
    displayIdx >= 0 && displayIdx < displayChapters.length - 1
      ? displayChapters[displayIdx + 1]
      : null;

  const currentChapter: BookChapter | undefined = bookData?.chapters[chapterIndex];

  // Loading state — still render full layout so contentRef stays mounted
  const isLoading = !bookData;

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-stone-50/95 px-3 py-2.5 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNavOpen(true)}
              className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label="Open chapters"
              disabled={isLoading}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={onBack}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              ← Books
            </button>
          </div>

          <h1 className="truncate px-2 text-sm font-medium text-stone-600 dark:text-stone-400">
            {bookMeta.title}
          </h1>

          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </header>

        {/* Chapter navigation drawer */}
        {bookData && (
          <ChapterNav
            chapters={bookData.chapters}
            currentChapter={chapterIndex}
            isOpen={navOpen}
            onClose={() => setNavOpen(false)}
            onSelectChapter={setChapterIndex}
          />
        )}

        {/* Settings panel */}
        <SettingsPanel
          fontSize={fontSize}
          onFontSizeChange={handleFontSize}
          isDark={isDark}
          onToggleDark={handleToggleDark}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {/* Book content */}
        <div ref={contentRef}>
          {bookError ? (
            <div className="py-12 text-center text-sm text-red-500">{bookError}</div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-blue-500" />
            </div>
          ) : currentChapter ? (
            <BookContent chapter={currentChapter} fontSize={fontSize} />
          ) : null}
        </div>

        {/* Prev / Next chapter buttons */}
        {!isLoading && (
        <div className="flex justify-between border-t border-stone-200 px-4 py-4 dark:border-stone-800">
          {prevChapter ? (
            <button
              onClick={() => setChapterIndex(prevChapter.originalIndex)}
              className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              ← Anterior
            </button>
          ) : (
            <div />
          )}
          {nextChapter ? (
            <button
              onClick={() => setChapterIndex(nextChapter.originalIndex)}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Siguiente →
            </button>
          ) : (
            <div />
          )}
        </div>
        )}

        {/* Gloss popup */}
        <GlossPopup
          gloss={gloss}
          loading={loading}
          error={error}
          rect={selection?.rect ?? null}
          onClose={handleCloseGloss}
        />
      </div>
    </div>
  );
}

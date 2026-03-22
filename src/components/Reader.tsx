import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import type { BookMeta, BookData, BookChapter } from "../data/books";
import { loadBook } from "../data/books";
import type { GlossRequest, GlossResponse } from "../lib/api";
import { BookContent } from "./BookContent";
import { ChapterNav } from "./ChapterNav";
import { GlossPopup } from "./GlossPopup";
import { SettingsPanel } from "./SettingsPanel";
import { VocabPanel } from "./VocabPanel";
import { useTextSelection } from "../hooks/useTextSelection";
import { useGloss } from "../hooks/useGloss";
import { useReadingPosition } from "../hooks/useReadingPosition";
import { loadBookVocab, type BookVocabData, type VocabItem } from "../lib/vocab";

type ViewMode = "single" | "parallel";

const BASE_CHROME_HEIGHT = 220;
const TRACKED_WORDS_PREFIX = "tracked-words:";
const WORD_TRIM_REGEX = /^[.,;:!?¿¡"'«»—-]+|[.,;:!?¿¡"'«»—-]+$/g;

function normalizeWord(value: string): string {
  return value.replace(WORD_TRIM_REGEX, "").toLowerCase();
}

function getTrackedWordsKey(bookId: string): string {
  return `${TRACKED_WORDS_PREFIX}${bookId}`;
}

function loadTrackedWords(bookId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getTrackedWordsKey(bookId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((word): word is string => typeof word === "string"));
  } catch {
    return new Set();
  }
}

function saveTrackedWords(bookId: string, words: Set<string>) {
  try {
    localStorage.setItem(getTrackedWordsKey(bookId), JSON.stringify(Array.from(words)));
  } catch {
    // ignore storage errors
  }
}

function paginateParagraphs(paragraphs: string[], pageCharBudget: number): number[][] {
  if (paragraphs.length === 0) return [[]];

  const pages: number[][] = [];
  let currentPage: number[] = [];
  let currentChars = 0;

  paragraphs.forEach((paragraph, index) => {
    const paragraphChars = paragraph.length + 1;
    if (currentPage.length > 0 && currentChars + paragraphChars > pageCharBudget) {
      pages.push(currentPage);
      currentPage = [];
      currentChars = 0;
    }

    currentPage.push(index);
    currentChars += paragraphChars;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

function splitParagraphForPagination(paragraph: string, chunkTarget: number): string[] {
  if (paragraph.length <= chunkTarget * 1.2) return [paragraph];

  const sentenceMatches = paragraph.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!sentenceMatches || sentenceMatches.length < 2) return [paragraph];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentenceMatches) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
      continue;
    }

    if (`${current} ${trimmed}`.length <= chunkTarget) {
      current = `${current} ${trimmed}`;
    } else {
      chunks.push(current);
      current = trimmed;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [paragraph];
}

function createPaginationParagraphs(paragraphs: string[], pageCharBudget: number): string[] {
  const chunkTarget = Math.max(500, Math.floor(pageCharBudget * 0.62));
  return paragraphs.flatMap((paragraph) => splitParagraphForPagination(paragraph, chunkTarget));
}

function getPageCharBudget(fontSize: number, viewportWidth: number, viewportHeight: number): number {
  const isMobilePortrait = viewportWidth <= 430 && viewportHeight > viewportWidth;
  const chromeHeight = isMobilePortrait ? 165 : BASE_CHROME_HEIGHT;
  const usableHeight = Math.max(320, viewportHeight - chromeHeight);
  const lineHeight = fontSize * 1.8;
  const linesPerPage = usableHeight / lineHeight;
  const charsPerLine = viewportWidth < 430 ? 40 : viewportWidth < 640 ? 34 : viewportWidth < 1024 ? 46 : 60;
  const fillBoost = isMobilePortrait ? 1.45 : 1.12;
  const mobileMinChars = Math.max(650, Math.min(1250, Math.floor(1050 * (18 / fontSize))));
  const minChars = isMobilePortrait ? mobileMinChars : 700;
  return Math.max(minChars, Math.floor(linesPerPage * charsPerLine * fillBoost));
}

function getPanelVocab(items: VocabItem[], maxItems: number): VocabItem[] {
  return items
    .filter((item) => (item.dictionary_zipf ?? item.modern_zipf) <= 3.7)
    .sort((a, b) => b.count - a.count || b.score - a.score)
    .slice(0, maxItems);
}

interface Props {
  bookMeta: BookMeta;
  onBack: () => void;
}

export function Reader({ bookMeta, onBack }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Book loading
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBook(bookMeta.id)
      .then((data) => {
        if (cancelled) return;
        setBookData(data);
        setBookError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setBookData(null);
        setBookError("Could not load book");
      });

    return () => {
      cancelled = true;
    };
  }, [bookMeta.id]);

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Settings
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("settings:fontSize");
    return saved ? parseInt(saved, 10) : 18;
  });
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("settings:dark");
    return saved ? saved === "true" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // View mode (single column vs parallel side-by-side)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("settings:viewMode");
    return (saved === "parallel" ? "parallel" : "single") as ViewMode;
  });

  // Chapter/page navigation
  const { getLastPosition, savePosition } = useReadingPosition(bookMeta.id);
  const initialPosition = useMemo(() => getLastPosition(), [getLastPosition]);
  const [chapterIndex, setChapterIndex] = useState(() => initialPosition.chapterIndex);
  const [pageIndex, setPageIndex] = useState(() => initialPosition.pageIndex);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vocabOpen, setVocabOpen] = useState(false);
  const [vocabScope, setVocabScope] = useState<"book" | "chapter">("chapter");
  const [vocabByBook, setVocabByBook] = useState<{
    bookId: string;
    data: BookVocabData | null;
    error: string | null;
  } | null>(null);
  const showPreface = false;

  const [trackedWords, setTrackedWords] = useState<Set<string>>(() => loadTrackedWords(bookMeta.id));

  useEffect(() => {
    let cancelled = false;
    loadBookVocab(bookMeta.id).then((data) => {
      if (cancelled) return;
      setVocabByBook({ bookId: bookMeta.id, data, error: null });
    });

    return () => {
      cancelled = true;
    };
  }, [bookMeta.id]);

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

  const effectiveDisplayIdx = displayIdx === -1 && displayChapters.length > 0 ? 0 : displayIdx;
  const effectiveChapterIndex =
    displayIdx === -1 && displayChapters.length > 0
      ? displayChapters[0].originalIndex
      : chapterIndex;

  const currentChapter: BookChapter | undefined = bookData?.chapters[effectiveChapterIndex];

  // Eagerly load English via Vite glob (static bundle)
  const englishByBookId = useMemo(() => {
    const modules = import.meta.glob("../data/content/*-en.json", { eager: true }) as Record<
      string,
      { default: { chapters: { paragraphs: string[] }[] } }
    >;
    const byBookId: Record<string, string[]> = {};
    for (const [path, mod] of Object.entries(modules)) {
      const bookId = path.replace("../data/content/", "").replace("-en.json", "");
      byBookId[bookId] = mod.default.chapters.map((c) => c.paragraphs.join("\n\n"));
    }
    return byBookId;
  }, []);

  // Derive English paragraphs for current chapter
  const englishParagraphs = useMemo(() => {
    if (viewMode !== "parallel") return [] as string[];
    if (!bookMeta || effectiveChapterIndex === undefined) return [] as string[];
    const paras = englishByBookId[bookMeta.id];
    if (!paras || paras[effectiveChapterIndex] === undefined) return [] as string[];
    return paras[effectiveChapterIndex].split("\n\n");
  }, [viewMode, bookMeta, effectiveChapterIndex, englishByBookId]);

  // Compute aligned Spanish paragraphs: merge chapter paragraphs proportionally to match English count
  const alignedSpanishParagraphs = useMemo(() => {
    if (viewMode !== "parallel") return [] as string[];
    if (!currentChapter || englishParagraphs.length === 0) return [] as string[];
    const es = currentChapter.paragraphs;
    const en = englishParagraphs.length;
    if (es.length === en) return es;
    const aligned: string[] = [];
    for (let i = 0; i < en; i++) {
      const start = Math.floor((i * es.length) / en);
      const end = Math.floor(((i + 1) * es.length) / en);
      const chunk = es.slice(start, end);
      aligned.push(chunk.length > 0 ? chunk.join("\n\n") : "");
    }
    return aligned;
  }, [viewMode, currentChapter, englishParagraphs]);

  const englishError = useMemo(() => {
    if (viewMode !== "parallel") return null;
    if (!bookMeta || effectiveChapterIndex === undefined) return null;
    if (englishByBookId[bookMeta.id]?.[effectiveChapterIndex] !== undefined) return null;
    return `English not available for chapter ${effectiveChapterIndex + 1}`;
  }, [viewMode, bookMeta, effectiveChapterIndex, englishByBookId]);

  const pageCharBudget = useMemo(
    () => getPageCharBudget(fontSize, viewport.width, viewport.height),
    [fontSize, viewport.height, viewport.width]
  );
  const paginationParagraphs = useMemo(
    () => (currentChapter ? createPaginationParagraphs(currentChapter.paragraphs, pageCharBudget) : []),
    [currentChapter, pageCharBudget]
  );
  const paginatedChapter = useMemo(
    () => (currentChapter ? { ...currentChapter, paragraphs: paginationParagraphs } : undefined),
    [currentChapter, paginationParagraphs]
  );
  const chapterPages = useMemo(
    () => (paginationParagraphs.length > 0 ? paginateParagraphs(paginationParagraphs, pageCharBudget) : [[]]),
    [paginationParagraphs, pageCharBudget]
  );
  const maxPageIndex = Math.max(chapterPages.length - 1, 0);
  const activePageIndex = Math.max(0, Math.min(pageIndex, maxPageIndex));
  const totalPages = Math.max(chapterPages.length, 1);
  const currentPageParagraphIndices = chapterPages[activePageIndex] ?? [];

  // Text selection + glossing
  const { selection, clearSelection } = useTextSelection(contentRef);

  const rememberTrackedWords = useCallback(
    (result: GlossResponse, req: GlossRequest & { bookId: string }) => {
      const selected = normalizeWord(req.selectedText);
      const dictionary = normalizeWord(result.dictionaryForm);
      if (!selected && !dictionary) return;

      setTrackedWords((prev) => {
        const next = new Set(prev);
        if (selected) next.add(selected);
        if (dictionary) next.add(dictionary);
        saveTrackedWords(req.bookId, next);
        return next;
      });
    },
    []
  );

  const { gloss, loading, error, requestGloss, clearGloss } = useGloss(rememberTrackedWords);

    useEffect(() => {
    if (bookData) {
      savePosition(effectiveChapterIndex, activePageIndex);
    }
  }, [activePageIndex, bookData, effectiveChapterIndex, savePosition]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePageIndex, effectiveChapterIndex]);

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

  const openChapter = useCallback(
    (nextChapterIndex: number, nextPageIndex = 0) => {
      setChapterIndex(nextChapterIndex);
      setPageIndex(nextPageIndex);
      handleCloseGloss();
    },
    [handleCloseGloss]
  );

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

  const handleToggleViewMode = useCallback(() => {
    setViewMode((mode) => {
      const next = mode === "single" ? "parallel" : "single";
      localStorage.setItem("settings:viewMode", next);
      return next;
    });
  }, []);

  // Chapter navigation helpers
  const prevChapter = effectiveDisplayIdx > 0 ? displayChapters[effectiveDisplayIdx - 1] : null;
  const nextChapter =
    effectiveDisplayIdx >= 0 && effectiveDisplayIdx < displayChapters.length - 1
      ? displayChapters[effectiveDisplayIdx + 1]
      : null;

  const goToPrevPage = useCallback(() => {
    if (activePageIndex > 0) {
      setPageIndex(activePageIndex - 1);
      handleCloseGloss();
      return;
    }
    if (prevChapter) {
      openChapter(prevChapter.originalIndex, 0);
    }
  }, [activePageIndex, handleCloseGloss, openChapter, prevChapter]);

  const goToNextPage = useCallback(() => {
    if (activePageIndex < maxPageIndex) {
      setPageIndex(activePageIndex + 1);
      handleCloseGloss();
      return;
    }
    if (nextChapter) {
      openChapter(nextChapter.originalIndex, 0);
    }
  }, [activePageIndex, handleCloseGloss, maxPageIndex, nextChapter, openChapter]);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) goToNextPage();
      else goToPrevPage();
    },
    [goToNextPage, goToPrevPage]
  );

  // Loading state — still render full layout so contentRef stays mounted
  const isLoading = !bookData;
  const chapterCount = displayChapters.length || (bookData?.chapters.length ?? 0);
  const chapterNumber =
    effectiveDisplayIdx >= 0 ? effectiveDisplayIdx + 1 : Math.max(1, effectiveChapterIndex + 1);
  const canGoPrev = activePageIndex > 0 || Boolean(prevChapter);
  const canGoNext = activePageIndex < maxPageIndex || Boolean(nextChapter);
  const vocabLoading = !vocabByBook || vocabByBook.bookId !== bookMeta.id;
  const vocabData = vocabByBook?.bookId === bookMeta.id ? vocabByBook.data : null;
  const vocabError = vocabByBook?.bookId === bookMeta.id ? vocabByBook.error : null;
  const bookVocab = useMemo(
    () => getPanelVocab(vocabData?.book_vocab.vocabulary ?? [], 24),
    [vocabData]
  );
  const chapterVocab = useMemo(() => {
    const chapterItems =
      vocabData?.chapters.find((chapter) => chapter.chapter_index === effectiveChapterIndex)?.vocabulary ?? [];
    return getPanelVocab(chapterItems, 16);
  }, [effectiveChapterIndex, vocabData]);

  const openVocabPanel = useCallback((scope: "book" | "chapter") => {
    setVocabScope(scope);
    setVocabOpen(true);
  }, []);

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

          <div className="flex items-center gap-1.5">
            {/* View mode toggle */}
            <button
              onClick={handleToggleViewMode}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "parallel"
                  ? "bg-blue-500 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              }`}
              title={viewMode === "parallel" ? "Switch to single column" : "Switch to parallel view"}
            >
              {viewMode === "parallel" ? "⇉ Side-by-side" : "☰ Single"}
            </button>
          </div>

          <div className="min-w-0 px-2 text-center">
            <h1 className="truncate text-sm font-medium text-stone-600 dark:text-stone-400">
              {bookMeta.title}
            </h1>
            {!isLoading && chapterCount > 0 && (
              <p className="text-xs text-stone-500 dark:text-stone-500">
                Cap. {chapterNumber}/{chapterCount} · Pág. {activePageIndex + 1}/{totalPages}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => openVocabPanel("book")}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              aria-label="Open book vocabulary panel"
            >
              Book vocab
            </button>
            <button
              onClick={() => openVocabPanel("chapter")}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              aria-label="Open chapter vocabulary panel"
            >
              Chapter vocab
            </button>
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
          </div>
        </header>

        {/* Chapter navigation drawer */}
        {bookData && (
          <ChapterNav
            chapters={bookData.chapters}
            currentChapter={effectiveChapterIndex}
            isOpen={navOpen}
            onClose={() => setNavOpen(false)}
            onSelectChapter={(selectedChapter) => openChapter(selectedChapter, 0)}
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
        <VocabPanel
          isOpen={vocabOpen}
          scope={vocabScope}
          loading={vocabLoading}
          error={vocabError}
          bookTitle={bookMeta.title}
          chapterTitle={currentChapter?.title ?? `Capítulo ${effectiveChapterIndex + 1}`}
          bookVocab={bookVocab}
          chapterVocab={chapterVocab}
          onClose={() => setVocabOpen(false)}
        />

        {/* Book content */}
        <div ref={contentRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {bookError ? (
            <div className="py-12 text-center text-sm text-red-500">{bookError}</div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-blue-500" />
            </div>
          ) : paginatedChapter ? (
            viewMode === "parallel" && englishParagraphs.length > 0 ? (
              <BookContent
                chapter={currentChapter ?? paginatedChapter}
                fontSize={fontSize}
                trackedWords={trackedWords}
                showTitle={true}
                viewMode="parallel"
                englishParagraphs={englishParagraphs}
                alignedSpanishParagraphs={alignedSpanishParagraphs}
              />
            ) : viewMode === "parallel" && englishError ? (
              <div className="py-8 text-center text-sm text-stone-500">
                {englishError} — falling back to single column.
                <br />
                <button
                  onClick={handleToggleViewMode}
                  className="mt-2 text-blue-500 underline"
                >
                  Switch to single column
                </button>
              </div>
            ) : (
              <BookContent
                chapter={paginatedChapter}
                fontSize={fontSize}
                paragraphIndices={currentPageParagraphIndices}
                trackedWords={trackedWords}
                showTitle={activePageIndex === 0}
              />
            )
          ) : null}
        </div>

        {/* Page / chapter controls */}
        {!isLoading && (
          <div className="flex items-center justify-between border-t border-stone-200 px-4 py-4 dark:border-stone-800">
            <button
              onClick={goToPrevPage}
              disabled={!canGoPrev}
              className="rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              {activePageIndex > 0 ? "← Página anterior" : "← Capítulo anterior"}
            </button>

            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {activePageIndex + 1}/{totalPages}
            </span>

            <button
              onClick={goToNextPage}
              disabled={!canGoNext}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {activePageIndex < maxPageIndex ? "Página siguiente →" : "Capítulo siguiente →"}
            </button>
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

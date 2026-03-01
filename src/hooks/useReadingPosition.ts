import { useCallback } from "react";

const PROGRESS_PREFIX = "reading-progress:";
const LEGACY_POSITION_PREFIX = "reading-pos:";
const LEGACY_MAX_CHAPTER_SCAN = 200;

export interface ReadingPosition {
  chapterIndex: number;
  pageIndex: number;
}

function getProgressKey(bookId: string): string {
  return `${PROGRESS_PREFIX}${bookId}`;
}

function getLegacyKey(bookId: string, chapterIndex: number): string {
  return `${LEGACY_POSITION_PREFIX}${bookId}:${chapterIndex}`;
}

function parseStoredProgress(raw: string | null): ReadingPosition | null {
  if (!raw) return null;
  try {
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
        chapterIndex: Math.max(0, parsed.chapterIndex),
        pageIndex: Math.max(0, parsed.pageIndex),
      };
    }
  } catch {
    // ignore malformed state
  }
  return null;
}

export function useReadingPosition(bookId: string) {
  const savePosition = useCallback(
    (chapterIndex: number, pageIndex: number) => {
      localStorage.setItem(
        getProgressKey(bookId),
        JSON.stringify({
          chapterIndex: Math.max(0, chapterIndex),
          pageIndex: Math.max(0, pageIndex),
          updatedAt: Date.now(),
        })
      );
    },
    [bookId]
  );

  const getLastPosition = useCallback((): ReadingPosition => {
    const stored = parseStoredProgress(localStorage.getItem(getProgressKey(bookId)));
    if (stored) return stored;

    for (let i = LEGACY_MAX_CHAPTER_SCAN; i >= 0; i--) {
      if (localStorage.getItem(getLegacyKey(bookId, i))) {
        return { chapterIndex: i, pageIndex: 0 };
      }
    }

    return { chapterIndex: 0, pageIndex: 0 };
  }, [bookId]);

  return { getLastPosition, savePosition };
}

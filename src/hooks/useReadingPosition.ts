import { useEffect, useCallback } from "react";

const POSITION_PREFIX = "reading-pos:";

function getKey(bookId: string, chapterIndex: number): string {
  return `${POSITION_PREFIX}${bookId}:${chapterIndex}`;
}

export function useReadingPosition(bookId: string, chapterIndex: number) {
  // Restore scroll position when chapter changes
  useEffect(() => {
    const key = getKey(bookId, chapterIndex);
    const saved = localStorage.getItem(key);
    if (saved) {
      const y = parseInt(saved, 10);
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
  }, [bookId, chapterIndex]);

  // Save scroll position periodically
  useEffect(() => {
    const key = getKey(bookId, chapterIndex);
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          localStorage.setItem(key, String(window.scrollY));
          ticking = false;
        });
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bookId, chapterIndex]);

  const getLastChapter = useCallback(
    (bookId: string): number => {
      // Find the most recent chapter the user was reading
      for (let i = 100; i >= 0; i--) {
        if (localStorage.getItem(getKey(bookId, i))) return i;
      }
      return 0;
    },
    []
  );

  return { getLastChapter };
}

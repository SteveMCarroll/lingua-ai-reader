import { useState, useCallback } from "react";
import { fetchGloss, type GlossRequest, type GlossResponse } from "../lib/api";

const CACHE_PREFIX = "gloss:";

function getCacheKey(bookId: string, sentence: string, selectedText: string): string {
  return `${CACHE_PREFIX}${bookId}:${sentence}:${selectedText}`;
}

type GlossRequestWithBook = GlossRequest & { bookId: string };
type OnGlossResolved = (gloss: GlossResponse, request: GlossRequestWithBook) => void;

export function useGloss(onGlossResolved?: OnGlossResolved) {
  const [gloss, setGloss] = useState<GlossResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestGloss = useCallback(
    async (req: GlossRequestWithBook) => {
      const cacheKey = getCacheKey(req.bookId, req.sentence, req.selectedText);

      // Check localStorage cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as GlossResponse;
          setGloss(parsed);
          onGlossResolved?.(parsed, req);
          setError(null);
          setLoading(false);
          return;
        }
      } catch {
        // ignore cache errors
      }

      setLoading(true);
      setError(null);
      setGloss(null);

      try {
        const result = await fetchGloss(req);
        setGloss(result);
        onGlossResolved?.(result, req);

        // Cache in localStorage
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // storage full — ignore
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get translation");
      } finally {
        setLoading(false);
      }
    },
    [onGlossResolved]
  );

  const clearGloss = useCallback(() => {
    setGloss(null);
    setError(null);
    setLoading(false);
  }, []);

  return { gloss, loading, error, requestGloss, clearGloss };
}

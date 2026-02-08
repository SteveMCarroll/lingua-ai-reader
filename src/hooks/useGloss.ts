import { useState, useCallback } from "react";
import { fetchGloss, type GlossRequest, type GlossResponse } from "../lib/api";

const CACHE_PREFIX = "gloss:";

function getCacheKey(bookId: string, sentence: string, selectedText: string): string {
  return `${CACHE_PREFIX}${bookId}:${sentence}:${selectedText}`;
}

export function useGloss() {
  const [gloss, setGloss] = useState<GlossResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestGloss = useCallback(
    async (req: GlossRequest & { bookId: string }) => {
      const cacheKey = getCacheKey(req.bookId, req.sentence, req.selectedText);

      // Check localStorage cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setGloss(JSON.parse(cached));
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
    []
  );

  const clearGloss = useCallback(() => {
    setGloss(null);
    setError(null);
    setLoading(false);
  }, []);

  return { gloss, loading, error, requestGloss, clearGloss };
}

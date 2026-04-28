export interface VocabItem {
  token: string;
  score: number;
  count: number;
  frequency_per_1000: number;
  modern_zipf: number;
  rarity_tag: string;
  is_tic: boolean;
  dictionary_form?: string;
  translation_en?: string;
  dictionary_zipf?: number;
  dictionary_rarity_tag?: string;
}

export interface ChapterVocab {
  chapter_index: number;
  chapter_title: string;
  total_tokens: number;
  vocabulary: VocabItem[];
}

export interface BookVocabData {
  book_id: string;
  title: string;
  author: string;
  book_vocab: {
    total_tokens: number;
    num_chapters: number;
    recommended_top: number;
    min_count: number;
    vocabulary: VocabItem[];
  };
  chapters: ChapterVocab[];
}

const vocabCache = new Map<string, Promise<BookVocabData | null>>();

export function loadBookVocab(bookId: string): Promise<BookVocabData | null> {
  if (vocabCache.has(bookId)) return vocabCache.get(bookId)!;

  const request = fetch(`/vocab/${bookId}.json`, { cache: "no-cache" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      // Defensive: vocab files must be objects with book_vocab, not bare arrays
      if (!data || typeof data !== "object" || Array.isArray(data) || !data.book_vocab) {
        return null;
      }
      return data as BookVocabData;
    })
    .catch(() => null);

  vocabCache.set(bookId, request);
  return request;
}

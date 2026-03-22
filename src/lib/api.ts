const API_BASE = "/api";

export interface GlossRequest {
  selectedText: string;
  sentence: string;
  bookTitle: string;
  author: string;
}

export interface GlossResponse {
  selected: string;
  dictionaryForm: string;
  partOfSpeech: string;
  grammar: string;
  ipa: string;
  translation: string;
  contextualMeaning: string;
  fullSentence: string;
  sentenceTranslation: string;
  wikipediaSlug?: string;
}

export async function fetchGloss(req: GlossRequest): Promise<GlossResponse> {
  const res = await fetch(`${API_BASE}/gloss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Gloss API error: ${res.status}`);
  }

  return res.json();
}

export interface ChapterContent {
  bookId: string;
  chapterIndex: number;
  spanish: string[];
  english: string[];
}

export async function fetchChapterContent(
  bookId: string,
  chapterIndex: number
): Promise<ChapterContent> {
  const res = await fetch(`${API_BASE}/chapter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId, chapterIndex }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Chapter API error: ${res.status}`);
  }

  return res.json();
}

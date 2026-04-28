export interface BookMeta {
  id: string;
  title: string;
  author: string;
  description: string;
  language?: string; // "ja", "es", etc. — affects word tokenization
}

export interface BookChapter {
  title: string;
  titleEn?: string;
  isPreface?: boolean;
  paragraphs: string[];
  englishParagraphs?: string[];
}

export interface BookData {
  id: string;
  title: string;
  author: string;
  chapters: BookChapter[];
}

export const books: BookMeta[] = [
  {
    id: "sombrero-tres-picos",
    title: "El sombrero de tres picos",
    author: "Pedro Antonio de Alarcón",
    description:
      "A playful short novel about a miller's wife and a magistrate. Great dialogue, accessible vocabulary.",
  },
  {
    id: "marianela",
    title: "Marianela",
    author: "Benito Pérez Galdós",
    description:
      "The moving story of a blind man and his guide. Clear, beautiful prose perfect for intermediate learners.",
  },
  {
    id: "don-quijote",
    title: "Don Quijote de la Mancha",
    author: "Miguel de Cervantes Saavedra",
    description:
      "The greatest novel in the Spanish language. Follow the adventures of the ingenious knight and his faithful squire.",
  },
  {
    id: "natsu-no-hana",
    title: "夏の花",
    author: "原民喜",
    description:
      "A powerful autobiographical account of the Hiroshima atomic bombing. Written in literary Japanese with rich vocabulary — a challenging but rewarding read for advanced learners.",
    language: "ja",
  },
  {
    id: "conquista-nueva-espana",
    title: "Verdadera historia de los sucesos de la conquista de la Nueva-España",
    author: "Bernal Díaz del Castillo",
    description:
      "El relato testimonial de un soldado que acompañó a Hernán Cortés. Crónica directa y apasionante de la conquista de México.",
  },
];

const bookCache = new Map<string, BookData>();

export async function loadBook(bookId: string): Promise<BookData> {
  if (bookCache.has(bookId)) return bookCache.get(bookId)!;

  const mod = await import(`./content/${bookId}.json`);
  const data: BookData = mod.default || mod;
  bookCache.set(bookId, data);
  return data;
}

export function getBookMeta(bookId: string): BookMeta | undefined {
  return books.find((b) => b.id === bookId);
}

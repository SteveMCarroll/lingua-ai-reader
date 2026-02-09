export interface BookMeta {
  id: string;
  title: string;
  author: string;
  description: string;
}

export interface BookChapter {
  title: string;
  isPreface?: boolean;
  paragraphs: string[];
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

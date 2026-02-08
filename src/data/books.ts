export interface BookMeta {
  id: string;
  title: string;
  author: string;
  gutenbergId: number;
  description: string;
  chapterCount: number;
  /** Chapter titles for the table of contents */
  chapters: { index: number; title: string }[];
}

export const books: BookMeta[] = [
  {
    id: "sombrero-tres-picos",
    title: "El sombrero de tres picos",
    author: "Pedro Antonio de Alarcón",
    gutenbergId: 29506,
    description:
      "A playful short novel about a miller's wife and a magistrate. Great dialogue, accessible vocabulary.",
    chapterCount: 36,
    chapters: [
      { index: 13, title: "Prefacio del autor" },
      { index: 14, title: "El sombrero de tres picos" },
      { index: 15, title: "I — De cuándo sucedió la cosa" },
      { index: 17, title: "II — De cómo vivía entonces la gente" },
      { index: 18, title: "III — Do ut des" },
      { index: 19, title: "IV — Una mujer vista por fuera" },
      { index: 20, title: "V — Un hombre visto por fuera y por dentro" },
      { index: 21, title: "VI — Habilidades de los dos cónyuges" },
      { index: 22, title: "VII — El fondo de la felicidad" },
      { index: 23, title: "VIII — El hombre del sombrero de tres picos" },
      { index: 24, title: "IX — Desde la parra" },
      { index: 25, title: "X — El bombardeo de Pamplona" },
      { index: 26, title: "XI — Diezmos y primicias" },
      { index: 27, title: "XII" },
      { index: 28, title: "XIII — Los consejos de Garduña" },
      { index: 29, title: "XIV — Despedida en prosa" },
      { index: 30, title: "XV — Un ave de mal agüero" },
      { index: 31, title: "XVI — Un alcalde de monterilla" },
      { index: 32, title: "XVII — Muy ligero" },
      { index: 33, title: "XVIII — Voces clamantes in deserto" },
      { index: 34, title: "XIX — La duda y la realidad" },
      { index: 35, title: "XX" },
      { index: 36, title: "XXI — Garduña se multiplica" },
      { index: 37, title: "XXII — Otra vez el desierto y las consabidas voces" },
      { index: 38, title: "XXIII — Un rey de entonces" },
      { index: 39, title: "XXIV — La estrella de Garduña" },
      { index: 40, title: "XXV — Reacción" },
      { index: 41, title: "XXVI" },
      { index: 42, title: "XXVII" },
      { index: 43, title: "XXVIII — Post nubila… Diana" },
      { index: 44, title: "XXIX — Una señora de clase" },
      { index: 45, title: "XXX — La pena del talión" },
      { index: 46, title: "XXXI — La fe mueve las montañas" },
      { index: 47, title: "XXXII" },
      { index: 48, title: "XXXIII — También la corregidora es guapa" },
      { index: 49, title: "XXXIV — Decreto imperial" },
      { index: 50, title: "XXXV — Conclusión, moraleja y epílogo" },
    ],
  },
  {
    id: "marianela",
    title: "Marianela",
    author: "Benito Pérez Galdós",
    gutenbergId: 17340,
    description:
      "The moving story of a blind man and his guide. Clear, beautiful prose perfect for intermediate learners.",
    chapterCount: 22,
    chapters: Array.from({ length: 22 }, (_, i) => ({
      index: i + 1,
      title: `Capítulo ${toRoman(i + 1)}`,
    })),
  },
];

function toRoman(num: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

export function getBook(bookId: string): BookMeta | undefined {
  return books.find((b) => b.id === bookId);
}

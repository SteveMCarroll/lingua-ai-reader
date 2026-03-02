import { useMemo } from "react";
import type { VocabItem } from "../lib/vocab";

interface Props {
  isOpen: boolean;
  scope: "book" | "chapter";
  loading: boolean;
  error: string | null;
  bookTitle: string;
  chapterTitle: string;
  bookVocab: VocabItem[];
  chapterVocab: VocabItem[];
  onClose: () => void;
}

interface DisplayVocabItem {
  headword: string;
  count: number;
  rarityTag: string;
  isTic: boolean;
  translation: string | null;
  forms: string[];
}

const RARITY_RANK: Record<string, number> = {
  "very-rare": 0,
  archaic: 0,
  rare: 1,
  "less-common": 2,
  uncommon: 2,
  common: 3,
};

function badgeClass(tag: string): string {
  switch (tag) {
    case "very-rare":
    case "archaic":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200";
    case "rare":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200";
    case "less-common":
    case "uncommon":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
    default:
      return "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
  }
}

function normalizeHeadword(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRarity(tag: string | undefined): string {
  if (!tag) return "common";
  if (tag === "archaic") return "very-rare";
  if (tag === "uncommon") return "less-common";
  return tag;
}

function formatDisplayVocab(items: VocabItem[]): DisplayVocabItem[] {
  const grouped = new Map<string, DisplayVocabItem>();

  for (const item of items) {
    const headword = normalizeHeadword(item.dictionary_form || item.token);
    const translation = item.translation_en || null;
    const rarityTag = normalizeRarity(item.dictionary_rarity_tag || item.rarity_tag);
    const current = grouped.get(headword);

    if (current) {
      current.count += item.count;
      current.isTic = current.isTic || item.is_tic;
      if ((RARITY_RANK[rarityTag] ?? 99) < (RARITY_RANK[current.rarityTag] ?? 99)) {
        current.rarityTag = rarityTag;
      }
      if (!current.translation && translation) {
        current.translation = translation;
      }
      if (!current.forms.includes(item.token)) {
        current.forms.push(item.token);
      }
      continue;
    }

    grouped.set(headword, {
      headword,
      count: item.count,
      rarityTag,
      isTic: item.is_tic,
      translation,
      forms: [item.token],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count || a.headword.localeCompare(b.headword));
}

function VocabList({
  items,
}: {
  items: VocabItem[];
}) {
  const displayItems = useMemo(() => formatDisplayVocab(items), [items]);
  const studyItems = displayItems.filter((item) => !item.isTic);

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {studyItems.map((item) => (
          <li
            key={item.headword}
            className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 dark:border-stone-700"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{item.headword}</p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {item.translation || "No precomputed translation"}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">count: {item.count}</p>
            </div>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badgeClass(item.rarityTag)}`}>
              {item.rarityTag}
            </span>
          </li>
        ))}
      </ul>

    </div>
  );
}

export function VocabPanel({
  isOpen,
  scope,
  loading,
  error,
  bookTitle,
  chapterTitle,
  bookVocab,
  chapterVocab,
  onClose,
}: Props) {
  const activeItems = scope === "book" ? bookVocab : chapterVocab;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} />
      <aside className="fixed inset-x-3 bottom-3 top-16 z-40 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900 sm:left-auto sm:right-4 sm:w-[28rem]">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200">Vocabulario clave</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close vocabulary panel"
          >
            ✕
          </button>
        </div>

        <div className="h-[calc(100%-53px)] overflow-y-auto p-4">
          {loading && <p className="text-sm text-stone-500 dark:text-stone-400">Cargando vocabulario…</p>}
          {!loading && error && <p className="text-sm text-red-500">{error}</p>}
          {!loading && !error && (
            <div className="space-y-5">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Targeted pre-reading list (common words removed, sorted by count, dictionary form + English).
              </p>
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {scope === "book" ? `Libro · ${bookTitle}` : `Capítulo · ${chapterTitle}`}
                </h4>
                {activeItems.length > 0 ? (
                  <VocabList items={activeItems} />
                ) : (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {scope === "book"
                      ? "No hay vocabulario disponible para este libro."
                      : "No hay vocabulario clave para este capítulo."}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

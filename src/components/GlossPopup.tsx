import type { GlossResponse } from "../lib/api";

interface Props {
  gloss: GlossResponse | null;
  loading: boolean;
  error: string | null;
  rect: DOMRect | null;
  onClose: () => void;
}

export function GlossPopup({ gloss, loading, error, rect, onClose }: Props) {
  if (!rect || (!gloss && !loading && !error)) return null;

  // Position popup below or above the selection
  const viewportHeight = window.innerHeight;
  const popupHeight = 280;
  const showAbove = rect.bottom + popupHeight > viewportHeight && rect.top > popupHeight;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
    top: showAbove ? rect.top - popupHeight - 8 : rect.bottom + 8,
    zIndex: 50,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popup card */}
      <div
        style={style}
        className="z-50 w-[calc(100vw-16px)] max-w-sm rounded-xl border border-stone-200 bg-white p-4 shadow-2xl dark:border-stone-700 dark:bg-stone-900 sm:w-80"
      >
        {loading && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-blue-500" />
            Translating…
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {gloss && (
          <div className="space-y-2.5">
            {/* Selected text + pronunciation */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {gloss.selected}
                </span>
                <span className="font-mono text-xs text-stone-500">{gloss.ipa}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium dark:bg-stone-800">
                  {gloss.partOfSpeech}
                </span>
                <span>{gloss.grammar}</span>
              </div>
            </div>

            {/* Dictionary form */}
            {gloss.dictionaryForm !== gloss.selected && (
              <div className="text-sm">
                <span className="text-stone-500">Dictionary form: </span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {gloss.dictionaryForm}
                </span>
              </div>
            )}

            {/* Translation */}
            <div className="text-sm">
              <span className="text-stone-500">Translation: </span>
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                {gloss.translation}
              </span>
            </div>

            {/* Contextual meaning */}
            <div className="rounded-lg bg-blue-50 p-2.5 text-sm leading-relaxed text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
              {gloss.contextualMeaning}
            </div>

            {/* Full sentence + translation */}
            <div className="border-t border-stone-100 pt-2 dark:border-stone-800">
              <p className="text-xs italic text-stone-600 dark:text-stone-400">
                {gloss.fullSentence}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {gloss.sentenceTranslation}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

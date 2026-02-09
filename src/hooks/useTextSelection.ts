import { useCallback, useEffect, useState } from "react";

export interface TextSelection {
  text: string;
  sentence: string;
  rect: DOMRect;
}

/**
 * Hook for text selection on both mobile (touch) and desktop (mouse).
 * - Tap/click a word span ([data-word]): selects that word
 * - Native selection (long-press + drag): selects phrase via selectionchange
 *
 * Uses clickable word spans instead of caretRangeAtPoint for reliable
 * cross-platform support (iOS Safari, Android Chrome, desktop).
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  function extractSentence(paragraphText: string, offset: number): string {
    const beforeText = paragraphText.slice(0, offset);
    const afterText = paragraphText.slice(offset);

    const sentenceStart = Math.max(
      beforeText.lastIndexOf(". ") + 2,
      beforeText.lastIndexOf("! ") + 2,
      beforeText.lastIndexOf("? ") + 2,
      beforeText.lastIndexOf("¿"),
      beforeText.lastIndexOf("¡"),
      0
    );

    let sentenceEnd = afterText.search(/[.!?]\s|[.!?]$/);
    if (sentenceEnd === -1) sentenceEnd = afterText.length;
    else sentenceEnd += 1;

    return (beforeText.slice(sentenceStart) + afterText.slice(0, sentenceEnd)).trim();
  }

  // Get character offset of a word span within its paragraph
  function getOffsetInParagraph(wordSpan: HTMLElement): number {
    let offset = 0;
    let node: Node | null = wordSpan.previousSibling;
    while (node) {
      offset += (node.textContent || "").length;
      node = node.previousSibling;
    }
    return offset;
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Phrase selection via native selectionchange ---
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      if (!container!.contains(range.commonAncestorContainer)) return;

      const text = sel.toString().trim();
      if (!text || text.length < 2) return;

      // Find parent paragraph for sentence context
      const startEl = range.startContainer instanceof Text
        ? range.startContainer.parentElement
        : range.startContainer as HTMLElement;
      const para = startEl?.closest("[data-paragraph]");
      const paraText = para?.textContent || text;
      const offset = paraText.indexOf(text);
      const sentence = extractSentence(paraText, offset >= 0 ? offset : 0);

      const rect = range.getBoundingClientRect();
      setSelection({ text, sentence, rect });
    }

    let selTimeout: ReturnType<typeof setTimeout>;
    function onSelectionChange() {
      clearTimeout(selTimeout);
      selTimeout = setTimeout(handleSelectionChange, 300);
    }
    document.addEventListener("selectionchange", onSelectionChange);

    // --- Tap-to-select-word via data-word spans ---
    function onClick(e: MouseEvent) {
      // Ignore if there's an active multi-char selection (user dragged)
      const existingSel = window.getSelection();
      if (existingSel && !existingSel.isCollapsed && existingSel.toString().trim().length > 1) return;

      // Find the [data-word] span
      let target = e.target as HTMLElement;
      if (!target.hasAttribute("data-word")) {
        if (target.parentElement?.hasAttribute("data-word")) {
          target = target.parentElement;
        } else {
          return;
        }
      }

      const rawWord = target.textContent || "";
      const word = rawWord.replace(/^[.,;:!?¿¡"'«»—\-]+|[.,;:!?¿¡"'«»—\-]+$/g, "");
      if (!word) return;

      // Get sentence context from paragraph
      const para = target.closest("[data-paragraph]");
      const paraText = para?.textContent || rawWord;
      const offset = getOffsetInParagraph(target);
      const sentence = extractSentence(paraText, offset);

      // Highlight the word with native selection
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      const rect = target.getBoundingClientRect();
      setSelection({ text: word, sentence, rect });
    }

    container.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      container.removeEventListener("click", onClick);
      clearTimeout(selTimeout);
    };
  }, [containerRef]);

  return { selection, clearSelection };
}

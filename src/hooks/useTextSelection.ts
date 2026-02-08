import { useCallback, useEffect, useRef, useState } from "react";

export interface TextSelection {
  text: string;
  sentence: string;
  rect: DOMRect;
}

/**
 * Hook for text selection on both mobile (touch) and desktop (mouse).
 * - Tap/click a word: selects that word
 * - Native selection (long-press + drag / click-drag): selects phrase
 * Extracts the surrounding sentence for context.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Extract the full sentence around a text node + offset
  function extractSentence(node: Node, offset: number): string {
    const textContent = node.textContent || "";
    // Walk up to find the paragraph element
    let el = node.parentElement;
    while (el && el.tagName !== "P" && !el.dataset.paragraph) {
      el = el.parentElement;
    }
    const paragraphText = el?.textContent || textContent;

    // Find sentence boundaries (., !, ?, ;, :)
    const beforeText = paragraphText.slice(0, paragraphText.indexOf(textContent) + offset);
    const afterText = paragraphText.slice(paragraphText.indexOf(textContent) + offset);

    const sentenceStart = Math.max(
      beforeText.lastIndexOf(". ") + 2,
      beforeText.lastIndexOf("! ") + 2,
      beforeText.lastIndexOf("? ") + 2,
      beforeText.lastIndexOf("¿") ,
      beforeText.lastIndexOf("¡"),
      0
    );

    let sentenceEnd = afterText.search(/[.!?]\s|[.!?]$/);
    if (sentenceEnd === -1) sentenceEnd = afterText.length;
    else sentenceEnd += 1;

    return (beforeText.slice(sentenceStart) + afterText.slice(0, sentenceEnd)).trim();
  }

  // Get word at a given position in text
  function getWordAtPoint(node: Text, offset: number): { word: string; range: Range } | null {
    const text = node.textContent || "";
    if (offset >= text.length) return null;

    // Find word boundaries
    let start = offset;
    let end = offset;

    while (start > 0 && /\S/.test(text[start - 1])) start--;
    while (end < text.length && /\S/.test(text[end])) end++;

    const word = text.slice(start, end).replace(/^[.,;:!?¿¡"'«»—\-]+|[.,;:!?¿¡"'«»—\-]+$/g, "");
    if (!word) return null;

    // Adjust start/end after punctuation strip
    const strippedStart = start + text.slice(start, end).indexOf(word);
    const strippedEnd = strippedStart + word.length;

    const range = document.createRange();
    range.setStart(node, strippedStart);
    range.setEnd(node, strippedEnd);

    return { word, range };
  }

  // Handle tap-to-select-word
  const handleTap = useCallback(
    (e: MouseEvent | Touch, container: HTMLElement) => {
      // Use caretPositionFromPoint or caretRangeAtPoint
      let textNode: Text | null = null;
      let offset = 0;

      if ("caretPositionFromPoint" in document) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos && pos.offsetNode instanceof Text) {
          textNode = pos.offsetNode;
          offset = pos.offset;
        }
      } else if ("caretRangeAtPoint" in document) {
        const range = (document as any).caretRangeAtPoint(e.clientX, e.clientY);
        if (range && range.startContainer instanceof Text) {
          textNode = range.startContainer;
          offset = range.startOffset;
        }
      }

      if (!textNode || !container.contains(textNode)) return;

      const result = getWordAtPoint(textNode, offset);
      if (!result) return;

      const sentence = extractSentence(textNode, offset);
      const rect = result.range.getBoundingClientRect();

      // Highlight with native selection
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(result.range);

      setSelection({ text: result.word, sentence, rect });
    },
    []
  );

  // Handle native text selection (phrase selection)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);
      if (!container!.contains(range.commonAncestorContainer)) return;

      const text = sel.toString().trim();
      if (!text || text.length < 2) return;

      // Extract sentence from the start of selection
      const startNode = range.startContainer;
      const sentence =
        startNode instanceof Text
          ? extractSentence(startNode, range.startOffset)
          : startNode.textContent?.slice(0, 200) || "";

      const rect = range.getBoundingClientRect();
      setSelection({ text, sentence, rect });
    }

    // Debounce selectionchange
    let timeout: ReturnType<typeof setTimeout>;
    function onSelectionChange() {
      clearTimeout(timeout);
      timeout = setTimeout(handleSelectionChange, 300);
    }

    document.addEventListener("selectionchange", onSelectionChange);

    // Tap handling for single-word selection
    function onPointerUp(e: PointerEvent) {
      // Ignore if there's an active multi-char selection (user is dragging)
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && (sel.toString().trim().length > 1)) return;

      // Simple tap detection
      handleTap(e, container!);
    }

    container.addEventListener("pointerup", onPointerUp);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      container.removeEventListener("pointerup", onPointerUp);
      clearTimeout(timeout);
    };
  }, [containerRef, handleTap]);

  return { selection, clearSelection };
}

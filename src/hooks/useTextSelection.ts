import { useCallback, useEffect, useState } from "react";

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
 *
 * Safari/iOS compatibility: uses caretRangeAtPoint (WebKit-native) as
 * primary, with caretPositionFromPoint fallback. Listens to both click
 * and touchend for reliable tap detection across all browsers.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Extract the full sentence around a text node + offset
  function extractSentence(node: Node, offset: number): string {
    const textContent = node.textContent || "";
    let el = node.parentElement;
    while (el && el.tagName !== "P" && !el.dataset.paragraph) {
      el = el.parentElement;
    }
    const paragraphText = el?.textContent || textContent;

    const beforeText = paragraphText.slice(0, paragraphText.indexOf(textContent) + offset);
    const afterText = paragraphText.slice(paragraphText.indexOf(textContent) + offset);

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

  function getWordAtPoint(node: Text, offset: number): { word: string; range: Range } | null {
    const text = node.textContent || "";
    if (offset >= text.length) return null;

    let start = offset;
    let end = offset;

    while (start > 0 && /\S/.test(text[start - 1])) start--;
    while (end < text.length && /\S/.test(text[end])) end++;

    const word = text.slice(start, end).replace(/^[.,;:!?¿¡"'«»—\-]+|[.,;:!?¿¡"'«»—\-]+$/g, "");
    if (!word) return null;

    const strippedStart = start + text.slice(start, end).indexOf(word);
    const strippedEnd = strippedStart + word.length;

    const range = document.createRange();
    range.setStart(node, strippedStart);
    range.setEnd(node, strippedEnd);

    return { word, range };
  }

  // Resolve text node + offset at a screen coordinate.
  // Prefer caretRangeAtPoint (Safari/WebKit native, most reliable on iOS)
  // then fall back to caretPositionFromPoint (Firefox/Chrome standard).
  function getCaretAt(x: number, y: number): { node: Text; offset: number } | null {
    if (typeof (document as any).caretRangeAtPoint === "function") {
      const range = (document as any).caretRangeAtPoint(x, y) as Range | null;
      if (range && range.startContainer instanceof Text) {
        return { node: range.startContainer, offset: range.startOffset };
      }
    }
    if (typeof (document as any).caretPositionFromPoint === "function") {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode instanceof Text) {
        return { node: pos.offsetNode, offset: pos.offset };
      }
    }
    return null;
  }

  // Core: given screen coords, select the word and fire state update
  const selectWordAt = useCallback(
    (x: number, y: number, container: HTMLElement) => {
      const caret = getCaretAt(x, y);
      if (!caret || !container.contains(caret.node)) return;

      const result = getWordAtPoint(caret.node, caret.offset);
      if (!result) return;

      const sentence = extractSentence(caret.node, caret.offset);
      const rect = result.range.getBoundingClientRect();

      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(result.range);

      setSelection({ text: result.word, sentence, rect });
    },
    []
  );

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

      const startNode = range.startContainer;
      const sentence =
        startNode instanceof Text
          ? extractSentence(startNode, range.startOffset)
          : startNode.textContent?.slice(0, 200) || "";

      const rect = range.getBoundingClientRect();
      setSelection({ text, sentence, rect });
    }

    let selTimeout: ReturnType<typeof setTimeout>;
    function onSelectionChange() {
      clearTimeout(selTimeout);
      selTimeout = setTimeout(handleSelectionChange, 300);
    }
    document.addEventListener("selectionchange", onSelectionChange);

    // --- Tap-to-select-word ---
    // iOS Safari: touchstart coords are always reliable; touchend/click
    // coords can be wrong or events delayed. Track touchstart position
    // and use it on touchend if the gesture was a quick, small-movement tap.
    let touchStart: { x: number; y: number; time: number } | null = null;
    let lastTapTime = 0;

    function fireTap(x: number, y: number) {
      const now = Date.now();
      if (now - lastTapTime < 400) return; // dedup touch+click
      lastTapTime = now;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;

      selectWordAt(x, y, container!);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) { touchStart = null; return; }
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchStart || e.changedTouches.length !== 1) { touchStart = null; return; }
      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - touchStart.x);
      const dy = Math.abs(t.clientY - touchStart.y);
      const dt = Date.now() - touchStart.time;
      // Quick tap: < 500ms, < 10px movement
      if (dt < 500 && dx < 10 && dy < 10) {
        fireTap(touchStart.x, touchStart.y);
      }
      touchStart = null;
    }

    // Click handler for mouse / non-touch devices
    function onClick(e: MouseEvent) {
      fireTap(e.clientX, e.clientY);
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("click", onClick);
      clearTimeout(selTimeout);
    };
  }, [containerRef, selectWordAt]);

  return { selection, clearSelection };
}

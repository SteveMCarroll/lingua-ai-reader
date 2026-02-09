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
 *
 * iOS Safari fix: caretRangeAtPoint is called at touchstart time (before
 * Safari's gesture recognizer intercepts). The resolved word is stored
 * and applied on touchend if the gesture was a quick tap.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

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

  // Resolve word info from a caret position and apply selection
  const applyWordSelection = useCallback(
    (node: Text, offset: number, container: HTMLElement) => {
      if (!container.contains(node)) return;
      const result = getWordAtPoint(node, offset);
      if (!result) return;

      const sentence = extractSentence(node, offset);
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
    // iOS Safari: resolve the caret at touchstart (before Safari's gesture
    // recognizer takes over), store the result, apply on touchend if quick tap.
    let pendingTap: {
      node: Text;
      offset: number;
      x: number;
      y: number;
      time: number;
    } | null = null;
    let lastTapTime = 0;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) { pendingTap = null; return; }
      const t = e.touches[0];
      // Resolve caret NOW, before iOS intercepts
      const caret = getCaretAt(t.clientX, t.clientY);
      if (caret) {
        pendingTap = { ...caret, x: t.clientX, y: t.clientY, time: Date.now() };
      } else {
        pendingTap = null;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!pendingTap || e.changedTouches.length !== 1) { pendingTap = null; return; }
      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - pendingTap.x);
      const dy = Math.abs(t.clientY - pendingTap.y);
      const dt = Date.now() - pendingTap.time;

      if (dt < 500 && dx < 10 && dy < 10) {
        const now = Date.now();
        if (now - lastTapTime > 400) { // dedup
          lastTapTime = now;
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed || sel.toString().trim().length <= 1) {
            applyWordSelection(pendingTap.node, pendingTap.offset, container!);
          }
        }
      }
      pendingTap = null;
    }

    // Click handler for mouse / non-touch desktop
    function onClick(e: MouseEvent) {
      const now = Date.now();
      if (now - lastTapTime < 400) return;
      lastTapTime = now;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;

      const caret = getCaretAt(e.clientX, e.clientY);
      if (caret) {
        applyWordSelection(caret.node, caret.offset, container!);
      }
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
  }, [containerRef, applyWordSelection]);

  return { selection, clearSelection };
}

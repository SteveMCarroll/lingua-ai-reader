#!/usr/bin/env python3
"""
Translate Don Quijote chapters to English for side-by-side parallel reading.
Preserves exact paragraph structure — English paragraph count MUST match Spanish count.

Usage:
  python3 -m scripts.translate_chapters          # translate all chapters 1-8
  python3 -m scripts.translate_chapters --ch 2   # translate just chapter 2
  python3 -m scripts.translate_chapters --ch 1-3  # translate chapters 1 through 3

Model: opencode/minimax-m2.5-free (no API key needed)
"""
import json
import subprocess
import time
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone

MODEL = "opencode/minimax-m2.5-free"
OPENCODE_BIN = Path.home() / ".opencode/bin/opencode"
CHAPTERS_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote.json"
OUTPUT_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote-en.json"
LOG_FILE = Path(__file__).parent.parent / "scripts/translation-log.json"

# Prompt for chapter-level translation that preserves paragraph structure
TRANSLATION_PROMPT = """You are a bilingual parallel text translator. Your SOLE task is to translate Spanish into English while EXACTLY preserving paragraph count.

INPUT: A Spanish chapter with N paragraphs (separated by \\n\\n markers).
OUTPUT: Exactly N English paragraphs, one per Spanish paragraph, in the same order.

RULES:
1. COUNT MUST MATCH — exactly N English paragraphs, no exceptions
2. Preserve Spanish word order — flat, literal translation
3. Idioms/archaisms: add [ANN: explanation] inline
4. Key archaic words: add [ARC: modern_english] inline  
5. Keep each English paragraph roughly the same length/scope as its Spanish source
6. Mark cultural context: [NOTE: brief note]
7. Dialogue: use quotation marks "..."
8. Chapter title: translate literally

Return ONLY valid JSON with this exact structure:
{{"titleEn": "Translated Title", "paragraphs": ["Para 1", "Para 2", ... "Para N"]}}

Do not add any commentary before or after the JSON. No markdown fences."""


def run_opencode(text: str, timeout: int = 180) -> str:
    """Send text to opencode, return stdout."""
    result = subprocess.run(
        [str(OPENCODE_BIN), "run", "--model", MODEL, TRANSLATION_PROMPT + "\n\n" + text],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"opencode failed: {result.stderr[:500]}")
    return result.stdout


def parse_translation_output(raw: str, expected_count: int) -> dict:
    """Extract JSON from model output, validate paragraph count."""
    # Try to find JSON block
    match = re.search(r'\{[\s\S]*\}', raw)
    if not match:
        raise ValueError(f"No JSON found in output: {raw[:200]}")
    
    data = json.loads(match.group())
    
    # Validate
    if "paragraphs" not in data:
        raise ValueError(f"No paragraphs key: {list(data.keys())}")
    
    actual = len(data["paragraphs"])
    if actual != expected_count:
        raise ValueError(f"Paragraph count mismatch: expected {expected_count}, got {actual}")
    
    return data


def translate_chapter(chapter_idx: int, chapter_data: dict) -> dict:
    """Translate a single chapter, preserving paragraph structure."""
    es_paras = chapter_data["paragraphs"]
    es_title = chapter_data["title"]
    n = len(es_paras)
    
    # Join with clear paragraph markers so model knows the structure
    marked_text = "\n\n[P]\n\n".join(es_paras)
    
    print(f"  Ch{chapter_idx+1}: {n} Spanish paragraphs → translating...", flush=True)
    
    # Retry up to 3 times
    for attempt in range(3):
        try:
            raw = run_opencode(f"[CHAPTER START]\nTitle: {es_title}\n\n[P-marked chapter:]\n{marked_text}\n[END CHAPTER — remember: exactly {n} English paragraphs, one per [P] marker]")
            
            result = parse_translation_output(raw, n)
            print(f"  Ch{chapter_idx+1}: ✓ got {len(result['paragraphs'])} paragraphs", flush=True)
            return result
            
        except Exception as e:
            print(f"  Ch{chapter_idx+1}: attempt {attempt+1} failed: {e}", flush=True)
            if attempt < 2:
                time.sleep(5)
            else:
                raise
    
    raise RuntimeError("unreachable")


def main():
    parser = argparse.ArgumentParser(description="Translate Don Quijote chapters")
    parser.add_argument("--ch", "--chapter", 
                        help="Chapter to translate, e.g. 2 or 1-3 (default: all 1-8)")
    args = parser.parse_args()

    with open(CHAPTERS_FILE) as f:
        book = json.load(f)
    
    # Determine which chapters to translate
    all_chapters = list(range(len(book["chapters"])))
    
    # Only chapters 1-8 exist in the English file currently
    target_indices = [i for i in all_chapters if i < 8]
    
    if args.ch:
        if "-" in str(args.ch):
            start, end = map(int, str(args.ch).split("-"))
            target_indices = list(range(start - 1, end))
        else:
            target_indices = [int(args.ch) - 1]
    
    print(f"Translating chapters: {[i+1 for i in target_indices]}")
    print(f"Output: {OUTPUT_FILE}")
    
    # Load existing English data if it exists
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE) as f:
            english_book = json.load(f)
    else:
        english_book = {
            "id": book["id"],
            "title": book["title"],
            "author": book.get("author", ""),
            "chapters": []
        }
    
    # Ensure we have enough chapter slots
    while len(english_book["chapters"]) < len(book["chapters"]):
        english_book["chapters"].append({"title": "", "paragraphs": []})
    
    # Track results
    results = []
    
    for idx in target_indices:
        ch = book["chapters"][idx]
        try:
            en_ch = translate_chapter(idx, ch)
            english_book["chapters"][idx] = en_ch
            results.append({"chapter": idx + 1, "status": "ok", "paras": len(en_ch["paragraphs"])})
        except Exception as e:
            print(f"  Ch{idx+1}: ✗ FAILED — {e}")
            results.append({"chapter": idx + 1, "status": "error", "error": str(e)[:100]})
        
        # Rate limit
        time.sleep(2)
    
    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(english_book, f, indent=2, ensure_ascii=False)
    
    # Update log
    log = []
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE) as f:
                log = json.load(f)
        except (json.JSONDecodeError, ValueError):
            log = []
    
    log.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "chapters": results,
    })
    
    with open(LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)
    
    # Summary
    ok = [r for r in results if r["status"] == "ok"]
    print(f"\nDone: {len(ok)}/{len(results)} succeeded")
    for r in results:
        status = "✓" if r["status"] == "ok" else "✗"
        if r["status"] == "ok":
            print(f"  Ch{r['chapter']}: {status} {r['paras']} paragraphs")
        else:
            print(f"  Ch{r['chapter']}: {status} {r.get('error', 'unknown')}")


if __name__ == "__main__":
    main()

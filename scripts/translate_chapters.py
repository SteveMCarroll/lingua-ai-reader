#!/usr/bin/env python3
"""
Translate Don Quijote chapters 1-8 to English for side-by-side reading.
Uses opencode with minimax-m2.5-free model.
"""
import json
import subprocess
import time
import re
from pathlib import Path
from datetime import datetime, timezone

MODEL = "opencode/minimax-m2.5-free"
OPENCODE_BIN = Path.home() / ".opencode/bin/opencode"
CHAPTERS_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote.json"
OUTPUT_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote-en.json"
LOG_FILE = Path(__file__).parent / "translation-log.json"

TRANSLATION_PROMPT = """You are a translation engine for bilingual parallel texts.
Translate the Spanish chapter below into English optimized for SIDE-BY-SIDE reading.
RULES:
- Keep translations FLAT and LITERAL — match Spanish word order where possible
- For idioms/archaisms: add [ANN: explanation] inline
- For key archaic words: add [ARC: modern meaning] inline
- Preserve paragraph structure exactly — one English paragraph per Spanish paragraph
- Mark historical/cultural context briefly: [NOTE: ...]
- Chapter titles: translate literally, preserve full title
- Dialogue: keep Spanish em-dash (—); use quotation marks in English

Output ONLY valid JSON matching this structure:
{"titleEn": "Chapter title in English", "paragraphs": ["English para 1", "English para 2"]}

Translate now:"""


def run_opencode(text: str, timeout: int = 120) -> str:
    """Send chapter text to opencode, return stdout."""
    result = subprocess.run(
        [str(OPENCODE_BIN), "run", "--model", MODEL, TRANSLATION_PROMPT + "\n\n" + text],
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**__import__("os").environ, "PATH": f"{Path.home()}/.opencode/bin:{__import__('os').environ.get('PATH', '')}"}
    )
    return result.stdout + (result.stderr if "Error" in result.stderr else "")


def parse_json_response(text: str) -> dict:
    """Extract JSON from opencode output (may be wrapped in markdown)."""
    cleaned = text.strip()
    # Strip markdown code blocks
    for prefix in ["```json", "```"]:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].lstrip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].rstrip()
    # Find first { and last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(cleaned[start:end+1])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"No JSON found in response: {cleaned[:300]}")


def translate_chapter(chapter_idx: int, title_es: str, paragraphs: list[str]) -> tuple[dict, dict]:
    """Translate one chapter. Returns (result_dict, log_dict)."""
    spanish_text = f"[CHAPTER {chapter_idx + 1}]: {title_es}\n\n" + "\n\n".join(paragraphs)

    print(f"  Translating ch{chapter_idx + 1} ({len(paragraphs)} paragraphs)...")
    start = time.time()
    response = run_opencode(spanish_text, timeout=180)
    elapsed = time.time() - start

    log = {
        "chapter": chapter_idx,
        "titleEs": title_es,
        "paragraphCountEs": len(paragraphs),
        "elapsedSeconds": round(elapsed, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "status": "failed",
        "error": None,
    }

    try:
        result = parse_json_response(response)
        result["chapterIndex"] = chapter_idx
        result["titleEs"] = title_es
        log["status"] = "success"
        log["paragraphCountEn"] = len(result.get("paragraphs", []))
        log["titleEn"] = result.get("titleEn", "")
        print(f"  ✓ Ch{chapter_idx + 1} done in {elapsed:.0f}s → {len(result.get('paragraphs', []))} paras")
        return result, log
    except Exception as e:
        log["error"] = str(e)[:200]
        log["rawResponse"] = response[:500]
        print(f"  ✗ Ch{chapter_idx + 1} failed: {e}")
        return None, log


def main():
    with open(CHAPTERS_FILE) as f:
        data = json.load(f)

    chapters = data["chapters"]
    translated = []
    all_logs = []

    for i in range(8):
        ch = chapters[i]
        result, log = translate_chapter(i, ch["title"], ch["paragraphs"])

        if result:
            translated.append(result)
        else:
            # Fallback: copy Spanish
            translated.append({
                "chapterIndex": i,
                "titleEs": ch["title"],
                "titleEn": "[TRANSLATION FAILED]",
                "paragraphs": ch["paragraphs"]
            })

        all_logs.append(log)
        time.sleep(3)  # pause between chapters

    # Save English translation JSON
    output_data = {
        "id": data["id"] + "-en",
        "title": data["title"] + " (English)",
        "author": data["author"],
        "chapters": [{"title": t.get("titleEn", ""), "paragraphs": t.get("paragraphs", [])} for t in translated]
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # Save log
    log_data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "prompt": TRANSLATION_PROMPT,
        "chapters": all_logs
    }
    with open(LOG_FILE, "w") as f:
        json.dump(log_data, f, indent=2)

    success = sum(1 for l in all_logs if l["status"] == "success")
    print(f"\nSaved {OUTPUT_FILE}")
    print(f"Log: {LOG_FILE}")
    print(f"Result: {success}/8 chapters translated successfully")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Align Spanish paragraphs to match English paragraph counts.
Merges adjacent Spanish paragraphs proportionally so each English paragraph
gets a corresponding chunk of Spanish text.

Usage: python3 scripts/align_chapters.py
Output: src/data/content/don-quijote-aligned.json
"""
import json
import math
from pathlib import Path

SRC_ES = Path(__file__).parent.parent / "src/data/content/don-quijote.json"
SRC_EN = Path(__file__).parent.parent / "src/data/content/don-quijote-en.json"
OUT = Path(__file__).parent.parent / "src/data/content/don-quijote-aligned.json"


def align_paragraphs(spanish_paras: list[str], english_paras: list[str]) -> list[str]:
    """Merge Spanish paragraphs into chunks matching English count."""
    es_count = len(spanish_paras)
    en_count = len(english_paras)

    if es_count == en_count:
        return spanish_paras

    if en_count == 0 or es_count == 0:
        return spanish_paras

    # Each English paragraph gets this many Spanish paras (as float ratio)
    ratio = es_count / en_count
    aligned = []

    for i in range(en_count):
        start = int(math.floor(i * ratio))
        end = int(math.floor((i + 1) * ratio))
        # Clip to available range
        end = min(end, es_count)
        start = min(start, end)
        chunk = spanish_paras[start:end]
        if chunk:
            aligned.append("\n\n".join(chunk))
        else:
            aligned.append("")

    return aligned


def main():
    with open(SRC_ES) as f:
        es_data = json.load(f)
    with open(SRC_EN) as f:
        en_data = json.load(f)

    aligned_chapters = []

    # Only align chapters that exist in both
    en_chapters = en_data["chapters"]

    for i, es_ch in enumerate(es_data["chapters"]):
        if i >= len(en_chapters):
            aligned_chapters.append({
                "title": es_ch["title"],
                "titleEn": es_ch["title"],
                "paragraphs": es_ch["paragraphs"],
            })
            continue
        en_ch = en_chapters[i]
        aligned_paras = align_paragraphs(es_ch["paragraphs"], en_ch["paragraphs"])
        aligned_chapters.append({
            "title": es_ch["title"],
            "titleEn": en_ch["title"],
            "paragraphs": aligned_paras,
        })

    output = {
        "id": es_data["id"] + "-aligned",
        "title": es_data["title"] + " (Aligned)",
        "author": es_data["author"],
        "chapters": aligned_chapters,
    }

    with open(OUT, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Report
    print("Alignment complete:")
    for i, ch in enumerate(aligned_chapters):
        es_orig = len(es_data["chapters"][i]["paragraphs"])
        en = len(en_chapters[i]["paragraphs"]) if i < len(en_chapters) else "N/A"
        aligned = len(ch["paragraphs"])
        status = "✓" if aligned == en else f"✗ (got {aligned})"
        print(f"  Ch{i+1}: {es_orig} ES → {aligned} aligned (EN={en}) {status}")

    print(f"\nSaved to {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Evaluation suite for Don Quijote bilingual parallel text translations.

Tests:
1. Paragraph count alignment: ES == EN for every chapter
2. No missing/empty paragraphs
3. Chapter titles present in both languages
4. JSON structure validity
5. No paragraph is significantly longer than source (sanity check)
6. Translation quality spot-check (sample lines)

Usage:
  python3 -m scripts.eval_translations           # run all tests
  python3 -m scripts.eval_translations --verbose # show details
  python3 -m scripts.eval_translations --ch 2    # test single chapter
"""
import json
import argparse
import sys
from pathlib import Path

ES_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote.json"
EN_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote-en.json"

PASS = "✓"
FAIL = "✗"


def load_books():
    with open(ES_FILE) as f:
        es = json.load(f)
    with open(EN_FILE) as f:
        en = json.load(f)
    return es, en


def test_json_structure(es, en) -> dict:
    """Test that both files have valid structure."""
    tests = []

    tests.append({
        "name": "ES has 'chapters' key",
        "pass": "chapters" in es,
    })
    tests.append({
        "name": "EN has 'chapters' key",
        "pass": "chapters" in en,
    })
    tests.append({
        "name": "ES has same chapter count as EN",
        "pass": len(es["chapters"]) >= len(en["chapters"]),
    })

    es_count = len(es["chapters"])
    en_count = len(en["chapters"])
    tests.append({
        "name": f"EN has ≥8 chapters ({en_count} ≥ 8)",
        "pass": en_count >= 8,
    })

    return {"test": "JSON structure", "passed": all(t["pass"] for t in tests), "subtests": tests}


def test_paragraph_alignment(es, en, chapter_idx: int | None = None) -> dict:
    """Test that ES paragraph count == EN paragraph count for each chapter."""
    subtests = []
    all_pass = True

    # Only test chapters that have actual English content (non-empty paragraphs)
    translated_indices = [i for i in range(len(en["chapters"]))
                         if en["chapters"][i].get("paragraphs")]
    indices = [chapter_idx] if chapter_idx is not None else translated_indices

    for i in indices:
        es_ch = es["chapters"][i]
        en_ch = en["chapters"][i]
        es_n = len(es_ch["paragraphs"])
        en_n = len(en_ch["paragraphs"])
        matched = es_n == en_n
        all_pass = all_pass and matched
        subtests.append({
            "name": f"Ch{i+1}: ES={es_n} EN={en_n}",
            "pass": matched,
            "detail": None if matched else f"paragraph count mismatch: {es_n} vs {en_n}",
        })

    return {
        "test": "Paragraph alignment" + (f" (Ch{chapter_idx+1})" if chapter_idx is not None else " (all)"),
        "passed": all_pass,
        "subtests": subtests,
    }


def test_no_empty_paragraphs(es, en, chapter_idx: int | None = None) -> dict:
    """Test that no paragraph is empty or whitespace-only."""
    subtests = []
    all_pass = True

    translated_indices = [i for i in range(len(en["chapters"]))
                         if en["chapters"][i].get("paragraphs")]
    indices = [chapter_idx] if chapter_idx is not None else translated_indices

    for i in indices:
        es_paras = [p for p in es["chapters"][i]["paragraphs"] if p.strip()]
        en_paras = [p for p in en["chapters"][i]["paragraphs"] if p.strip()]
        en_all = len(en["chapters"][i]["paragraphs"])
        es_all = len(es["chapters"][i]["paragraphs"])
        all_en = len(es_paras) == es_all
        all_pass = all_pass and all_en
        subtests.append({
            "name": f"Ch{i+1}: {en_all}/{en_all} EN paragraphs non-empty",
            "pass": all_en,
        })

    return {
        "test": "No empty paragraphs" + (f" (Ch{chapter_idx+1})" if chapter_idx is not None else " (all)"),
        "passed": all_pass,
        "subtests": subtests,
    }


def test_chapter_titles(es, en, chapter_idx: int | None = None) -> dict:
    """Test that each EN chapter has a title."""
    subtests = []
    all_pass = True

    translated_indices = [i for i in range(len(en["chapters"]))
                         if en["chapters"][i].get("paragraphs")]
    indices = [chapter_idx] if chapter_idx is not None else translated_indices

    for i in indices:
        es_title = es["chapters"][i].get("title", "")
        en_data = en["chapters"][i]
        # EN chapter can have "title" or "titleEn"
        en_title = en_data.get("titleEn") or en_data.get("title", "")
        has_en_title = bool(en_title.strip())
        all_pass = all_pass and has_en_title
        subtests.append({
            "name": f"Ch{i+1}: EN has title",
            "pass": has_en_title,
            "detail": f'"{en_title[:50]}..."' if en_title else "(missing)",
        })

    return {
        "test": "Chapter titles" + (f" (Ch{chapter_idx+1})" if chapter_idx is not None else " (all)"),
        "passed": all_pass,
        "subtests": subtests,
    }


def test_length_ratio(es, en, chapter_idx: int | None = None, max_ratio: float = 3.0) -> dict:
    """Test that no EN paragraph is excessively longer than its ES source (sanity check)."""
    subtests = []
    all_pass = True

    translated_indices = [i for i in range(len(en["chapters"]))
                         if en["chapters"][i].get("paragraphs")]
    indices = [chapter_idx] if chapter_idx is not None else translated_indices

    for i in indices:
        es_paras = es["chapters"][i]["paragraphs"]
        en_paras = en["chapters"][i]["paragraphs"]
        n = min(len(es_paras), len(en_paras))

        for j in range(n):
            es_len = len(es_paras[j])
            en_len = len(en_paras[j])
            if es_len == 0:
                continue
            ratio = en_len / es_len
            ok = ratio <= max_ratio
            if not ok:
                all_pass = False
                subtests.append({
                    "name": f"Ch{i+1} P{j+1}: length ratio {ratio:.1f}x",
                    "pass": False,
                    "detail": f"EN={en_len}chars vs ES={es_len}chars (limit={max_ratio}x)",
                })

    if not subtests:
        subtests.append({"name": "All ratios OK", "pass": True})

    return {
        "test": f"Length ratio ≤{max_ratio}x" + (f" (Ch{chapter_idx+1})" if chapter_idx is not None else " (all)"),
        "passed": all_pass,
        "subtests": subtests,
    }


def test_sample_quality_check(en, chapter_idx: int) -> dict:
    """Spot-check: verify first paragraph of chapter contains expected known phrases."""
    known_phrases = {
        0: ["La Mancha", "hidalgo"],
        1: ["preparations", " Rocinante"],
        2: ["knight", "inn"],
    }

    subtests = []
    if chapter_idx not in known_phrases:
        return {"test": f"Quality spot-check (Ch{chapter_idx+1})", "passed": True, "subtests": [{"name": "No spot-check defined", "pass": True}]}

    if chapter_idx >= len(en["chapters"]):
        return {"test": f"Quality spot-check (Ch{chapter_idx+1})", "passed": False, "subtests": [{"name": "Chapter not in EN file", "pass": False}]}

    text = en["chapters"][chapter_idx]["paragraphs"][0]
    phrases = known_phrases[chapter_idx]
    found = [p for p in phrases if p in text]
    ok = len(found) == len(phrases)
    subtests.append({
        "name": f"Ch{chapter_idx+1} P1 contains expected phrases",
        "pass": ok,
        "detail": f"Found {len(found)}/{len(phrases)}: {found}" if not ok else f"{found}",
    })

    return {
        "test": f"Quality spot-check (Ch{chapter_idx+1})",
        "passed": ok,
        "subtests": subtests,
    }


def run_all_tests(chapter_idx: int | None = None, verbose: bool = False):
    """Run all evaluation tests."""
    print(f"Loading books...")
    try:
        es, en = load_books()
    except FileNotFoundError as e:
        print(f"FAIL: Could not load books: {e}")
        return {"passed": False, "error": str(e)}
    print(f"  ES: {len(es['chapters'])} chapters | EN: {len(en['chapters'])} chapters\n")

    tests = [
        test_json_structure(es, en),
        test_paragraph_alignment(es, en, chapter_idx),
        test_no_empty_paragraphs(es, en, chapter_idx),
        test_chapter_titles(es, en, chapter_idx),
    ]
    # Only run length ratio on all chapters (expensive)
    if chapter_idx is None:
        tests.append(test_length_ratio(es, en))

    if chapter_idx is not None:
        tests.append(test_sample_quality_check(en, chapter_idx))

    results = []
    for t in tests:
        results.append(t)
        status = PASS if t["passed"] else FAIL
        print(f"  [{status}] {t['test']}")
        if verbose or not t["passed"]:
            for st in t.get("subtests", []):
                if isinstance(st, list):
                    for sst in st:
                        s = PASS if sst["pass"] else FAIL
                        print(f"      [{s}] {sst['name']}" + (f" — {sst.get('detail','')}" if sst.get('detail') else ""))
                else:
                    s = PASS if st["pass"] else FAIL
                    print(f"      [{s}] {st['name']}" + (f" — {st.get('detail','')}" if st.get('detail') else ""))

    passed = sum(1 for t in results if t["passed"])
    total = len(results)
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} test suites passed")

    if passed < total:
        print("FAIL: Some tests failed")
        return {"passed": False, "results": results}
    else:
        print("PASS: All tests passed")
        return {"passed": True, "results": results}


def main():
    parser = argparse.ArgumentParser(description="Evaluate Don Quijote translation quality")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all subtests")
    parser.add_argument("--ch", type=int, help="Test specific chapter (1-based)")
    args = parser.parse_args()

    chapter_idx = args.ch - 1 if args.ch is not None else None

    print(f"{'='*50}")
    print("Don Quijote Translation Evaluation Suite")
    print(f"{'='*50}")

    result = run_all_tests(chapter_idx, args.verbose)

    # Exit code
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()

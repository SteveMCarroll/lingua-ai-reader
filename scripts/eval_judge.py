#!/usr/bin/env python3
"""
LLM-as-judge evaluation for Don Quijote translations.

Uses an LLM judge to score translations across multiple dimensions:
  - Semantic accuracy (does it faithfully convey the Spanish meaning?)
  - English fluency (is the English natural and grammatical?)
  - Style preservation (does it preserve the tone/register of the original?)
  - Overall SXS suitability (is it suitable for side-by-side reading?)

Can compare multiple models on the same source passages.

Usage:
  python3 -m scripts.eval_judge                  # run judge eval on sample passages
  python3 -m scripts.eval_judge --compare        # compare models on same passages
  python3 -m scripts.eval_judge --verbose        # show detailed scores
  python3 -m scripts.eval_judge --model openai/gpt-4o  # use specific model
"""
import json
import subprocess
import argparse
import time
import re
import sys
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional

MODEL = "opencode/minimax-m2.5-free"
OPENCODE_BIN = Path.home() / ".opencode/bin/opencode"
ES_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote.json"
EN_FILE = Path(__file__).parent.parent / "src/data/content/don-quijote-en.json"
RESULTS_FILE = Path(__file__).parent.parent / "scripts/judge-results.json"

# Sample passages for evaluation — diverse styles (dialogue, narration, description)
# NOTE: indices are 0-based and must match between ES and EN (verified manually)
SAMPLE_PASSAGES = [
    {
        "id": "ch1_p1",
        "chapter": 1,
        "paragraph": 0,
        "spanish": "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.",
        "context": "Opening line of the novel — famous, should be rendered accurately",
    },
    {
        "id": "ch1_p7",
        "chapter": 1,
        "paragraph": 6,
        "spanish": "Fue luego a ver su rocín, y, aunque tenía más cuartos que un real y más tachas que el caballo de Gonela, que tantum pellis et ossa fuit, le pareció que no podía tener mejor rocín en el mundo.",
        "context": "Humor — horse-dealer jargon; 'cuartos', 'tachas', Latin quote; Johnston version has this reference",
    },
    {
        "id": "ch2_p2",
        "chapter": 2,
        "paragraph": 2,
        "spanish": "— ¿Quién duda sino que en los venideros tiempos, cuando salga a luz la verdadera historia de mis hazañas, cuando me vean tan desviado del mundo, no digan que yo fui manquer antes de loores a mi corona, y que salí del sepulcro antes que los hados me llevaran a la sepultura?",
        "context": "Don Quixote speaking his famous soliloquy about his future fame — bombastic chivalric register",
    },
    {
        "id": "ch2_p9",
        "chapter": 2,
        "paragraph": 9,
        "spanish": "Estaban acaso a la puerta dos mujeres mozas, destas que llaman del partido, las cuales iban a Sevilla con unos mulateros que en el mesquino mesón estaban.",
        "context": "Narrative — two women at inn door going to Seville; 'del partido' is period-specific term",
    },
    {
        "id": "ch7_p1",
        "chapter": 7,
        "paragraph": 1,
        "spanish": "Aquí, aquí, valientes caballeros; aquí se han de mostrar vuestras valerosas fuerzas, pues los caballeros de la corte llevan los mantenimientos.",
        "context": "Don Quixote's battle cry — requires capturing bombastic chivalric register in English",
    },
]

JUDGE_PROMPT_TEMPLATE = """You are an expert evaluator of translation quality for bilingual parallel texts.

SOURCE (Spanish): {spanish}
TRANSLATION (English): {english}
CONTEXT: {context}

Evaluate this translation across these dimensions (1-10 each):

1. SEMANTIC_ACCURACY (1-10): Does the translation faithfully convey the meaning of the Spanish source? Look for: omitted content, added content not in source, misrendered meaning, factual errors.
2. ENGLISH_FLUENCY (1-10): Is the English natural, grammatical, and readable? Look for: awkward phrasing, ungrammatical sentences, unnatural word choices.
3. STYLE_PRESERVATION (1-10): Does the translation match the tone, register, and style of the original? (E.g. archaic style should sound archaic in English; humor should translate as humor; formal text should be formal.)
4. SXS_SUITABILITY (1-10): Is this translation suitable for side-by-side (SXS) reading with the Spanish source? Key: paragraph boundaries must align, translations should be flat/literal enough to track with source word order.

Overall score: your holistic judgment of translation quality for SXS bilingual reading.

Respond ONLY with valid JSON:
{{"semantic_accuracy": N, "english_fluency": N, "style_preservation": N, "sxs_suitability": N, "overall": N, "reasoning": "brief explanation", "issues": ["issue1", "issue2"]}}
"""


def get_reference_translations():
    """Load reference English translations for our sample passages."""
    with open(ES_FILE) as f:
        es_data = json.load(f)
    with open(EN_FILE) as f:
        en_data = json.load(f)

    refs = {}
    for sample in SAMPLE_PASSAGES:
        ch_idx = sample["chapter"] - 1
        para_idx = sample["paragraph"]

        es_text = sample["spanish"]

        # Get candidate English from our translations
        if ch_idx < len(en_data["chapters"]) and en_data["chapters"][ch_idx]["paragraphs"]:
            paras = en_data["chapters"][ch_idx]["paragraphs"]
            if para_idx < len(paras):
                en_text = paras[para_idx]
            else:
                en_text = "(not available)"
        else:
            en_text = "(not available)"

        refs[sample["id"]] = {
            "source": es_text,
            "candidate": en_text,
        }

    return refs


def run_judge(source: str, candidate: str, context: str, model: str = MODEL) -> dict:
    """Call judge LLM to evaluate a translation."""
    prompt = JUDGE_PROMPT_TEMPLATE.format(
        spanish=source,
        english=candidate,
        context=context,
    )

    result = subprocess.run(
        [str(OPENCODE_BIN), "run", "--model", model, prompt],
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Judge failed: {result.stderr[:200]}")

    raw = result.stdout

    # Parse JSON from output
    try:
        # Try to extract JSON block
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            return json.loads(match.group())
        # Try parsing the whole thing as JSON
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError) as e:
        return {
            "error": f"Failed to parse judge output: {e}",
            "raw": raw[:500],
            "semantic_accuracy": 0,
            "english_fluency": 0,
            "style_preservation": 0,
            "sxs_suitability": 0,
            "overall": 0,
            "reasoning": "",
            "issues": ["JSON parse error"],
        }


def evaluate_translations(translations: dict, model: str = MODEL, verbose: bool = False) -> list[dict]:
    """Evaluate all translations with the judge."""
    results = []

    for sample_id, data in translations.items():
        spanish = data["source"]
        candidate = data["candidate"]
        context = next(s["context"] for s in SAMPLE_PASSAGES if s["id"] == sample_id)

        print(f"  Evaluating {sample_id}...", end="", flush=True)

        if candidate == "(not available)":
            print(" SKIP (no translation)")
            results.append({
                "id": sample_id,
                "skipped": True,
                "reason": "no translation available",
            })
            continue

        try:
            scores = run_judge(spanish, candidate, context, model)
            results.append({
                "id": sample_id,
                "model": model,
                "spanish": spanish,
                "candidate": candidate,
                **scores,
            })

            overall = scores.get("overall", 0)
            print(f" overall={overall}/10")

            if verbose:
                print(f"    SA={scores.get('semantic_accuracy')} EF={scores.get('english_fluency')} "
                      f"ST={scores.get('style_preservation')} SXS={scores.get('sxs_suitability')}")
                if scores.get("reasoning"):
                    print(f"    Reasoning: {scores['reasoning'][:200]}")

        except Exception as e:
            print(f" ERROR: {e}")
            results.append({"id": sample_id, "error": str(e)[:200]})

        time.sleep(1)

    return results


def summarize_results(results: list[dict]) -> dict:
    """Aggregate scores across all evaluated passages."""
    valid = [r for r in results if not r.get("skipped") and not r.get("error") and r.get("overall", 0) > 0]

    if not valid:
        return {"error": "No valid results to summarize"}

    dims = ["semantic_accuracy", "english_fluency", "style_preservation", "sxs_suitability", "overall"]
    summary = {}
    for dim in dims:
        scores = [r[dim] for r in valid if dim in r and isinstance(r[dim], (int, float))]
        summary[dim] = {
            "mean": round(sum(scores) / len(scores), 2) if scores else 0,
            "min": min(scores) if scores else 0,
            "max": max(scores) if scores else 0,
            "count": len(scores),
        }

    return summary


def print_summary(summary: dict, verbose: bool = False):
    """Print a formatted summary."""
    print(f"\n{'='*60}")
    print("JUDGE EVALUATION SUMMARY")
    print(f"{'='*60}")

    dim_labels = {
        "semantic_accuracy": "Semantic Accuracy",
        "english_fluency": "English Fluency",
        "style_preservation": "Style Preservation",
        "sxs_suitability": "SXS Suitability",
        "overall": "OVERALL",
    }

    for dim, label in dim_labels.items():
        if dim in summary:
            s = summary[dim]
            bar = "█" * int(s["mean"]) + "░" * (10 - int(s["mean"]))
            print(f"  {label:<22} {s['mean']:.1f}/10  {bar}  (min={s['min']}, max={s['max']})")

    print(f"{'='*60}")


def run_comparison(models: list[str], verbose: bool = False):
    """Compare multiple models on the same passages."""
    translations = get_reference_translations()

    all_results = {}

    for model in models:
        print(f"\n{'='*60}")
        print(f"Model: {model}")
        print(f"{'='*60}")
        results = evaluate_translations(translations, model=model, verbose=verbose)
        all_results[model] = results
        summary = summarize_results(results)
        print_summary(summary, verbose)

    # Compare models side by side
    print(f"\n{'='*60}")
    print("MODEL COMPARISON")
    print(f"{'='*60}")
    print(f"{'Dimension':<22} " + "  ".join(f"{m.split('/')[-1]:>12}" for m in models))
    print("-" * 60)

    dims = ["semantic_accuracy", "english_fluency", "style_preservation", "sxs_suitability", "overall"]
    dim_labels = {
        "semantic_accuracy": "Semantic Acc.",
        "english_fluency": "English Fluency",
        "style_preservation": "Style Preserv.",
        "sxs_suitability": "SXS Suitability",
        "overall": "OVERALL",
    }

    for dim in dims:
        row = f"{dim_labels[dim]:<22} "
        for model in models:
            results = all_results[model]
            valid = [r for r in results if not r.get("skipped") and not r.get("error") and r.get("overall", 0) > 0]
            scores = [r[dim] for r in valid if dim in r and isinstance(r[dim], (int, float))]
            mean = round(sum(scores) / len(scores), 1) if scores else 0
            row += f"{mean:>12.1f}"
        print(row)

    # Save results
    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "models": models,
        "passages": [s["id"] for s in SAMPLE_PASSAGES],
        "results": all_results,
    }
    with open(RESULTS_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to {RESULTS_FILE}")


def main():
    parser = argparse.ArgumentParser(description="LLM judge evaluation for Don Quijote translations")
    parser.add_argument("--compare", "-c", action="store_true", help="Compare multiple models")
    parser.add_argument("--models", nargs="+", help="Models to compare, e.g. opencode/minimax-m2.5-free openai/gpt-4o")
    parser.add_argument("--model", "-m", default=MODEL, help=f"Judge model (default: {MODEL})")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed scores")
    args = parser.parse_args()

    translations = get_reference_translations()

    print(f"{'='*60}")
    print("Don Quijote — LLM Judge Evaluation")
    print(f"{'='*60}")
    print(f"Judge model: {args.model}")
    print(f"Passages: {len(SAMPLE_PASSAGES)}")
    print()

    if args.compare and args.models:
        run_comparison(args.models, args.verbose)
        return

    if args.compare:
        # Default comparison
        run_comparison([
            "opencode/minimax-m2.5-free",
            "openai/gpt-4o",
        ], args.verbose)
        return

    # Single model evaluation
    print(f"Evaluating {len(translations)} passages...\n")
    results = evaluate_translations(translations, model=args.model, verbose=args.verbose)
    summary = summarize_results(results)
    print_summary(summary, args.verbose)

    # Save
    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "passages": [s["id"] for s in SAMPLE_PASSAGES],
        "results": results,
        "summary": summary,
    }
    with open(RESULTS_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nResults saved to {RESULTS_FILE}")


if __name__ == "__main__":
    main()

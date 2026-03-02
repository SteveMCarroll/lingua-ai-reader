#!/usr/bin/env python3
"""Enrich precomputed vocab JSON files with dictionary form + English translation."""

from __future__ import annotations

import argparse
import json
import os
from glob import glob
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from urllib.error import HTTPError
from urllib.request import Request, urlopen


SYSTEM_PROMPT = (
    "You are a Spanish tutor. Return ONLY valid JSON object keyed by original token. "
    "For each token, return {\"dictionaryForm\": \"...\", \"translation\": \"...\"}. "
    "dictionaryForm must be lowercase lemma (example: \"nuestras\" -> \"nuestro\"). "
    "translation must be a short plain-English gloss."
)


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def strip_fences(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return cleaned


def lookup_token_batch(
    tokens: List[str], endpoint: str, api_key: str, deployment: str, api_version: str
) -> Dict[str, Tuple[str, str]]:
    url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps({"tokens": tokens}, ensure_ascii=False)},
        ],
        "temperature": 0,
        "max_tokens": 1800,
        "response_format": {"type": "json_object"},
    }

    req = Request(
        url,
        method="POST",
        headers={"Content-Type": "application/json", "api-key": api_key},
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
    )

    try:
        with urlopen(req, timeout=90) as res:
            body = json.loads(res.read().decode("utf-8"))
    except HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Azure OpenAI error {exc.code}: {details}") from exc

    content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content:
        raise RuntimeError("No content in batch response")

    parsed = json.loads(strip_fences(content))
    out: Dict[str, Tuple[str, str]] = {}
    for token in tokens:
        entry = parsed.get(token, {}) if isinstance(parsed, dict) else {}
        dictionary_form = str(entry.get("dictionaryForm", "")).strip().lower() or token
        translation = str(entry.get("translation", "")).strip()
        out[token] = (dictionary_form, translation)
    return out


def batched(values: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(values), size):
        yield values[i : i + size]


def main() -> int:
    parser = argparse.ArgumentParser(description="Add translation fields to public vocab JSON files")
    parser.add_argument("--glob", default="public/vocab/*.json", help="Glob for vocab JSON files")
    parser.add_argument("--batch-size", type=int, default=40, help="Tokens per model call")
    args = parser.parse_args()

    endpoint = get_env("AZURE_OPENAI_ENDPOINT")
    api_key = get_env("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1-mini")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")

    files = [Path(p) for p in glob(args.glob)]
    if not files:
        raise RuntimeError(f"No files matched: {args.glob}")

    data_by_file: Dict[Path, Dict] = {}
    missing_tokens: set[str] = set()

    for path in files:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        data_by_file[path] = data

        all_items = list(data.get("book_vocab", {}).get("vocabulary", []))
        for chapter in data.get("chapters", []):
            all_items.extend(chapter.get("vocabulary", []))

        for item in all_items:
            token = item.get("token")
            if not token:
                continue
            if item.get("dictionary_form") and item.get("translation_en"):
                continue
            missing_tokens.add(token)

    sorted_tokens = sorted(missing_tokens)
    print(f"Need to enrich {len(sorted_tokens)} unique tokens.", flush=True)

    cache: Dict[str, Tuple[str, str]] = {}
    for index, chunk in enumerate(batched(sorted_tokens, max(1, args.batch_size)), start=1):
        batch_result = lookup_token_batch(chunk, endpoint, api_key, deployment, api_version)
        cache.update(batch_result)
        print(
            f"Batch {index}: enriched {len(chunk)} tokens ({len(cache)}/{len(sorted_tokens)} total).",
            flush=True,
        )

    for path, data in data_by_file.items():
        def enrich_items(items: List[Dict]) -> None:
            for item in items:
                token = item.get("token")
                if not token:
                    continue
                if token not in cache:
                    continue
                dictionary_form, translation_en = cache[token]
                item["dictionary_form"] = dictionary_form
                item["translation_en"] = translation_en

        enrich_items(data.get("book_vocab", {}).get("vocabulary", []))
        for chapter in data.get("chapters", []):
            enrich_items(chapter.get("vocabulary", []))

        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Wrote {path}", flush=True)

    print(f"Done. Cached {len(cache)} token translations.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

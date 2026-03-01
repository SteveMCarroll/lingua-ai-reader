#!/usr/bin/env python3
"""Vocabulary analyzer for Lingua AI Reader.

Extracts characteristic vocabulary from Spanish texts for language learners.
Designed to work with both curated book collections and user-uploaded EPUBs.

Usage:
    python vocab_analyzer.py --book don-quijote --output-json vocab.json
    python vocab_analyzer.py --file uploaded.epub --language es --output-json vocab.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

from wordfreq import zipf_frequency


# Spanish stoplist - function words that aren't vocabulary targets
STOP = {
    "a", "al", "algo", "algunas", "algunos", "ante", "antes", "aquí", "así", "aun", "aún",
    "como", "con", "contra", "cual", "cuales", "cuando", "cuanto", "cuantos",
    "de", "del", "desde", "donde", "dos", "durante",
    "el", "ella", "ellas", "ellos", "en", "entre", "era", "erais", "eran", "eras", "eres", "es", "esa", "esas", "ese", "eso", "esos",
    "esta", "estaba", "estado", "estais", "estamos", "estan", "estar", "estas", "este", "esto", "estos",
    "fue", "fueron", "ha", "hace", "hacia", "han", "hasta", "hay", "he",
    "la", "las", "le", "les", "lo", "los",
    "mas", "más", "me", "mi", "mis", "muy",
    "no", "nos", "nuestra", "nuestro",
    "o", "os",
    "para", "pero", "por", "porque",
    "que", "qué", "quien", "quién", "quienes", "se", "sin", "sobre", "su", "sus",
    "tambien", "también", "te", "tener", "tengo", "ti", "tiene", "tienen",
    "todo", "todos", "tu", "tus",
    "un", "una", "uno", "unos",
    "y", "ya",
}

# Tokenizer for Spanish-ish text
TOKEN_RE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?")


@dataclass
class Chapter:
    title: str
    paragraphs: List[str]


@dataclass
class Book:
    book_id: str
    title: str
    author: str
    chapters: List[Chapter]


@dataclass
class VocabResult:
    token: str
    score: float
    count: int
    frequency_per_1000: float
    dispersion: float  # 0-1 across chapters
    modern_zipf: float  # modern Spanish frequency
    rarity_tag: str  # "archaic", "rare", "uncommon", "common"
    is_tic: bool  # dialogue/narration verb


def normalize(token: str) -> str:
    return token.strip("'").lower()


def tokenize_with_caps(text: str) -> Tuple[List[str], Counter]:
    toks = []
    caps = Counter()
    for m in TOKEN_RE.finditer(text):
        raw = m.group(0)
        norm = normalize(raw)
        if not norm:
            continue
        toks.append(norm)
        if raw[:1].isupper():
            caps[norm] += 1
    return toks, caps


def chapter_text(ch: Chapter) -> str:
    return "\n".join([ch.title] + ch.paragraphs)


def book_text(book: Book) -> str:
    return "\n".join(chapter_text(ch) for ch in book.chapters)


def get_rarity_tag(zipf_score: float) -> str:
    """Tag based on modern Spanish frequency."""
    if zipf_score < 3.0:
        return "archaic"
    elif zipf_score < 4.0:
        return "rare"
    elif zipf_score < 5.0:
        return "uncommon"
    else:
        return "common"


def compute_zipf_penalty(zipf_score: float) -> float:
    """Penalty based on modern Spanish frequency - lower = more penalty."""
    if zipf_score >= 5.8:
        return 0.05  # Very common words (el/la/de)
    elif zipf_score >= 5.2:
        return 0.15  # Common words (hacer/tener)
    elif zipf_score >= 4.8:
        return 0.4   # Moderately frequent
    else:
        # Smooth curve for less common words
        return 1.0 / (1.0 + math.exp(2.5 * (zipf_score - 4.2)))


def recommended_vocab_size(total_tokens: int) -> int:
    """Sublinear scaling: longer books need more vocab, but not linearly."""
    n = int(round(0.6 * math.sqrt(max(1, total_tokens))))
    return max(30, min(250, n))


def analyze_book(
    book: Book,
    reference_corpus: Optional[Dict[str, int]] = None,
    reference_total: int = 0,
    top_n: Optional[int] = None
) -> Dict:
    """Analyze vocabulary for a single book."""
    
    # Compute per-chapter stats
    book_counts = Counter()
    book_caps = Counter()
    chapter_presence = Counter()
    chapter_tokens = []
    
    for i, ch in enumerate(book.chapters):
        toks, caps = tokenize_with_caps(chapter_text(ch))
        chapter_tokens.append(toks)
        
        uniq = set(toks)
        for t in uniq:
            chapter_presence[t] += 1
        
        book_counts.update(toks)
        book_caps.update(caps)
    
    total_tokens = sum(len(toks) for toks in chapter_tokens)
    num_chapters = len(book.chapters)
    
    # Dynamic thresholds based on length
    min_count = max(3, int(round(total_tokens / 25000)))
    min_disp = 0.0 if num_chapters <= 1 else (0.15 if num_chapters <= 3 else 0.12)
    
    # Use reference corpus or compute from other chapters
    if reference_corpus is None:
        # For single-book analysis, use chapter-vs-rest comparison
        bg_counts = Counter()
    else:
        bg_counts = reference_corpus
    
    bg_total = max(1, reference_total)
    
    # Score each candidate
    results = []
    for token, count in book_counts.items():
        if token in STOP:
            continue
        if len(token) < 3:
            continue
        if count < min_count:
            continue
        
        dispersion = chapter_presence[token] / max(1, num_chapters)
        if dispersion < min_disp:
            continue
        
        # Capitalization ratio for proper noun filtering
        cap_ratio = book_caps.get(token, 0) / max(1, count)
        if cap_ratio > 0.75:
            continue
        
        # Modern Spanish frequency
        modern_zipf = zipf_frequency(token, "es")
        
        # Compute score
        # Simple TF-based scoring with zipf penalty
        tf = count / total_tokens
        freq_per_1000 = count * 1000 / total_tokens
        zipf_penalty = compute_zipf_penalty(modern_zipf)
        
        # Bonus for cross-chapter distribution
        disp_bonus = 0.25 + 0.75 * dispersion
        
        # Reference corpus comparison (if available)
        if reference_corpus:
            bg_count = bg_counts.get(token, 0)
            # If word is much more common in this book vs background, boost
            if bg_count > 0:
                bg_freq = bg_count / bg_total
                tf_idf_factor = math.log(tf / bg_freq + 1)
            else:
                tf_idf_factor = 2.0  # Word not in background = very distinctive
        else:
            tf_idf_factor = 1.0
        
        score = freq_per_1000 * zipf_penalty * disp_bonus * tf_idf_factor
        
        # Check if it's a dialogue/narration tic
        is_tic = token in {
            "dijo", "decía", "respondió", "respondia", "exclamó", "exclamo",
            "contestó", "contesto", "repuso", "preguntó", "pregunto",
            "gritó", "grito", "murmuró", "murmuro", "añadió", "anadió", "anadio",
            "prosiguió", "prosiguio", "continuó", "continuo", "observó", "observo",
            "repitió", "repitio"
        }
        
        results.append(VocabResult(
            token=token,
            score=score,
            count=count,
            frequency_per_1000=freq_per_1000,
            dispersion=dispersion,
            modern_zipf=modern_zipf,
            rarity_tag=get_rarity_tag(modern_zipf),
            is_tic=is_tic
        ))
    
    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    
    # Determine how many to return
    rec_top = recommended_vocab_size(total_tokens)
    take = top_n if top_n is not None else rec_top
    
    # Format output
    top_results = results[:take]
    
    return {
        "book_id": book.book_id,
        "title": book.title,
        "author": book.author,
        "total_tokens": total_tokens,
        "num_chapters": num_chapters,
        "recommended_top": rec_top,
        "min_count": min_count,
        "vocabulary": [
            {
                "token": r.token,
                "score": round(r.score, 3),
                "count": r.count,
                "frequency_per_1000": round(r.frequency_per_1000, 2),
                "dispersion": round(r.dispersion, 3),
                "modern_zipf": r.modern_zipf,
                "rarity_tag": r.rarity_tag,
                "is_tic": r.is_tic
            }
            for r in top_results
        ]
    }


def load_book_from_json(book_id: str, content_dir: Path) -> Book:
    """Load a book from the JSON format used by Lingua AI Reader."""
    json_path = content_dir / f"{book_id}.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    chapters = [
        Chapter(title=ch.get("title", ""), paragraphs=ch.get("paragraphs", []))
        for ch in data.get("chapters", [])
    ]
    
    return Book(
        book_id=data["id"],
        title=data["title"],
        author=data["author"],
        chapters=chapters
    )


def analyze_chapter_vocab(book: Book, chapter_idx: int) -> Dict:
    """Analyze vocabulary for a single chapter vs the rest of the book."""
    if chapter_idx < 0 or chapter_idx >= len(book.chapters):
        raise ValueError(f"Invalid chapter index {chapter_idx}")
    
    target_ch = book.chapters[chapter_idx]
    target_text = chapter_text(target_ch)
    
    # Build "rest of book" corpus
    rest_text = "\n".join(
        chapter_text(ch) for i, ch in enumerate(book.chapters) if i != chapter_idx
    )
    
    # Tokenize both
    target_toks, _ = tokenize_with_caps(target_text)
    rest_toks, _ = tokenize_with_caps(rest_text)
    
    target_counts = Counter(target_toks)
    rest_counts = Counter(rest_toks)
    
    target_total = len(target_toks)
    rest_total = len(rest_toks)
    
    # Similar analysis as book-level but chapter-focused
    results = []
    min_count = 2  # Lower threshold for single chapter
    
    for token, count in target_counts.items():
        if token in STOP or len(token) < 3:
            continue
        if count < min_count:
            continue
        
        modern_zipf = zipf_frequency(token, "es")
        zipf_penalty = compute_zipf_penalty(modern_zipf)
        
        # Distinctiveness vs rest of book
        tf = count / target_total
        rest_count = rest_counts.get(token, 0)
        rest_freq = rest_count / max(1, rest_total)
        
        # Boost if much more common in this chapter
        if rest_count == 0:
            distinctiveness = 3.0
        else:
            distinctiveness = max(1.0, math.log(tf / rest_freq + 1))
        
        freq_per_1000 = count * 1000 / target_total
        score = freq_per_1000 * zipf_penalty * distinctiveness
        
        is_tic = token in {
            "dijo", "decía", "respondió", "respondia", "exclamó",
            "contestó", "repuso", "preguntó", "gritó", "murmuró"
        }
        
        results.append({
            "token": token,
            "score": round(score, 3),
            "count": count,
            "frequency_per_1000": round(freq_per_1000, 2),
            "modern_zipf": modern_zipf,
            "rarity_tag": get_rarity_tag(modern_zipf),
            "is_tic": is_tic
        })
    
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "book_id": book.book_id,
        "chapter_index": chapter_idx,
        "chapter_title": target_ch.title,
        "total_tokens": target_total,
        "vocabulary": results[:50]  # Top 50 per chapter
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze vocabulary for Spanish texts")
    parser.add_argument("--book", help="Book ID (for curated collection)")
    parser.add_argument("--chapter", type=int, help="Chapter index for chapter-level analysis")
    parser.add_argument("--content-dir", type=Path, default=Path("src/data/content"))
    parser.add_argument("--top", type=int, help="Number of vocabulary items to return")
    parser.add_argument("--output-json", type=Path, help="Output file")
    parser.add_argument("--exclude-tics", action="store_true", help="Exclude dialogue/narration tics")
    
    args = parser.parse_args()
    
    if not args.book:
        print("Error: --book is required")
        return 1
    
    try:
        book = load_book_from_json(args.book, args.content_dir)
        
        if args.chapter is not None:
            result = analyze_chapter_vocab(book, args.chapter)
        else:
            result = analyze_book(book, top_n=args.top)
        
        if args.exclude_tics:
            result["vocabulary"] = [v for v in result["vocabulary"] if not v.get("is_tic")]
        
        if args.output_json:
            with open(args.output_json, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"Results written to {args.output_json}")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
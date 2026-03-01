# Vocabulary Analyzer Design Document

**Status:** Implemented and pushed to GitHub  
**Scope:** Book-level and chapter-level vocabulary extraction for Spanish texts  
**Target Users:** High-intermediate Spanish learners reading literature

---

## Problem We Were Solving

Extract "high-value vocabulary" from Spanish texts that language learners actually need to study. The algorithm must:

1. **Skip basic/common words** - learners already know "vino", "hambre", "casa"
2. **Skip hapax words** - one-off terms aren't worth learning investment
3. **Capture book-characteristic vocabulary** - what makes *this* text challenging
4. **Require chapter-spanning distribution** - avoid studying single-scene terms
5. **Exclude proper nouns** - names aren't vocabulary targets
6. **Work for user-uploaded EPUBs** - not just our curated collection

---

## Approaches We Tried and Abandoned

### Attempt 1: Pure TF-IDF
**What:** Standard TF-IDF across the curated book collection  
**Why Abandoned:** 
- User-uploaded EPUBs have no "document collection" to compare against
- Size differences skewed results (20k word text vs 375k word Quijote)
- Made small texts look artificially distinctive

### Attempt 2: Historical Frequency Database  
**What:** Build custom frequency database from Gutenberg Golden Age texts (1500-1800)

**Why Abandoned:**
- **Key insight from user:** learners are *modern Spanish speakers*, not historical ones
- A word like "merced" being common in 1600s is irrelevant
- Modern speakers struggle with "merced" **because** it's rare today
- **Wrong optimization:** we want words that are hard *for modern readers*

### Attempt 3: Archaic Term Exception List
**What:** Penalize by modern zipf, but whitelist known archaic terms for reduced penalty

**Why Abandoned:**
- Counterproductive: whitelisting suppresses exactly the words learners need
- Low modern zipf scores are the *signal*, not noise
- Would hide "desta", "mesmo", "agora" when these are learning priorities

### Attempt 4: Statistical Keyness (Log-Odds)
**What:** Log-odds ratio with Dirichlet prior comparing book vs background corpus

**Why Modified Not Abandoned:**
- Worked well for curated collections
- Needed: (1) proportional smoothing for corpus size differences, (2) single-book fallback mode
- Concept kept but wrapped in flexible scoring system

---

## Final Algorithm

### Scoring Formula

```
score = frequency_per_1000 × zipf_penalty × dispersion_bonus × distinctiveness
```

### Component Details

**1. frequency_per_1000**
```python
frequency_per_1000 = (word_count × 1000) / total_tokens
```
- Normalizes so short stories and novels are comparable

**2. zipf_penalty (Critical Design Decision)**

```python
if zipf_score >= 5.8:  # el, de, que, y
    penalty = 0.05      # Almost eliminate super-common words
    
elif zipf_score >= 5.2:  # hacer, tener, poder
    penalty = 0.15        # Heavy penalty on common verbs
    
elif zipf_score >= 4.8:  # vino, hambre, pan
    penalty = 0.40        # Moderate penalty
    
else:  # merced, menester, desta, doncella
    penalty = sigmoid(zipf)  # Minimal penalty for rare/archaic terms
```

**Why this works:** Uses `wordfreq` library (modern Spanish corpus). Words rare in *modern* Spanish get minimal penalty. This surfaces exactly the vocabulary that creates friction for contemporary learners reading historical texts.

**3. dispersion_bonus**
```python
bonus = 0.25 + 0.75 × (chapters_present / total_chapters)
```
- Rewards words appearing across multiple chapters
- Single-chapter words get 0.25×, omnipresent words get 1.0×

**4. distinctiveness**
```python
# If analyzing vs reference corpus:
if word in background_corpus:
    distinctiveness = log(tf_this_book / tf_background + 1)
else:
    distinctiveness = 2.0  # Word unique to this book = very distinctive

# If single-chapter mode:
distinctiveness = comparison_vs_rest_of_book()
```

### Dynamic Thresholds

**min_count** (floor on word frequency):
```python
min_count = max(3, total_tokens // 25000)
# Short story (20k): min_count = 3
# Medium novel (80k): min_count = 6
# Long novel (375k): min_count = 15
```

**recommended_vocab_size** (output list length):
```python
vocab_size = clamp(30, int(0.6 × sqrt(total_tokens)), 250)
# Short story: ~85 terms
# Medium novel: ~170 terms  
# Long novel: ~250 terms
```
- Sublinear scaling: longer books need more coverage but not linearly

### Filtering Pipeline

1. **Stopword removal** - 100+ Spanish function words
2. **Minimum length** - len(token) >= 3
3. **Minimum count** - dynamic threshold above
4. **Dispersion filter** - must appear in 12-35% of chapters
5. **Proper noun filter** - capitalization ratio > 75% = exclude

### Tagging System

```json
{
  "token": "mesma",
  "score": 6.69,
  "count": 85,
  "frequency_per_1000": 0.23,
  "dispersion": 0.365,
  "modern_zipf": 1.73,
  "rarity_tag": "archaic",
  "is_tic": false
}
```

**rarity_tag thresholds:**
- archival: zipf < 3.0
- rare: zipf 3.0-4.0
- uncommon: zipf 4.0-5.0
- common: zipf > 5.0

**is_tic:** Dialogue/narration verbs (dijo, respondió, etc.) tagged separately

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Modern zipf > Historical corpus** | Learners are modern speakers. Low modern zipf identifies their actual friction points. |
| **Keep author tics, tag don't delete** | User: "author tics can be quite valuable." Bucket separately from content vocab. |
| **Sublinear vocab scaling** | Don Quijote (375k words) needs ~250 terms, not 1000+. Diminishing returns. |
| **Surface forms > Lemmas** | "desta" vs "de esta" and "mesmo" vs "mismo" are meaningful learning targets. |
| **No ML models** | Deterministic, explainable, tunable. LLM judge pass is optional enhancement. |

---

## Results

### Don Quijote Example Output
| Rank | Token | Score | Modern Zipf | Tag |
|------|-------|-------|-------------|-----|
| 1 | merced | 32.9 | 3.86 | archaic |
| 2 | vuestra | 18.8 | 4.46 | uncommon |
| 3 | caballero | 14.8 | 4.53 | uncommon |
| 4 | menester | 13.1 | 2.98 | archaic |
| 5 | ventura | 12.1 | 3.56 | archaic |
| 6 | doncella | 9.7 | 3.46 | archaic |

**What we'd want:** archaisms, chivalric register, formal address formulas  
**What we don't get:** "vino" (zipf=4.96, penalized), "hambre" (zipf=4.90, penalized)

### Lazarillo Example Output
| Rank | Token | Score | Modern Zipf | Tag |
|------|-------|-------|-------------|-----|
| 1 | ansí | 0.045 | 1.45 | archaic |
| 2 | amo | 0.026 | 4.85 | uncommon |
| 3 | bula | 0.029 | 3.37 | archaic |
| 4 | jarro | 0.032 | 2.82 | archaic |
| 5 | alguacil | 0.032 | 3.41 | archaic |
| 6 | longaniza | 0.026 | 2.53 | archaic |

**What we'd want:** picaresque vocabulary, archaisms, plot-specific terms  
**What we don't get:** "pan" (too common despite plot centrality)

---

## Usage Patterns

### Book-Level (For Choosing Books)
```bash
python scripts/vocab_analyzer.py --book don-quijote --output-json vocab.json
```
Shows overall difficulty profile and key register vocabulary.

### Chapter-Level (For Pre-Reading)
```bash
python scripts/vocab_analyzer.py --book don-quijote --chapter 5 --output-json ch5_vocab.json
```
Shows vocabulary learner should preview before starting Chapter 5.

---

## Proposed Enhancement: LLM Judge Pass

**Current:** Deterministic algorithm generates ~200 candidates  
**Proposed:** LLM review for final pruning/tiering

### Why Add LLM
- Better proper noun detection (capitalization heuristic misses edge cases)
- Can distinguish "style tic" vs "content vocabulary" more accurately
- Can tier: essential / intermediate / advanced
- Can add 1-line definitions

### Implementation
```python
# Stage 1: Deterministic candidates
candidates = deterministic_an
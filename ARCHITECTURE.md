# Architecture — Lingua AI Reader

## Overview

A mobile-first web app for reading foreign-language books with AI-powered word glosses. Originally Spanish-only; now supports multi-language (Spanish + Japanese) with language-aware tokenization and gloss prompts.

**Live:** https://thankful-sand-0fe06a80f.1.azurestaticapps.net/
**Repo:** https://github.com/SteveMCarroll/lingua-ai-reader

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind CSS 4 |
| API | Azure Functions (Node) calling Azure OpenAI |
| Hosting | Azure Static Web Apps (auto-deploys from `master`) |
| Tests | Playwright (smoke tests) |
| Ingestion | Python + Node scripts in `scripts/` |

---

## Directory Structure

```
lingua-ai-reader/
├── api/                          # Azure Functions backend
│   └── src/functions/gloss.ts    # Single endpoint: POST /api/gloss
├── src/
│   ├── App.tsx                   # Root: book selector ↔ reader toggle
│   ├── components/
│   │   ├── BookSelector.tsx      # Book list page with progress indicators
│   │   ├── Reader.tsx            # Main reader orchestrator (pagination, nav, gloss)
│   │   ├── BookContent.tsx       # Renders paragraphs with [data-word] spans
│   │   ├── GlossPopup.tsx        # Floating popup showing word definition
│   │   ├── ChapterNav.tsx        # Chapter drawer navigation
│   │   ├── SettingsPanel.tsx     # Font size, dark mode, view mode
│   │   └── VocabPanel.tsx        # Vocabulary frequency panel
│   ├── data/
│   │   ├── books.ts              # BookMeta registry + dynamic book loader
│   │   └── content/              # Book JSON files (one per book)
│   │       ├── don-quijote.json
│   │       ├── don-quijote-en.json  # English translation (parallel view)
│   │       ├── marianela.json
│   │       ├── sombrero-tres-picos.json
│   │       ├── conquista-nueva-espana.json
│   │       └── natsu-no-hana.json   # 🆕 Japanese
│   ├── hooks/
│   │   ├── useTextSelection.ts   # Click/drag → selected word + sentence context
│   │   ├── useGloss.ts           # Fetch + cache gloss API responses
│   │   └── useReadingPosition.ts # Persist chapter/page in localStorage
│   ├── lib/
│   │   ├── api.ts                # Gloss API client
│   │   └── vocab.ts              # Load + cache vocab frequency data
│   └── types/
│       └── tiny-segmenter.d.ts   # Type declarations for Japanese tokenizer
├── public/
│   └── vocab/                    # Pre-generated vocab frequency JSON per book
│       ├── marianela.json
│       ├── don-quijote.json
│       ├── sombrero-tres-picos.json
│       └── natsu-no-hana.json    # 🆕 Empty placeholder (no analysis yet)
├── tests/
│   └── smoke.spec.ts             # Playwright smoke tests (9 tests)
├── scripts/                      # Book ingestion & vocab analysis
│   ├── pipelines/                # Per-book processing scripts
│   ├── vocab_analyzer.py         # Frequency + rarity analysis
│   ├── enrich_vocab_translations.py  # Add English glosses to vocab
│   ├── translate_chapters.py     # Generate English translations
│   └── align_chapters.py         # Align ES/EN paragraph pairs
└── playwright.config.ts
```

---

## Data Flow

### Book Loading
1. `books.ts` exports `BookMeta[]` (id, title, author, description, language)
2. `Reader` calls `loadBook(id)` → dynamic `import()` of `content/${id}.json`
3. English translations loaded via `import.meta.glob("*-en.json")` for parallel view
4. Vocab data fetched at runtime from `/vocab/${id}.json`

### Word Selection & Gloss
1. `BookContent` splits paragraphs into `[data-word]` spans
   - **Spanish/English:** `split(/\s+/)` on whitespace
   - **Japanese:** `TinySegmenter.segment()` morphological tokenizer
2. User clicks a word → `useTextSelection` captures `{ text, sentence, rect }`
   - Sentence extraction uses language-aware delimiters (`.!?` + `。！？`)
3. `useGloss` → `fetchGloss()` → `POST /api/gloss` with `{ selectedText, sentence, bookTitle, author, language }`
4. API selects system prompt by language:
   - **Spanish:** IPA pronunciation, standard tutor prompt
   - **Japanese:** Hepburn romaji, kanji reading guidance (onyomi/kunyomi)
5. Response cached in localStorage

### Pagination
- `Reader` computes `pageCharBudget` from viewport + font size
- Long paragraphs split at sentence boundaries
- Paragraphs assigned to pages within char budget

---

## Adding a New Language

1. **Add book content JSON** to `src/data/content/`. Format:
   ```json
   {
     "id": "book-id",
     "title": "Title",
     "author": "Author",
     "chapters": [
       { "title": "1", "paragraphs": ["..."], "isPreface": false }
     ]
   }
   ```

2. **Register in `books.ts`:** Add to `books[]` array with `language` field (e.g. `"ja"`, `"es"`, `"fr"`)

3. **Add vocab placeholder** to `public/vocab/book-id.json`:
   ```json
   {
     "book_id": "book-id",
     "title": "Title",
     "author": "Author",
     "book_vocab": { "total_tokens": 0, "num_chapters": N, "recommended_top": 0, "min_count": 1, "vocabulary": [] },
     "chapters": []
   }
   ```
   ⚠️ Must be an object with `book_vocab.vocabulary`, NOT a bare array `[]`.

4. **Add tokenizer** (if not space-delimited): Edit `BookContent.tsx` → `splitIntoWordSegments()` to handle the new language

5. **Add gloss prompt** in `api/src/functions/gloss.ts` → `LANGUAGE_CONFIG`

6. **Add sentence delimiters** in `useTextSelection.ts` → `extractSentence()` if the language uses non-Western punctuation

7. **Run tests:** `npm run test:smoke`

---

## Key Design Decisions

- **Vocab files are runtime-fetched** (not bundled), so they can be regenerated without rebuilding. Use `cache: "no-cache"` to avoid stale data issues.
- **Gloss responses are cached in localStorage** keyed by `bookId:sentence:word`.
- **Reading progress persisted** in localStorage as `reading-progress:${bookId}`.
- **Tracked words** (previously looked-up) highlighted green in the text.
- **Preface chapters** hidden by default (`showPreface: false` in Reader).

---

## Known Issues / TODO

- [ ] `BookContent.tsx` has Spanish-specific variable names (`spanishParas`, `parallel-col-es`) — should rename to `originalParas` etc.
- [ ] Japanese vocab file is empty placeholder — needs full frequency analysis via `vocab_analyzer.py`
- [ ] No Aozora Bunko ingestion pipeline yet — `natsu-no-hana.json` was hand-converted
- [ ] Gaiji characters (rare kanji like 麒) lost during Aozora HTML conversion — need handling
- [ ] Japanese paragraph pagination splits on `。` but long paragraphs may still paginate poorly
- [ ] No CI test runner — smoke tests only run locally
- [ ] `Reader.tsx` navigation buttons use Spanish text ("Página siguiente", "Capítulo anterior") — should be language-aware

---

## Environment Variables

### Frontend (Vite)
None required — API calls go to `/api/gloss` (same origin via Azure SWA proxy).

### API (Azure Functions)
- `AZURE_OPENAI_ENDPOINT` — Azure OpenAI resource endpoint
- `AZURE_OPENAI_API_KEY` — API key
- `AZURE_OPENAI_DEPLOYMENT` — Model deployment name (default: `gpt-4.1-mini`)
- `AZURE_OPENAI_API_VERSION` — API version (optional)

---

## Deployment

- Push to `master` → GitHub Actions builds + deploys
- Frontend: Azure Static Web Apps
- API: Azure Functions (managed by SWA)
- Required secret: `AZURE_STATIC_WEB_APPS_API_TOKEN`

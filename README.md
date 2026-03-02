# Lingua AI Reader

Lingua AI Reader is a mobile-first web app for Spanish reading immersion.
You can tap words/phrases in real book text to get instant glosses (translation, grammar, IPA, context), keep your place, and read in paginated e-reader style.

## Current highlights

- Tap-to-translate popup with sentence context
- Chapter pagination tuned for mobile portrait reading
- Reading progress restore (chapter + page)
- Repeated-word highlighting for previously looked-up vocabulary
- Optional Wikipedia links for real people/places in glosses

## Tech stack

- Frontend: React + TypeScript + Vite + Tailwind
- API: Azure Functions (`api/`) calling Azure OpenAI
- Hosting: Azure Static Web Apps

## Run locally

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Build & lint

```bash
npm run lint
npm run build
npm --prefix api run build
```

## Pregenerate vocab translations

If you regenerate `public/vocab/*.json`, enrich those files with dictionary forms + English glosses:

```bash
python scripts/enrich_vocab_translations.py
```

Requires `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` (and optional `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`).

## Azure OpenAI configuration

Set these environment variables for real gloss responses:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (default: `gpt-4.1-mini`)
- `AZURE_OPENAI_API_VERSION` (optional)

If not configured in local dev, the app returns mock gloss data.

## GitHub Actions deployment

This repo now includes:

- `.github/workflows/ci.yml` for lint + build checks on PRs/pushes
- `.github/workflows/deploy.yml` for production deploy on push to `master`

Required repository secret:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`

Once that secret is set, merging an approved PR into `master` triggers automatic production deployment.

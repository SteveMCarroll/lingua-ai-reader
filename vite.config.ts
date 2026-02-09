import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import 'dotenv/config'

const SYSTEM_PROMPT = `You are a friendly Spanish language tutor. A student reading a Spanish novel will ask you about words and phrases they encounter. Help them understand the meaning, grammar, and pronunciation.

When a student asks about a word or phrase, provide your answer as a JSON object with these fields: "selected" (the word they asked about), "dictionaryForm" (base/infinitive form), "partOfSpeech", "grammar" (tense, mood, etc.), "ipa" (IPA pronunciation), "translation" (English meaning), "contextualMeaning" (what it means in context, 1-2 sentences), "fullSentence" (the Spanish sentence), "sentenceTranslation" (English translation of that sentence).`;

function glossApiPlugin(): Plugin {
  return {
    name: 'gloss-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/gloss' || req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {};

            const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
            const apiKey = process.env.AZURE_OPENAI_API_KEY;
            const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1-mini';
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

            if (!endpoint || !apiKey) {
              // Fall back to mock if no credentials
              const mock = {
                selected: parsed.selectedText || '',
                dictionaryForm: parsed.selectedText || '',
                partOfSpeech: 'word',
                grammar: '(mock — set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env)',
                ipa: '/…/',
                translation: `[translation of "${parsed.selectedText || ''}"]`,
                contextualMeaning: 'Configure Azure OpenAI credentials in .env for real translations.',
                fullSentence: parsed.sentence || '',
                sentenceTranslation: '[sentence translation]',
              };
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(mock));
              return;
            }

            const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
            const userPrompt = `I'm reading "${parsed.bookTitle}" by ${parsed.author} and I came across "${parsed.selectedText}" in this sentence: "${parsed.sentence}". Can you help me understand it?`;

            const apiRes = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
              },
              body: JSON.stringify({
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 500,
              }),
            });

            if (!apiRes.ok) {
              const errText = await apiRes.text();
              res.statusCode = apiRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Azure OpenAI ${apiRes.status}: ${errText}` }));
              return;
            }

            const data = await apiRes.json() as any;
            let content = data.choices?.[0]?.message?.content;
            if (!content) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'No content in Azure OpenAI response' }));
              return;
            }

            // Strip markdown fences if present
            content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

            res.setHeader('Content-Type', 'application/json');
            res.end(content);
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
        req.on('error', () => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'request error' }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode !== 'production' ? [glossApiPlugin()] : [])],
  envDir: '.',
}))

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mock /api/gloss for local dev when Azure Functions isn't running
function mockGlossPlugin(): Plugin {
  return {
    name: 'mock-gloss-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/gloss' || req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            const mock = {
              selected: parsed.selectedText || '',
              dictionaryForm: parsed.selectedText || '',
              partOfSpeech: 'word',
              grammar: '(mock — connect Azure OpenAI for real glosses)',
              ipa: '/…/',
              translation: `[translation of "${parsed.selectedText || ''}"]`,
              contextualMeaning: `This is a mock response. To get real AI-powered contextual translations, configure AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and run the Azure Functions backend on port 7071.`,
              fullSentence: parsed.sentence || '',
              sentenceTranslation: '[sentence translation]',
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mock));
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
  plugins: [react(), tailwindcss(), ...(mode !== 'production' ? [mockGlossPlugin()] : [])],
}))

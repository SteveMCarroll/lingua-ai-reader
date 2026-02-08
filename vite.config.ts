import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mock /api/gloss for local dev when Azure Functions isn't running
function mockGlossPlugin(): Plugin {
  return {
    name: 'mock-gloss-api',
    configureServer(server) {
      server.middlewares.use('/api/gloss', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());

        // Return a realistic mock response
        const mock = {
          selected: body.selectedText || '',
          dictionaryForm: body.selectedText || '',
          partOfSpeech: 'word',
          grammar: '(mock — connect Azure OpenAI for real glosses)',
          ipa: '/…/',
          translation: `[translation of "${body.selectedText}"]`,
          contextualMeaning: `This is a mock response. To get real AI-powered contextual translations, configure AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and run the Azure Functions backend on port 7071.`,
          fullSentence: body.sentence || '',
          sentenceTranslation: '[sentence translation]',
        };

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mock));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode !== 'production' ? [mockGlossPlugin()] : [])],
  server: {
    proxy: {
      // When Azure Functions is running locally, it takes priority over the mock
      // Remove this proxy block once you confirm the mock works, or keep it for when func is running
    },
  },
}))

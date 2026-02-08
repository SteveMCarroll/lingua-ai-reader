import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface GlossRequest {
  selectedText: string;
  sentence: string;
  bookTitle: string;
  author: string;
}

interface GlossResponse {
  selected: string;
  dictionaryForm: string;
  partOfSpeech: string;
  grammar: string;
  ipa: string;
  translation: string;
  contextualMeaning: string;
  fullSentence: string;
  sentenceTranslation: string;
}

const SYSTEM_PROMPT = `You are a friendly Spanish language tutor. A student reading a Spanish novel will ask you about words and phrases they encounter. Help them understand the meaning, grammar, and pronunciation.

When a student asks about a word or phrase, provide your answer as a JSON object with these fields: "selected" (the word they asked about), "dictionaryForm" (base/infinitive form), "partOfSpeech", "grammar" (tense, mood, etc.), "ipa" (IPA pronunciation), "translation" (English meaning), "contextualMeaning" (what it means in context, 1-2 sentences), "fullSentence" (the Spanish sentence), "sentenceTranslation" (English translation of that sentence).`;

async function callAzureOpenAI(body: GlossRequest): Promise<GlossResponse> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI credentials not configured");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2025-01-01-preview`;

  const userPrompt = `I'm reading "${body.bookTitle}" by ${body.author} and I came across "${body.selectedText}" in this sentence: "${body.sentence}". Can you help me understand it?`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in Azure OpenAI response");
  }

  // Strip markdown fences if present
  content = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  return JSON.parse(content) as GlossResponse;
}

async function glossHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as GlossRequest;

    if (!body.selectedText || !body.sentence) {
      return {
        status: 400,
        jsonBody: { error: "selectedText and sentence are required" },
      };
    }

    const gloss = await callAzureOpenAI(body);

    return {
      status: 200,
      jsonBody: gloss,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      status: 500,
      jsonBody: { error: message },
    };
  }
}

app.http("gloss", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "gloss",
  handler: glossHandler,
});

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

const SYSTEM_PROMPT = `You are a Spanish language tutor helping an intermediate learner read a Spanish novel.
When given a selected word or phrase and its surrounding sentence, return a JSON object with these exact fields:
- selected: the exact text selected
- dictionaryForm: the lemma/infinitive/base form
- partOfSpeech: noun, verb, adjective, adverb, preposition, conjunction, pronoun, article, interjection, or phrase
- grammar: relevant grammatical info (tense, mood, person, gender, number). For multi-word selections, describe the phrase structure.
- ipa: IPA pronunciation of the selected text
- translation: English translation of the word/phrase in isolation
- contextualMeaning: what it means specifically in this sentence context (1-2 sentences, in English)
- fullSentence: the full Spanish sentence for reference
- sentenceTranslation: natural English translation of the full sentence

Return ONLY valid JSON, no markdown fences or extra text.`;

async function callAzureOpenAI(body: GlossRequest): Promise<GlossResponse> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI credentials not configured");
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  const userPrompt = `The reader has selected: "${body.selectedText}"
From this sentence: "${body.sentence}"
From the book: "${body.bookTitle}" by ${body.author}

Return the JSON gloss object.`;

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
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in Azure OpenAI response");
  }

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

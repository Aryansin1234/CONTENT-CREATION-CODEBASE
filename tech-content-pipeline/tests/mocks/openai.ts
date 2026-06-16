// Deterministic OpenAI mock responses for each prompt type

export const MOCK_CLASSIFY_RESPONSE = {
  content_type: "news",
  platform_fit: ["linkedin", "twitter"],
  urgency_score: 8,
  reasoning: "Breaking AI product announcement with broad developer relevance.",
};

export const MOCK_STRUCTURE_RESPONSE = {
  title: "GPT-5 Drops: What Developers Need to Know",
  hook: "The AI game just changed — GPT-5 scores 99% on MMLU.",
  summary: "OpenAI released GPT-5 with significant reasoning improvements. Developers get immediate API access at $15/M tokens.",
  keyPoints: [
    "10x improvement on AIME mathematics benchmark",
    "99% score on MMLU test",
    "Immediate API access for developers",
    "Priced at $15 per million input tokens",
    "Compatible with existing GPT-4 API calls",
  ],
  techStack: ["OpenAI API", "GPT-5"],
  targetAudience: "Software developers and AI practitioners",
  diagramNeeded: false,
  imagePrompt: "Futuristic AI brain with glowing neural networks, dark background, neon blue accents",
  tone: "hype",
};

export const MOCK_CAPTIONS_RESPONSE = {
  linkedin: "GPT-5 just dropped — and the numbers are staggering.\n\n99% on MMLU. 10x AIME improvement. Available via API right now.\n\nHere's what this means for developers:\n\n1. Your existing GPT-4 code works unchanged\n2. Complex reasoning tasks that used to fail now succeed\n3. Pricing is actually lower than GPT-4 Turbo\n\nThe window to build AI-native products is closing. Are you using it?\n\n#OpenAI #GPT5 #AI #MachineLearning #Developers",
  instagram: "GPT-5 is here and it changes everything\n\n#OpenAI #GPT5 #AI #MachineLearning #ArtificialIntelligence #Developers #TechNews #LLM #ChatGPT",
  twitterThread: [
    "GPT-5 just dropped. 99% on MMLU. 10x AIME improvement. Let's break down what this actually means:",
    "2/ The 10x AIME improvement is wild. This benchmark tests olympiad-level math that tripped up GPT-4. That gap just closed.",
    "3/ For developers: your existing API calls work unchanged. OpenAI kept backwards compatibility. Migrate at your own pace.",
    "4/ Pricing: $15/M input tokens. Slightly higher than GPT-4-turbo but the capability jump makes it worth it for complex tasks.",
    "5/ My bet: the first GPT-5 killer app ships within 30 days. What are you building?",
  ],
};

export const MOCK_ORIGINAL_ANGLE = "My take: The real story isn't the benchmark scores — it's that OpenAI just made GPT-4 obsolete overnight, and every company that spent the last year fine-tuning GPT-4 now has to decide whether to rebuild on GPT-5 or fall behind. That's a strategic inflection point, not a product update.";

// Mock the openai module
export function mockOpenAIChat(callIndex = { value: 0 }) {
  const responses = [
    { choices: [{ message: { content: JSON.stringify(MOCK_CLASSIFY_RESPONSE) } }] },
    { choices: [{ message: { content: JSON.stringify(MOCK_STRUCTURE_RESPONSE) } }] },
    { choices: [{ message: { content: JSON.stringify({ url: "https://dalle.test/image.png" }) } }] },
    { choices: [{ message: { content: MOCK_CAPTIONS_RESPONSE.linkedin } }] },
    { choices: [{ message: { content: MOCK_CAPTIONS_RESPONSE.instagram } }] },
    { choices: [{ message: { content: JSON.stringify({ tweets: MOCK_CAPTIONS_RESPONSE.twitterThread }) } }] },
    { choices: [{ message: { content: MOCK_ORIGINAL_ANGLE } }] },
  ];

  return {
    chat: {
      completions: {
        create: async () => responses[callIndex.value++ % responses.length],
      },
    },
    embeddings: {
      create: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    },
    images: {
      generate: async () => ({
        data: [{ url: "https://dalle.test/image.png" }],
      }),
    },
  };
}

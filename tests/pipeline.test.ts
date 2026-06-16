import { seedArticle } from "./fixtures/article";
import { mockOpenAIChat } from "./mocks/openai";
import { mockSupabase, clearMockStore } from "./mocks/supabase";

// Mock external dependencies before importing pipeline nodes
jest.mock("openai", () => ({
  default: jest.fn(() => mockOpenAIChat()),
}));

jest.mock("../src/storage/supabase", () => ({
  supabase: mockSupabase,
  uploadToSupabase: jest.fn().mockResolvedValue("https://storage.test/asset.png"),
}));

jest.mock("puppeteer", () => ({
  default: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn(),
        waitForSelector: jest.fn(),
        screenshot: jest.fn().mockResolvedValue(Buffer.from("png")),
        pdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
}));

jest.mock("../src/approval/telegram-bot", () => ({
  TelegramApprovalGate: jest.fn().mockImplementation(() => ({
    requestApproval: jest.fn().mockResolvedValue({
      status: "approved",
      scheduleDelay: 0,
    }),
    stopPolling: jest.fn(),
  })),
}));

// Import nodes after mocks are set up
import { classifyNode } from "../src/pipeline/nodes/classify";
import { structureNode } from "../src/pipeline/nodes/structure";
import { generateCaptionsNode } from "../src/pipeline/nodes/generateCaptions";
import { generateOriginalAngleNode } from "../src/pipeline/nodes/generateOriginalAngle";
import { deduplicateNode } from "../src/pipeline/nodes/deduplicate";
import type { PipelineState as PS } from "../src/pipeline/state";

type State = typeof PS.State;

const baseState: State = {
  rawArticles: [],
  dedupedArticles: [],
  currentArticle: seedArticle,
  contentType: null,
  platformFit: [],
  urgencyScore: 0,
  structuredContent: null,
  mermaidCode: null,
  imageUrl: null,
  carouselUrl: null,
  quoteCardUrl: null,
  pdfUrl: null,
  videoScript: null,
  originalAngle: null,
  captionVariants: null,
  accountName: null,
  captions: null,
  approvalStatus: "pending",
  approvalEdits: null,
  scheduleDelay: 0,
  postResults: [],
  errors: [],
};

beforeEach(() => clearMockStore());

describe("classifyNode", () => {
  it("returns contentType and platformFit", async () => {
    const result = await classifyNode(baseState);
    expect(result.contentType).toBe("news");
    expect(result.platformFit).toContain("linkedin");
    expect(typeof result.urgencyScore).toBe("number");
  });

  it("rejects articles below MIN_URGENCY_SCORE", async () => {
    process.env.MIN_URGENCY_SCORE = "9";
    const result = await classifyNode({ ...baseState });
    // urgency_score=8 < 9 → rejected
    expect(result.approvalStatus).toBe("rejected");
    delete process.env.MIN_URGENCY_SCORE;
  });
});

describe("structureNode", () => {
  it("returns structuredContent with required fields", async () => {
    const state: State = {
      ...baseState,
      contentType: "news",
    };
    const result = await structureNode(state);
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent?.keyPoints.length).toBeGreaterThan(0);
    expect(result.structuredContent?.hook).toBeTruthy();
  });
});

describe("generateCaptionsNode", () => {
  it("generates captions for all specified platforms", async () => {
    const state: State = {
      ...baseState,
      contentType: "news",
      platformFit: ["linkedin", "twitter", "instagram"],
      structuredContent: {
        title: "Test",
        hook: "Test hook",
        summary: "Test summary",
        keyPoints: ["Point 1", "Point 2"],
        techStack: ["Node.js"],
        targetAudience: "Developers",
        diagramNeeded: false,
        imagePrompt: "A test image",
        tone: "hype",
      },
    };
    const result = await generateCaptionsNode(state);
    expect(result.captions?.linkedin).toBeTruthy();
    expect(Array.isArray(result.captions?.twitterThread)).toBe(true);
  });
});

describe("generateOriginalAngleNode", () => {
  it("appends original angle to LinkedIn caption", async () => {
    const state: State = {
      ...baseState,
      contentType: "news",
      structuredContent: {
        title: "Test", hook: "H", summary: "S",
        keyPoints: ["P1"], techStack: [], targetAudience: "Dev",
        diagramNeeded: false, imagePrompt: "img", tone: "hype",
      },
      captions: { linkedin: "Original caption", instagram: "", twitterThread: [] },
    };
    const result = await generateOriginalAngleNode(state);
    expect(result.captions?.linkedin).toContain("My take:");
    expect(result.originalAngle).toBeTruthy();
  });
});

describe("deduplicateNode", () => {
  it("removes articles with seen URL hashes", async () => {
    mockSupabase.from("processed_articles").insert({
      url_hash: seedArticle.urlHash,
      title: seedArticle.title,
      source: seedArticle.source,
    });

    const state: State = { ...baseState, rawArticles: [seedArticle], currentArticle: null };
    const result = await deduplicateNode(state);
    expect(result.dedupedArticles?.length).toBe(0);
  });
});

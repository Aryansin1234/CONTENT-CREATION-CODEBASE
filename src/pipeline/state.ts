import { Annotation } from "@langchain/langgraph";

export type ContentType = "tutorial" | "news" | "opinion" | "tool_spotlight" | "deep_dive";
export type Platform = "linkedin" | "instagram" | "twitter" | "threads";

export interface RawArticle {
  id: string;
  url: string;
  title: string;
  description: string;
  content: string;
  source: string;
  publishedAt: string;
  urlHash: string;
}

export interface StructuredContent {
  title: string;
  hook: string;
  summary: string;
  keyPoints: string[];
  techStack: string[];
  targetAudience: string;
  diagramNeeded: boolean;
  diagramDescription?: string;
  imagePrompt: string;
  tone: "educational" | "conversational" | "hype" | "analytical";
}

export interface PlatformCaptions {
  linkedin: string;
  instagram: string;
  twitterThread: string[];
  threads?: string;
}

export interface PostResult {
  platform: Platform;
  postId: string;
  url: string;
  postedAt: string;
}

export interface PipelineError {
  node: string;
  message: string;
  timestamp: string;
}

export interface ApprovalPayload {
  id: string;
  article: RawArticle;
  captions: PlatformCaptions;
  imageUrl: string;
  carouselUrl?: string;
  quoteCardUrl?: string;
  videoScript?: string;
}

export interface ApprovalDecision {
  status: "approved" | "rejected" | "edit_requested";
  edits?: Partial<PlatformCaptions>;
  scheduleTime?: string;
  scheduleDelay?: number;
}

export const PipelineState = Annotation.Root({
  rawArticles: Annotation<RawArticle[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  dedupedArticles: Annotation<RawArticle[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  currentArticle: Annotation<RawArticle | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  contentType: Annotation<ContentType | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  platformFit: Annotation<Platform[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  urgencyScore: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  structuredContent: Annotation<StructuredContent | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  mermaidCode: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  imageUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  carouselUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  quoteCardUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  pdfUrl: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  videoScript: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  originalAngle: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  captionVariants: Annotation<PlatformCaptions[] | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  accountName: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  captions: Annotation<PlatformCaptions | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  approvalStatus: Annotation<"pending" | "approved" | "rejected" | "edit_requested">({
    reducer: (_, next) => next,
    default: () => "pending",
  }),

  approvalEdits: Annotation<Partial<PlatformCaptions> | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  scheduleDelay: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),

  postResults: Annotation<PostResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  errors: Annotation<PipelineError[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

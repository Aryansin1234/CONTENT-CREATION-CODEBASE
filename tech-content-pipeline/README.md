# Tech Content Creation Pipeline

AI-powered automation that turns raw tech news into polished, platform-specific social content — fully automated from ingestion to posting, with a human-in-the-loop approval gate before anything goes live.

```
Ingest → Deduplicate → Classify → Structure → Visualize → Caption → Approve → Post
```

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Full Feature List](#full-feature-list)
3. [Tech Stack](#tech-stack)
4. [Docker (Recommended)](#docker-recommended)
5. [Quick Start](#quick-start)
6. [Environment Setup](#environment-setup)
7. [Database Migrations](#database-migrations)
8. [Prompt Versioning & Voice Customisation](#prompt-versioning--voice-customisation)
9. [Content Formats](#content-formats)
10. [The Approval Gate](#the-approval-gate)
11. [Web Dashboard](#web-dashboard)
12. [Background Workers](#background-workers)
13. [Admin CLI](#admin-cli)
14. [Multi-Account Support](#multi-account-support)
15. [Reliability & Monitoring](#reliability--monitoring)
16. [Running Tests](#running-tests)
17. [Project Structure](#project-structure)
18. [Platform Formatting Rules](#platform-formatting-rules)
19. [Troubleshooting](#troubleshooting)

---

## What It Does

| Step | What happens |
|------|-------------|
| **Ingest** | Pulls tech news from 5 sources in parallel: NewsAPI, GNews, Dev.to RSS, Hacker News, Product Hunt |
| **Deduplicate** | Exact URL-hash filter against already-processed articles + semantic cosine similarity via OpenAI embeddings (threshold 0.92) |
| **Classify** | GPT-4o labels each article: `tutorial` / `news` / `opinion` / `tool_spotlight` / `deep_dive` + platform fit + urgency score |
| **Structure** | GPT-4o extracts hook, summary, key points, tech stack, and audience using per-type prompt files from `prompts/` |
| **Video Script** | For tutorials and tool spotlights, GPT-4o writes a 60-second vertical video script with B-roll and pause markers |
| **Visualise** | Mermaid diagram (tutorials/deep-dives) or DALL-E 3 image (news/tools), Replicate SDXL fallback; LinkedIn gets a PDF carousel; opinion/news get styled quote cards |
| **Caption** | GPT-4o writes LinkedIn (800–1,200 chars), Instagram (125-char hook + hashtags), Twitter/X thread (5–7 tweets), and Threads in parallel — all in your voice via `tone-profile.txt` |
| **Original Angle** | GPT-4o appends one opinionated first-person paragraph to the LinkedIn caption |
| **Approve** | Telegram bot (single or bulk review) or web dashboard at `localhost:3000` — approve / reject / edit / schedule |
| **Post** | BullMQ queue dispatches to LinkedIn API, Instagram Graph API, Twitter/X API v2, and Threads API with rate-limit awareness and 3× retry |

---

## Full Feature List

### Core Pipeline
- 5-source parallel news ingestion with per-source health monitoring
- Two-stage deduplication: exact URL hash + semantic embeddings
- GPT-4o classification with urgency filtering and content-type auto-bias over time
- Google Trends score boost — articles on trending topics get higher urgency scores
- Per-content-type structuring prompts loaded from versioned `prompts/*.txt` files
- Tone-profile injection — paste your best posts into `prompts/tone-profile.txt` and every caption matches your voice

### Content Formats & Platforms
- **LinkedIn** — 800–1,200 char post + original opinionated angle appended automatically
- **LinkedIn Carousel** — 8-slide branded PDF (cover + key-point slides + CTA) for tutorials/deep-dives
- **Instagram** — 125-char hook + hashtag block (25–30 tags)
- **Twitter/X** — 5–7 tweet thread with image on first tweet
- **Threads (Meta)** — reuses Instagram credentials, posts first tweet as Threads text
- **Quote Cards** — SVG-rendered dark-theme image with extracted quote for opinion/news types
- **Mermaid Diagrams** — GPT-4o generates diagram code → Puppeteer renders PNG + PDF
- **Video Scripts** — 60-second vertical script with `[PAUSE]` and `[B-ROLL: description]` markers
- **Weekly Newsletter Digest** — Sunday 7pm; summarises top 5 articles; posts as Beehiiv draft or logs to console

### Approval & Workflow
- **Telegram single review** — image + caption preview + inline keyboard
- **Telegram bulk review** — "5 articles ready. Reply 'all' or a number"
- **Scheduled posting** — Post now / +2h / +4h / Tomorrow 8am / Custom time slots via BullMQ `delay`
- **Rejection reason tracking** — 4 structured codes stored to Supabase (Off-brand / Low quality / Already covered / Too promotional)
- **Edit loop** — edit any platform's caption and re-review before posting; GPT-4o applies text-instruction edits
- **Web dashboard** — Next.js app at `localhost:3000` with review cards, analytics charts, and weekly calendar view

### Reliability & Safety
- **Idempotency guard** — checks `post_results` before queuing; never double-posts the same article to the same platform
- **Dead letter queue** — exhausted BullMQ jobs move to `failed-posts` queue + Telegram alert + Supabase log
- **Source health monitoring** — Telegram alert after 3 consecutive failures from any news source
- **Rate-limit awareness** — platform daily post counters; jobs delayed 15 min when approaching limits (85% threshold)
- **3× retry with exponential backoff** — 5s base delay on all posting jobs

### Intelligence & Growth
- **Feedback loop** — Monday 9am worker fetches LinkedIn + Twitter engagement metrics into `post_analytics`
- **Original angle injection** — one contrarian/analytical paragraph added to every LinkedIn post from `prompts/original-angle.txt`
- **Weekly synthesis posts** — Friday 10am; clusters week's articles by embedding similarity; generates "I read N articles about X — here's what they all missed" post for Telegram approval
- **Engagement reply worker** — 60 min after posting, fetches comments, drafts GPT-4o replies in your tone, routes through Telegram approval
- **Evergreen content recycler** — Sunday 8am; finds tutorials >90 days old with high engagement; generates fresh hook + queues for 10am Sunday low-traffic slot
- **Competitor benchmarking** — Wednesday 9am; ingests competitor RSS feeds from `competitors.json`; embeds and compares to your content; reports uncovered topics to Telegram

### Developer Experience
- **Prompt versioning** — all LLM prompts in `prompts/*.txt`; edit without touching TypeScript; change your voice by editing `tone-profile.txt`
- **Admin CLI** — 6 commands: `stats`, `flush-queue`, `test-telegram`, `failed-jobs list`, `failed-jobs retry <id>`, `reprocess <url>`
- **Multi-account support** — `accounts.json` lets you run the pipeline for multiple brands; `--account <name>` flag at runtime
- **Integration test suite** — Jest + mocked OpenAI + mocked Supabase; 5 pipeline tests; runs in CI without live API calls

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestration | LangGraph (StateGraph) — 14 nodes |
| LLM | OpenAI GPT-4o (classify, structure, caption, original angle, mermaid, edits) |
| Embeddings | OpenAI text-embedding-3-small (dedup + synthesis clustering) |
| Image Generation | DALL-E 3 (primary) + Replicate SDXL (fallback) |
| Quote Cards | Sharp (SVG → PNG rendering) |
| Diagrams | Mermaid.js + Puppeteer (headless Chromium) |
| Carousels & PDFs | PDFKit |
| Approval Gate | Telegram Bot API (single + bulk review) |
| Web Dashboard | Next.js 14 (App Router) + Tailwind CSS |
| Social Posting | LinkedIn UGC API, Instagram Graph API v19, Twitter/X API v2, Threads API |
| Job Queue | BullMQ (post queue + engagement queue + failed queue) |
| Queue Backend | Redis 7 |
| Storage | Supabase (PostgreSQL + object storage) |
| Trend Detection | google-trends-api |
| Newsletter | Beehiiv API (or log-only mode) |
| Runtime | Node.js 20 + TypeScript (strict mode) |

---

## Docker (Recommended)

The easiest way to run the full stack locally — no Redis install, no system Chromium setup needed.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Mac / Windows / Linux)

### 1. Set up your `.env`

```bash
cp .env.example .env
# Open .env and fill in your API keys
```

### 2. Start everything

```bash
docker compose up --build
```

This builds the image once and starts five containers:

| Container | Role |
|-----------|------|
| `tcp-redis` | Redis 7 — internal queue backend |
| `tcp-pipeline` | LangGraph scheduler — runs on your cron schedule |
| `tcp-worker` | BullMQ worker — posts to social platforms |
| `tcp-engagement` | Engagement worker — monitors comments 60 min after each post |
| `tcp-dashboard` | Next.js web dashboard — accessible at `http://localhost:3000` |

### 3. Run the pipeline once immediately

```bash
docker compose exec pipeline node dist/index.js --now
```

### Useful commands

```bash
# Live logs from all containers
docker compose logs -f

# Logs from a specific container
docker compose logs -f pipeline
docker compose logs -f worker
docker compose logs -f dashboard

# Stop all containers (keep volumes)
docker compose down

# Stop and wipe all data (Redis queue + asset volume)
docker compose down -v

# Rebuild after code changes
docker compose up --build

# Shell into the pipeline container
docker compose exec pipeline sh
```

### Container architecture

```
┌───────────────────────────────────────────────────┐
│                   docker compose                  │
│                                                   │
│  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │ tcp-pipeline │  │tcp-worker │  │tcp-engage- │ │
│  │  (scheduler) │  │ (BullMQ)  │  │   ment     │ │
│  └──────┬───────┘  └─────┬─────┘  └─────┬──────┘ │
│         │    enqueue /   │  dequeue      │        │
│         └───────────┬────┴───────────────┘        │
│                 ┌───┴─────┐                       │
│                 │tcp-redis│                       │
│                 └─────────┘                       │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │  tcp-dashboard  (Next.js — port 3000)      │   │
│  └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
         │                        │
  Supabase (cloud)          External APIs
  (DB + assets)             (OpenAI, Telegram,
                             LinkedIn, Twitter,
                             Instagram, Threads)
```

### Windows note

Run commands in **PowerShell** or **Git Bash**, not `cmd.exe`. Docker Desktop must be running first.

---

## Quick Start

### macOS / Linux / WSL

```bash
cd tech-content-pipeline

chmod +x start.sh   # first time only

./start.sh --now    # run once immediately
./start.sh          # run on schedule
```

### Windows

```bat
cd tech-content-pipeline

start.bat --now     REM run once immediately
start.bat           REM run on schedule
```

> **First run:** Both scripts copy `.env.example` → `.env` and prompt you to fill in keys. On Windows, `.env` opens in Notepad automatically.

---

## Environment Setup

```bash
cp .env.example .env
```

### API Keys

| Variable | Service | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `NEWSAPI_KEY` | NewsAPI | [newsapi.org](https://newsapi.org) — free: 100 req/day |
| `GNEWS_API_KEY` | GNews | [gnews.io](https://gnews.io) — free: 100 req/day |
| `PRODUCTHUNT_TOKEN` | Product Hunt | [api.producthunt.com/v2/oauth/applications](https://api.producthunt.com/v2/oauth/applications) |
| `REPLICATE_API_TOKEN` | Replicate | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Supabase | [supabase.com](https://supabase.com) — free tier |
| `TELEGRAM_BOT_TOKEN` | Telegram | Message [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_CHAT_ID` | Telegram | Message [@userinfobot](https://t.me/userinfobot) |
| `LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_PERSON_ID` | LinkedIn | [linkedin.com/developers](https://www.linkedin.com/developers/) |
| `INSTAGRAM_USER_ID` + `INSTAGRAM_ACCESS_TOKEN` | Meta | [developers.facebook.com](https://developers.facebook.com) — also used for Threads |
| `TWITTER_API_KEY` / `SECRET` / `ACCESS_TOKEN` / `ACCESS_SECRET` | Twitter | [developer.twitter.com](https://developer.twitter.com) — Elevated access required |

### Optional variables

```bash
# Newsletter digest delivery
NEWSLETTER_PROVIDER=beehiiv      # or leave blank to log-only
NEWSLETTER_API_KEY=
NEWSLETTER_PUBLICATION_ID=

# ElevenLabs voiceover for video scripts
ELEVENLABS_API_KEY=
```

### Pipeline config

```bash
PIPELINE_CRON="0 8,12,17 * * *"   # 8am, noon, 5pm daily
MAX_ARTICLES_PER_RUN=5              # articles per run
MIN_URGENCY_SCORE=3                 # 0–10; articles below this are skipped
```

---

## Database Migrations

Run each SQL file in order in the Supabase SQL editor:

| File | Tables created |
|------|---------------|
| `migrations/schema.sql` | `processed_articles`, `post_results` |
| `migrations/002_reliability.sql` | `failed_posts`, `source_health`, `rejection_reasons`, `platform_rate_limits` |
| `migrations/003_analytics.sql` | `post_analytics`, `caption_variants` |
| `migrations/004_platforms.sql` | `threads_posts` |
| `migrations/005_reporting.sql` | `competitor_articles`, `competitor_clusters` |
| `migrations/006_dashboard.sql` | `pending_reviews` |
| `migrations/007_multiaccounts.sql` | `accounts` |

---

## Prompt Versioning & Voice Customisation

All LLM prompts live in the `prompts/` directory as plain text files. Edit them without touching TypeScript — changes take effect on the next run.

```
prompts/
├── classify-system.txt         GPT-4o classification instructions
├── structure-tutorial.txt      Structuring prompt for tutorials
├── structure-news.txt          Structuring prompt for news
├── structure-tool_spotlight.txt
├── structure-opinion.txt
├── structure-deep_dive.txt
├── caption-linkedin.txt        LinkedIn formatting rules
├── caption-instagram.txt       Instagram formatting rules
├── caption-twitter.txt         Twitter thread rules
├── original-angle.txt          Instructions for the opinionated angle node
└── tone-profile.txt            ← FILL THIS IN with your best posts
```

### Setting your tone

Open `prompts/tone-profile.txt` and paste 5–10 of your best-performing LinkedIn or Twitter posts. Every caption, structure, and original angle call will match your voice automatically. No code changes needed.

---

## Content Formats

### LinkedIn Post
- 800–1,200 characters, storytelling structure
- Ends with a question to drive comments
- 3–5 hashtags at the end
- Original opinionated paragraph appended automatically (from `prompts/original-angle.txt`)

### LinkedIn Carousel (tutorials + deep-dives)
- 8-slide PDF rendered by PDFKit with your brand colours (`#0f172a` / `#6366f1`)
- Slide 1: cover with title + hook
- Slides 2–7: one key point each, numbered
- Slide 8: CTA + "Follow for more"
- Uploaded to Supabase, posted via LinkedIn Document API

### Instagram
- First 125 characters punchy (shown before "more")
- 150–200 char body
- 25–30 hashtags after a blank line
- 3–5 emojis used naturally

### Twitter/X Thread
- 5–7 tweets × 240 characters
- Tweet 1: hook with number or bold claim
- Tweets 2–N: numbered insights (2/, 3/, etc.)
- Final tweet: CTA or question
- Image attached to first tweet

### Threads (Meta)
- Uses the same Instagram credentials
- Posts the first tweet from the thread as a Threads text post
- Endpoint: `graph.facebook.com/v19.0/{ig_user_id}/threads`

### Quote Cards (opinion + news)
- SVG rendered to PNG via Sharp
- Dark background (`#0f172a`), large bold white typography
- Indigo left accent bar and bottom stripe
- Your handle watermarked in the corner
- Used as Instagram image instead of DALL-E for opinion/news content

### Mermaid Diagrams (tutorials + deep-dives)
- GPT-4o generates Mermaid code (max 12 nodes, flowchart or sequence)
- Puppeteer renders to PNG + A4 PDF with dark theme
- Both uploaded to Supabase and included in the Telegram approval preview

### Video Scripts (tutorials + tool spotlights)
```
[0–3s]   HOOK: one sentence to stop scrolling
[3–15s]  SETUP: why this matters
[15–45s] VALUE: 3 key points numbered
[45–55s] DEMO: one concrete example
[55–60s] CTA: "Follow for more" + next action
```
Includes `[PAUSE]` and `[B-ROLL: description]` markers throughout.

---

## The Approval Gate

### Single review (Telegram)

When the pipeline generates content, your bot sends:

1. **Image preview** — generated visual / carousel / quote card
2. **Caption previews** — truncated LinkedIn, Instagram, Tweet 1
3. **Action keyboard:**

| Button | Action |
|--------|--------|
| Approve & Schedule | Shows time-slot keyboard |
| Reject | Asks for rejection reason (1–4), stores to Supabase |
| Edit LinkedIn | Bot asks for replacement text |
| Edit Instagram | Bot asks for replacement text |
| Edit Tweet | Bot asks for replacement text |

**Scheduling options after approval:**

| Option | Delay |
|--------|-------|
| Post now | Immediate |
| +2 hours | 2h delay via BullMQ |
| +4 hours | 4h delay |
| Tomorrow 8am | Calculated to next 8am |
| Custom time | Bot asks for free-text time |

### Bulk review (Telegram)

When the run produces multiple articles, a summary is sent first:

```
5 articles ready for review.
1. OpenAI releases GPT-5 with 10x reasoning...
2. React 19 officially stable — what changed
...
Reply 'all' to approve all, or a number (1–5) to review individually.
```

### Rejection reason tracking

When you reject, the bot asks:
```
Why?
1 = Off-brand
2 = Low quality
3 = Already covered
4 = Too promotional
```
The reason code is stored in the `rejection_reasons` Supabase table for future analysis.

---

## Web Dashboard

A Next.js 14 app runs as `tcp-dashboard` on port **3000**.

```bash
# With Docker (auto-started):
docker compose up --build
# Open: http://localhost:3000

# Without Docker:
cd dashboard && npm install && npm run dev
```

### Pages

| Page | URL | What it shows |
|------|-----|---------------|
| **Home** | `/` | Pending review cards with image previews + this-week stats per platform |
| **Review** | `/review/[id]` | Full caption editor with tabs per platform, Approve/Reject/Schedule buttons |
| **Analytics** | `/analytics` | Posts per platform, avg engagement rate, content type breakdown |
| **Calendar** | `/calendar` | 7-day grid view of posted and scheduled content |

The dashboard reads from and writes to the `pending_reviews` Supabase table. Approvals made here trigger the same BullMQ queue as the Telegram flow.

---

## Background Workers

All workers are separate processes. Start them individually or they run automatically inside Docker.

| Script | Schedule | What it does |
|--------|----------|-------------|
| `npm run worker` | Always-on | BullMQ post worker — dispatches jobs to social platforms |
| `npm run worker:engagement` | Always-on | Checks for comments 60 min after each post; drafts GPT-4o replies; routes to Telegram |
| `npm run worker:analytics` | Mon 9am | Fetches LinkedIn + Twitter engagement metrics into `post_analytics` |
| `npm run worker:report` | Mon 9am | Generates weekly performance summary (total posts, reach, avg engagement) → Telegram |
| `npm run worker:competitor` | Wed 9am | Ingests competitor RSS feeds; finds uncovered topics; reports gaps → Telegram |
| `npm run worker:synthesis` | Fri 10am | Clusters week's articles by topic; generates synthesis LinkedIn post → Telegram approval |
| `npm run worker:newsletter` | Sun 7pm | Summarises top 5 articles of the week into an email digest → Beehiiv draft |
| `npm run worker:evergreen` | Sun 8am | Finds tutorials >90 days old with high engagement; re-generates with fresh hook; queues |

### Configuring competitors

Edit `competitors.json` to point at any RSS feed:

```json
[
  { "name": "TechCrunch", "rssUrl": "https://techcrunch.com/feed/" },
  { "name": "The Verge",  "rssUrl": "https://www.theverge.com/rss/index.xml" },
  { "name": "Hacker News", "rssUrl": "https://hnrss.org/frontpage" }
]
```

### Configuring the newsletter

```bash
NEWSLETTER_PROVIDER=beehiiv          # or leave unset to log the digest to console
NEWSLETTER_API_KEY=your_key
NEWSLETTER_PUBLICATION_ID=your_pub_id
```

---

## Admin CLI

```bash
npm run cli -- <command>
```

| Command | What it does |
|---------|-------------|
| `stats` | Prints a content calendar table: posted, scheduled (delayed), and queued (immediate) |
| `flush-queue` | Obliterates all pending jobs in the `social-posts` BullMQ queue |
| `test-telegram` | Sends a test message to your configured Telegram chat |
| `failed-jobs list` | Lists all exhausted jobs from the `failed_posts` Supabase table |
| `failed-jobs retry <id>` | Re-queues a failed job by its Supabase row ID |
| `reprocess <url>` | Fetches the URL, injects it as a `RawArticle`, and runs the full pipeline |

**Examples:**

```bash
npm run cli -- stats
npm run cli -- test-telegram
npm run cli -- failed-jobs list
npm run cli -- failed-jobs retry 8fa3c1d2-...
npm run cli -- reprocess https://techcrunch.com/2026/06/16/some-article
```

---

## Multi-Account Support

To run the pipeline for multiple LinkedIn profiles, Twitter accounts, or Instagram accounts, edit `accounts.json`:

```json
[
  {
    "name": "aryan-tech",
    "linkedin":  { "access_token": "...", "person_id": "..." },
    "twitter":   { "api_key": "...", "api_secret": "...", "access_token": "...", "access_secret": "..." },
    "instagram": { "user_id": "...", "access_token": "..." },
    "tone_profile": "prompts/aryan-tech-tone.txt"
  },
  {
    "name": "startup-brand",
    "linkedin":  { "access_token": "...", "person_id": "..." },
    "twitter":   { "api_key": "...", "api_secret": "..." },
    "instagram": { "user_id": "...", "access_token": "..." },
    "tone_profile": "prompts/startup-tone.txt"
  }
]
```

Run the pipeline for a specific account:

```bash
npm run now -- --account aryan-tech
npm run now -- --account startup-brand
```

If `accounts.json` is absent or the account name is omitted, credentials fall back to the `.env` variables.

---

## Reliability & Monitoring

### Idempotency

Before queuing any posting job, the pipeline checks `post_results` for a row matching `(article_id, platform)`. If one exists, that platform is skipped silently. Re-running the pipeline after a partial failure never double-posts.

### Dead letter queue

When a BullMQ job exhausts all 3 retries:
- Job data moves to the `failed-posts` queue
- A row is inserted into the `failed_posts` Supabase table
- A Telegram alert is sent with the platform name and error message
- Use `npm run cli -- failed-jobs retry <id>` to re-queue

### Source health

After every ingestion run, each source's success/failure is recorded in `source_health`. After 3 consecutive failures from any source, a Telegram alert is sent. The failure count resets on the next successful fetch.

### Rate limits

The pipeline tracks daily post counts per platform in `platform_rate_limits`. When a platform reaches 85% of its daily limit, new jobs are delayed by 15 minutes rather than queued immediately.

| Platform | Daily limit tracked |
|----------|-------------------|
| LinkedIn | 100 posts |
| Twitter | 300 posts |
| Instagram | 25 posts |
| Threads | 25 posts |

---

## Running Tests

```bash
npm test
```

The test suite mocks OpenAI, Supabase, and Puppeteer — no live API keys needed.

| Test | What it covers |
|------|---------------|
| `classifyNode` | Returns correct `contentType` and `platformFit`; rejects below `MIN_URGENCY_SCORE` |
| `structureNode` | Returns `StructuredContent` with required fields |
| `generateCaptionsNode` | Generates captions for all specified platforms |
| `generateOriginalAngleNode` | Appends "My take:" paragraph to LinkedIn caption |
| `deduplicateNode` | Filters articles with hashes already in `processed_articles` |

To add a test: seed from `tests/fixtures/article.ts`, mock API responses in `tests/mocks/`, assert on the returned state slice.

---

## Manual Usage (without Docker)

```bash
npm install          # install all dependencies
npm run build        # compile TypeScript → dist/

npm run now          # run pipeline once immediately
npm start            # run pipeline on cron schedule
npm run worker       # start post worker (keep running in a separate terminal)
npm run dev          # dev mode — auto-restarts on file save
npm run cli -- stats # content calendar
npm test             # run test suite
```

---

## Project Structure

```
tech-content-pipeline/
├── src/
│   ├── index.ts                          Entry point + cron scheduler
│   ├── cli.ts                            Admin CLI (commander)
│   ├── pipeline/
│   │   ├── graph.ts                      LangGraph StateGraph — 14 nodes + routing
│   │   ├── state.ts                      State schema + all TypeScript interfaces
│   │   └── nodes/
│   │       ├── ingest.ts                 5-source parallel fetch + health recording
│   │       ├── deduplicate.ts            URL hash + semantic similarity dedup
│   │       ├── classify.ts               GPT-4o classification + trends boost
│   │       ├── structure.ts              GPT-4o structuring with tone profile
│   │       ├── visualRouter.ts           Routes to diagram or image node
│   │       ├── generateDiagram.ts        Mermaid → Puppeteer → PNG/PDF
│   │       ├── generateImage.ts          DALL-E 3 + quote card + carousel + Replicate fallback
│   │       ├── generateVideoScript.ts    60s vertical video script
│   │       ├── generateCaptions.ts       Platform captions with tone injection
│   │       ├── generateOriginalAngle.ts  Opinionated paragraph → LinkedIn
│   │       ├── approvalGate.ts           Telegram single/bulk approval
│   │       ├── applyEdits.ts             Apply manual edits or GPT-4o text instructions
│   │       ├── postContent.ts            Idempotency check + BullMQ enqueue
│   │       └── analytics.ts             Record to Supabase
│   ├── integrations/
│   │   ├── newsapi.ts
│   │   ├── gnews.ts
│   │   ├── devto.ts
│   │   ├── hackernews.ts
│   │   └── producthunt.ts
│   ├── generators/
│   │   ├── mermaid-puppeteer.ts          Dark-theme Mermaid → PNG/PDF
│   │   ├── pdfkit-generator.ts           Styled learning PDF
│   │   ├── carousel-generator.ts         8-slide LinkedIn PDF carousel
│   │   └── quote-card-generator.ts       SVG quote card via Sharp
│   ├── posting/
│   │   ├── linkedin.ts                   UGC API + image upload
│   │   ├── instagram.ts                  Graph API container + publish
│   │   ├── twitter.ts                    Thread poster
│   │   └── threads.ts                    Threads API (Meta)
│   ├── approval/
│   │   └── telegram-bot.ts               Single + bulk review + scheduling
│   ├── storage/
│   │   └── supabase.ts                   Client + uploadToSupabase()
│   ├── monitoring/
│   │   └── source-health.ts              Health tracking + rate limit counters
│   ├── workers/
│   │   ├── post-worker.ts                BullMQ post dispatcher + dead letter queue
│   │   ├── analytics-worker.ts           Monday: fetch engagement metrics
│   │   ├── report-worker.ts              Monday: weekly performance report
│   │   ├── competitor-worker.ts          Wednesday: competitor gap analysis
│   │   ├── synthesis-worker.ts           Friday: cross-article synthesis post
│   │   ├── newsletter-worker.ts          Sunday: weekly email digest
│   │   ├── evergreen-worker.ts           Sunday: recycle top old tutorials
│   │   └── engagement-worker.ts          Always-on: comment reply drafts
│   └── utils/
│       ├── prompts.ts                    loadPrompt() with file cache
│       └── accounts.ts                  loadAccount() for multi-account support
├── prompts/
│   ├── classify-system.txt
│   ├── structure-tutorial.txt
│   ├── structure-news.txt
│   ├── structure-tool_spotlight.txt
│   ├── structure-opinion.txt
│   ├── structure-deep_dive.txt
│   ├── caption-linkedin.txt
│   ├── caption-instagram.txt
│   ├── caption-twitter.txt
│   ├── original-angle.txt
│   └── tone-profile.txt               ← fill this in with your writing samples
├── dashboard/                          Next.js 14 web dashboard
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    Home — pending reviews + stats
│   │   ├── review/[id]/page.tsx        Per-article review + edit + schedule
│   │   ├── analytics/page.tsx          Engagement by platform + content type
│   │   ├── calendar/page.tsx           7-day content calendar
│   │   └── api/
│   │       ├── approve/route.ts        POST approve/reject decisions
│   │       └── articles/route.ts       GET pending articles
│   └── Dockerfile
├── migrations/
│   ├── schema.sql                      Core tables
│   ├── 002_reliability.sql             Monitoring + rate limits
│   ├── 003_analytics.sql               Engagement analytics
│   ├── 004_platforms.sql               Threads posts
│   ├── 005_reporting.sql               Competitor analysis
│   ├── 006_dashboard.sql               Pending reviews
│   └── 007_multiaccounts.sql           Accounts table
├── tests/
│   ├── pipeline.test.ts
│   ├── setup.ts
│   ├── fixtures/article.ts
│   └── mocks/
│       ├── openai.ts
│       └── supabase.ts
├── accounts.json                       Multi-account credentials template
├── competitors.json                    Competitor RSS feeds
├── Dockerfile                          Multi-stage build with system Chromium
├── docker-compose.yml                  5 services: redis, pipeline, worker, engagement, dashboard
├── jest.config.ts
├── start.sh                            macOS / Linux / WSL launcher
├── start.bat                           Windows launcher
├── .env.example                        All environment variables with comments
├── package.json
└── tsconfig.json
```

---

## Platform Formatting Rules

| Platform | Length | Format | Hashtags | Emojis |
|----------|--------|--------|----------|--------|
| LinkedIn | 800–1,200 chars | Storytelling → insight → question | 3–5 at end | Max 3 |
| LinkedIn Carousel | 8 slides | Cover + key points + CTA | None | None |
| Instagram | 125 char hook + 150–200 body | Punchy opener + body | 25–30 after blank line | 3–5 |
| Twitter/X | 5–7 tweets × 240 chars | Hook → numbered insights → CTA | 1–2 per tweet | Occasional |
| Threads | 1 post, 500 chars max | First tweet from thread | None | Optional |

---

## Troubleshooting

**`OPENAI_API_KEY` error on start**
Ensure the key is in `.env` with no extra spaces or quotes.

**Redis connection refused**
Start Redis first: `brew services start redis` (macOS) or `docker start tcp-redis`.

**Telegram bot not responding**
Ensure `TELEGRAM_BOT_TOKEN` is correct and you've sent `/start` to your bot at least once.

**Telegram bot stops after a day or two**
The Telegram polling instance is a singleton. If the process crashes, restart it. For production, consider switching to webhook mode.

**Instagram posts failing**
Instagram Graph API requires a **Business or Creator account** linked to a Facebook Page with a valid long-lived access token. Personal accounts are not supported.

**Threads posts failing**
Threads API requires the same Instagram credentials. Ensure your account has Threads enabled and the `threads_content_publish` permission is granted.

**Twitter rate limit (17 tweets/15 min)**
The pipeline tracks daily counts and delays jobs automatically at 85% of the limit. BullMQ retries handle transient rate-limit errors with exponential backoff.

**LinkedIn carousel upload fails**
The Document API requires `r_member_social` and `w_member_social` OAuth scopes. Check your LinkedIn app permissions.

**Puppeteer / Chrome error on Linux (non-Docker)**
Install Chromium system dependencies:
```bash
sudo apt install -y libgbm-dev libxkbcommon-x11-0 libgtk-3-0 libnss3 libx11-xcb1
```

**Docker build fails on Apple Silicon (M1/M2/M3)**
```bash
docker compose build --build-arg BUILDPLATFORM=linux/amd64
```
Or add `platform: linux/amd64` under each service in `docker-compose.yml`.

**`PUPPETEER_EXECUTABLE_PATH` error inside Docker**
The Dockerfile sets this to `/usr/bin/chromium` automatically. If you see a path error, run `docker compose build --no-cache`.

**`sharp` module error after install**
Run `npm rebuild sharp` or delete `node_modules` and reinstall. Sharp uses native binaries that must match the current platform.

**Dashboard shows blank page at localhost:3000**
Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in `.env`. The dashboard reads these at build time. After changing `.env`, run `docker compose up --build`.

**`failed-jobs list` shows nothing but posts are failing**
Check that the `failed_posts` table exists — run `migrations/002_reliability.sql` if you skipped it.

---

## License

MIT

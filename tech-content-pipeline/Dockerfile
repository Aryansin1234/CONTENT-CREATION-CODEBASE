# ─────────────────────────────────────────────────────────
#  Stage 1: Build — compile TypeScript to JS
# ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install only what's needed to compile
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Prune dev dependencies so the final image only carries prod deps
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────
#  Stage 2: Production image
#  Uses Debian-based node:20-slim so we can install
#  system Chromium + all libs required by Puppeteer
# ─────────────────────────────────────────────────────────
FROM node:20-slim AS production

# Install system Chromium and all libraries it needs.
# We tell Puppeteer to skip its own bundled download and
# use this system binary instead (see ENV block below).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where the system Chromium lives and skip its own download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy compiled JS and production node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Non-root user for security
RUN groupadd -r pipeline && useradd -r -g pipeline -G audio,video pipeline \
    && mkdir -p /home/pipeline/Downloads \
    && chown -R pipeline:pipeline /home/pipeline \
    && chown -R pipeline:pipeline /app

USER pipeline

EXPOSE 3000

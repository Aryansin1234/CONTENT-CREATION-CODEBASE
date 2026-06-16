#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Tech Content Creation Pipeline — start.sh
#  macOS · Linux · WSL
# ─────────────────────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
DIM="\033[2m"
RESET="\033[0m"

print_step()  { echo -e "\n${CYAN}${BOLD}▶ $1${RESET}"; }
print_ok()    { echo -e "  ${GREEN}✔ $1${RESET}"; }
print_warn()  { echo -e "  ${YELLOW}⚠ $1${RESET}"; }
print_error() { echo -e "  ${RED}✘ $1${RESET}"; }
print_info()  { echo -e "  ${DIM}$1${RESET}"; }

WORKER_PIDS=()

cleanup() {
  echo ""
  print_warn "Shutting down workers..."
  for pid in "${WORKER_PIDS[@]}"; do
    kill "$pid" 2>/dev/null && print_info "Killed PID $pid"
  done
  print_ok "All workers stopped."
  exit 0
}
trap cleanup INT TERM

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Tech Content Creation Pipeline                 ║${RESET}"
echo -e "${BOLD}║   AI-Powered News → Social Automation            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Step 1: Node.js ───────────────────────────────────────────
print_step "[1/8] Checking Node.js (requires v18+)"

if ! command -v node &>/dev/null; then
  print_error "Node.js not found."
  print_info "Install from: https://nodejs.org  (v20 LTS recommended)"
  print_info "Via nvm:      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1))")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  print_error "Node.js v$NODE_VER found — v18+ required. Download v20 LTS from https://nodejs.org"
  exit 1
fi
print_ok "Node.js v$NODE_VER"

if ! command -v npm &>/dev/null; then
  print_error "npm not found. Reinstall Node.js from https://nodejs.org"
  exit 1
fi
print_ok "npm $(npm --version)"

# ── Step 2: Redis ─────────────────────────────────────────────
print_step "[2/8] Checking Redis"

REDIS_RUNNING=false

# Check if already running (don't use set -e here — ping failure is expected)
if command -v redis-cli &>/dev/null; then
  if redis-cli ping >/dev/null 2>&1; then
    print_ok "Redis is running (native)"
    REDIS_RUNNING=true
  fi
fi

if [ "$REDIS_RUNNING" = false ] && command -v docker &>/dev/null && docker info >/dev/null 2>&1; then
  print_warn "Redis not running — attempting to start via Docker..."
  # Try starting existing container first, then create new one
  if ! docker start tcp-redis >/dev/null 2>&1; then
    docker run -d --name tcp-redis -p 6379:6379 redis:alpine >/dev/null 2>&1 || true
  fi
  sleep 2
  if docker exec tcp-redis redis-cli ping >/dev/null 2>&1; then
    print_ok "Redis started via Docker (tcp-redis)"
    REDIS_RUNNING=true
  else
    print_warn "Docker Redis didn't respond in time — continuing anyway"
  fi
fi

if [ "$REDIS_RUNNING" = false ]; then
  print_warn "Redis not detected. Options:"
  print_info "  macOS:  brew install redis && brew services start redis"
  print_info "  Docker: docker run -d --name tcp-redis -p 6379:6379 redis:alpine"
  print_info "  Linux:  sudo apt install redis-server && sudo systemctl start redis"
  echo ""
  read -r -p "  Continue anyway? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ── Step 3: .env ──────────────────────────────────────────────
print_step "[3/8] Checking environment configuration"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    print_warn ".env created from .env.example"
    echo ""
    echo -e "  ${YELLOW}${BOLD}ACTION REQUIRED — fill in your API keys in .env before running${RESET}"
    print_info "Required keys:"
    print_info "  OPENAI_API_KEY         https://platform.openai.com/api-keys"
    print_info "  NEWSAPI_KEY            https://newsapi.org"
    print_info "  TELEGRAM_BOT_TOKEN     @BotFather on Telegram → /newbot"
    print_info "  TELEGRAM_CHAT_ID       @userinfobot on Telegram"
    print_info "  SUPABASE_URL           https://supabase.com"
    print_info "  SUPABASE_SERVICE_KEY   from your Supabase project settings"
    echo ""
    read -r -p "  Have you filled in .env? (y/N): " ENV_READY
    if [[ ! "$ENV_READY" =~ ^[Yy]$ ]]; then
      print_info "Edit .env and run this script again."
      exit 0
    fi
  else
    print_error ".env.example not found. Are you in the right directory?"
    exit 1
  fi
else
  print_ok ".env found"
fi

# Validate critical keys
MISSING_KEYS=()
check_key() {
  local val
  val=$(grep -E "^$1=" .env 2>/dev/null | cut -d= -f2- | tr -d ' "')
  [ -z "$val" ] && MISSING_KEYS+=("$1")
}

check_key "OPENAI_API_KEY"
check_key "TELEGRAM_BOT_TOKEN"
check_key "TELEGRAM_CHAT_ID"
check_key "SUPABASE_URL"
check_key "SUPABASE_SERVICE_KEY"

if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
  print_warn "These required keys are still empty in .env:"
  for key in "${MISSING_KEYS[@]}"; do
    print_info "  • $key"
  done
  echo ""
  read -r -p "  Continue with missing keys? Pipeline will fail when it hits them. (y/N): " CONT
  if [[ ! "$CONT" =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  print_ok "All critical environment keys are set"
fi

# ── Step 4: Prompts check ─────────────────────────────────────
print_step "[4/8] Checking prompts directory"

if [ ! -d "prompts" ]; then
  print_error "prompts/ directory not found. Are you in the right directory?"
  exit 1
fi

TONE_FILE="prompts/tone-profile.txt"
if grep -q "\[PASTE YOUR POSTS HERE\]" "$TONE_FILE" 2>/dev/null; then
  print_warn "prompts/tone-profile.txt is still the default placeholder"
  print_info "Paste 5-10 of your best LinkedIn/Twitter posts into that file"
  print_info "to make every generated caption match your voice."
  print_info "(Pipeline will still run — output will just sound more generic)"
else
  print_ok "Tone profile is configured"
fi

PROMPT_COUNT=$(ls prompts/*.txt 2>/dev/null | wc -l | tr -d ' ')
print_ok "$PROMPT_COUNT prompt files found"

# ── Step 5: Install pipeline dependencies ─────────────────────
print_step "[5/8] Installing pipeline dependencies"

if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  npm ci --silent 2>&1 | tail -3
else
  npm install --silent 2>&1 | tail -3
fi
print_ok "Pipeline dependencies installed"

# ── Step 6: Install dashboard dependencies ───────────────────
print_step "[6/8] Installing dashboard dependencies"

if [ -d "dashboard" ] && [ -f "dashboard/package.json" ]; then
  if [ -d "dashboard/node_modules" ] && [ -f "dashboard/package-lock.json" ]; then
    (cd dashboard && npm ci --silent 2>&1 | tail -2)
  else
    (cd dashboard && npm install --silent 2>&1 | tail -2)
  fi
  print_ok "Dashboard dependencies installed"
else
  print_info "No dashboard directory found — skipping"
fi

# ── Step 7: TypeScript build ──────────────────────────────────
print_step "[7/8] Compiling TypeScript"

if ! npx tsc 2>&1; then
  print_error "TypeScript compilation failed. Run 'npx tsc' to see errors."
  exit 1
fi
print_ok "Build successful → dist/"

# ── Step 8: Launch ────────────────────────────────────────────
print_step "[8/8] Starting services"

MODE="${1:-scheduled}"

start_workers() {
  node dist/workers/post-worker.js &
  WORKER_PIDS+=($!)
  print_ok "Post worker started (PID ${WORKER_PIDS[-1]})"

  node dist/workers/engagement-worker.js &
  WORKER_PIDS+=($!)
  print_ok "Engagement worker started (PID ${WORKER_PIDS[-1]})"
}

print_available_commands() {
  echo ""
  echo -e "  ${DIM}─────────────────────────────────────────────${RESET}"
  echo -e "  ${DIM}Available CLI commands (in a new terminal):${RESET}"
  echo -e "  ${DIM}  npm run cli -- stats                       ${RESET}"
  echo -e "  ${DIM}  npm run cli -- test-telegram               ${RESET}"
  echo -e "  ${DIM}  npm run cli -- failed-jobs list            ${RESET}"
  echo -e "  ${DIM}  npm run cli -- flush-queue                 ${RESET}"
  echo -e "  ${DIM}  npm run cli -- reprocess <url>             ${RESET}"
  echo -e "  ${DIM}─────────────────────────────────────────────${RESET}"
  echo ""
}

if [ "$MODE" = "--now" ] || [ "$MODE" = "now" ]; then
  echo -e "  ${CYAN}Mode: immediate single run${RESET}"
  echo ""

  start_workers
  print_available_commands

  print_info "Running pipeline once..."
  node dist/index.js --now

  echo ""
  print_step "Waiting 60s for queued/scheduled posts to process..."
  sleep 60

  print_ok "Pipeline run complete."
  print_info "Workers are still running — press Ctrl+C to stop them."
  print_info "Or leave them running to process any delayed scheduled posts."
  echo ""

  # Keep workers alive until Ctrl+C
  wait

else
  CRON_VAL=$(grep -E "^PIPELINE_CRON=" .env 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "0 8,12,17 * * *")
  echo -e "  ${CYAN}Mode: scheduled${RESET}"
  echo -e "  ${DIM}Cron: ${CRON_VAL}${RESET}"
  echo -e "  ${DIM}Tip:  run with --now for an immediate single run${RESET}"
  echo ""

  start_workers
  print_available_commands

  echo -e "  ${GREEN}Pipeline scheduler running. Press Ctrl+C to stop all services.${RESET}"
  echo ""

  node dist/index.js
fi

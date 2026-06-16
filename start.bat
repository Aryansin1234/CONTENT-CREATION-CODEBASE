@echo off
setlocal enabledelayedexpansion

REM ─────────────────────────────────────────────────────────────
REM  Tech Content Creation Pipeline — start.bat
REM  Windows native (cmd.exe)
REM ─────────────────────────────────────────────────────────────

title Tech Content Creation Pipeline

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║   Tech Content Creation Pipeline                 ║
echo ║   AI-Powered News to Social Automation           ║
echo ╚══════════════════════════════════════════════════╝
echo.

REM ── Step 1: Node.js ──────────────────────────────────────────
echo [1/8] Checking Node.js (requires v18+)...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo.
    echo   Install from: https://nodejs.org  (v20 LTS recommended)
    echo   During install, tick "Add to PATH" then restart this terminal.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.version.slice(1))"') do set NODE_VER=%%v
for /f "tokens=1 delims=." %%m in ("!NODE_VER!") do set NODE_MAJOR=%%m

if !NODE_MAJOR! lss 18 (
    echo [ERROR] Node.js v!NODE_VER! found — v18+ required.
    echo   Download v20 LTS from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js v!NODE_VER!

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found. Reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo [OK] npm !NPM_VER!

REM ── Step 2: Redis ────────────────────────────────────────────
echo.
echo [2/8] Checking Redis...

set REDIS_OK=false

REM Try native redis-cli first
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    redis-cli ping >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Redis is running (native)
        set REDIS_OK=true
    )
)

REM Try Docker if redis-cli not found or not running
if "!REDIS_OK!"=="false" (
    where docker >nul 2>&1
    if !errorlevel! equ 0 (
        docker info >nul 2>&1
        if !errorlevel! equ 0 (
            echo [WARN] Redis not running -- attempting to start via Docker...
            docker start tcp-redis >nul 2>&1
            if !errorlevel! neq 0 (
                docker run -d --name tcp-redis -p 6379:6379 redis:alpine >nul 2>&1
            )
            timeout /t 3 /nobreak >nul
            docker exec tcp-redis redis-cli ping >nul 2>&1
            if !errorlevel! equ 0 (
                echo [OK] Redis started via Docker (tcp-redis)
                set REDIS_OK=true
            ) else (
                echo [WARN] Docker Redis did not respond -- continuing anyway
                set REDIS_OK=true
            )
        ) else (
            echo [WARN] Docker Desktop is not running. Start it and retry, or install Redis another way.
        )
    )
)

if "!REDIS_OK!"=="false" (
    echo [WARN] Redis not detected. Options to install Redis on Windows:
    echo.
    echo   1. Docker Desktop (recommended):
    echo      https://www.docker.com/products/docker-desktop
    echo      Then run: docker run -d --name tcp-redis -p 6379:6379 redis:alpine
    echo.
    echo   2. Memurai (native Windows Redis-compatible server):
    echo      https://www.memurai.com
    echo.
    echo   3. WSL2 + Ubuntu:
    echo      wsl --install
    echo      Then inside WSL: sudo apt install redis-server ^&^& sudo service redis start
    echo.
    set /p CONT="Continue without Redis? (Pipeline queue will not work) (y/N): "
    if /i "!CONT!" neq "y" exit /b 1
)

REM ── Step 3: .env file ────────────────────────────────────────
echo.
echo [3/8] Checking environment configuration...

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [WARN] .env created from .env.example
        echo.
        echo   ACTION REQUIRED: Fill in your API keys in .env
        echo.
        echo   Required keys:
        echo     OPENAI_API_KEY         https://platform.openai.com/api-keys
        echo     NEWSAPI_KEY            https://newsapi.org
        echo     TELEGRAM_BOT_TOKEN     @BotFather on Telegram /newbot
        echo     TELEGRAM_CHAT_ID       @userinfobot on Telegram
        echo     SUPABASE_URL           https://supabase.com
        echo     SUPABASE_SERVICE_KEY   from your Supabase project settings
        echo.
        echo   Opening .env in Notepad...
        start /wait notepad ".env"
        echo.
        set /p ENV_READY="Have you filled in your .env? (y/N): "
        if /i "!ENV_READY!" neq "y" (
            echo Edit .env and run this script again.
            exit /b 0
        )
    ) else (
        echo [ERROR] .env.example not found. Are you in the right directory?
        pause
        exit /b 1
    )
) else (
    echo [OK] .env found
)

REM Validate critical keys
set MISSING_KEYS=
for %%K in (OPENAI_API_KEY TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID SUPABASE_URL SUPABASE_SERVICE_KEY) do (
    set KEY_VAL=
    for /f "tokens=2 delims==" %%V in ('findstr /b "%%K=" .env 2^>nul') do set KEY_VAL=%%V
    if not defined KEY_VAL (
        set MISSING_KEYS=!MISSING_KEYS! %%K
    ) else (
        REM Strip quotes and spaces
        set KEY_VAL=!KEY_VAL: =!
        set KEY_VAL=!KEY_VAL:"=!
        if "!KEY_VAL!"=="" set MISSING_KEYS=!MISSING_KEYS! %%K
    )
)

if not "!MISSING_KEYS!"=="" (
    echo [WARN] These required keys are still empty in .env:
    for %%K in (!MISSING_KEYS!) do echo        - %%K
    echo.
    set /p CONT2="Continue with missing keys? Pipeline will fail when it reaches them. (y/N): "
    if /i "!CONT2!" neq "y" exit /b 1
) else (
    echo [OK] All critical environment keys are set
)

REM ── Step 4: Prompts check ────────────────────────────────────
echo.
echo [4/8] Checking prompts directory...

if not exist "prompts\" (
    echo [ERROR] prompts\ directory not found. Are you in the right directory?
    pause
    exit /b 1
)

findstr /c:"[PASTE YOUR POSTS HERE]" "prompts\tone-profile.txt" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] prompts\tone-profile.txt is still the default placeholder.
    echo        Paste your best LinkedIn/Twitter posts into that file to match your voice.
) else (
    echo [OK] Tone profile is configured
)

for /f %%C in ('dir /b prompts\*.txt 2^>nul ^| find /c ".txt"') do set PROMPT_COUNT=%%C
echo [OK] !PROMPT_COUNT! prompt files found

REM ── Step 5: Install pipeline dependencies ────────────────────
echo.
echo [5/8] Installing pipeline dependencies...

if exist "node_modules\" (
    if exist "package-lock.json" (
        call npm ci --silent
    ) else (
        call npm install --silent
    )
) else (
    call npm install --silent
)

if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)
echo [OK] Pipeline dependencies installed

REM ── Step 6: Install dashboard dependencies ───────────────────
echo.
echo [6/8] Installing dashboard dependencies...

if exist "dashboard\package.json" (
    if exist "dashboard\node_modules\" (
        if exist "dashboard\package-lock.json" (
            pushd dashboard && call npm ci --silent && popd
        ) else (
            pushd dashboard && call npm install --silent && popd
        )
    ) else (
        pushd dashboard && call npm install --silent && popd
    )
    if %errorlevel% neq 0 (
        echo [WARN] Dashboard npm install failed -- dashboard may not work.
    ) else (
        echo [OK] Dashboard dependencies installed
    )
) else (
    echo [INFO] No dashboard directory found -- skipping
)

REM ── Step 7: TypeScript build ──────────────────────────────────
echo.
echo [7/8] Compiling TypeScript...

call npx tsc
if %errorlevel% neq 0 (
    echo [ERROR] TypeScript compilation failed.
    echo         Run "npx tsc" to see the full error output.
    pause
    exit /b 1
)
echo [OK] Build complete ^(dist/^)

REM ── Step 8: Launch ───────────────────────────────────────────
echo.
echo ════════════════════════════════════════════════════
echo   Starting Services
echo ════════════════════════════════════════════════════
echo.

set MODE=%1

if "!MODE!"=="--now" goto run_now
if "!MODE!"=="now"   goto run_now
goto run_scheduled

REM ──────────────────────────────────────────────────────────────
:run_now
echo   Mode: Immediate single run
echo.
echo   Starting workers in separate windows...
start "TCP Post Worker"       cmd /k "node dist\workers\post-worker.js"
start "TCP Engagement Worker" cmd /k "node dist\workers\engagement-worker.js"
timeout /t 2 /nobreak >nul

echo.
echo   ─────────────────────────────────────────────
echo   Available CLI commands (in a new terminal):
echo     npm run cli -- stats
echo     npm run cli -- test-telegram
echo     npm run cli -- failed-jobs list
echo     npm run cli -- flush-queue
echo     npm run cli -- reprocess ^<url^>
echo   ─────────────────────────────────────────────
echo.

echo   Running pipeline once...
node dist\index.js --now

echo.
echo   Waiting 60 seconds for queued/scheduled posts to process...
timeout /t 60 /nobreak
echo.
echo [OK] Pipeline run complete.
echo.
echo   Workers are still running in their windows.
echo   Close those windows when you are done, or leave them
echo   running to process any posts you scheduled for later.
goto end

REM ──────────────────────────────────────────────────────────────
:run_scheduled
echo   Mode: Scheduled
REM Read cron from .env
set CRON_VAL=0 8,12,17 * * *
for /f "tokens=2 delims==" %%V in ('findstr /b "PIPELINE_CRON=" .env 2^>nul') do (
    set CRON_VAL=%%V
    set CRON_VAL=!CRON_VAL:"=!
)
echo   Cron: !CRON_VAL!
echo   Tip: Run "start.bat --now" for an immediate single run.
echo.

echo   Starting workers in separate windows...
start "TCP Post Worker"       cmd /k "node dist\workers\post-worker.js"
start "TCP Engagement Worker" cmd /k "node dist\workers\engagement-worker.js"
timeout /t 2 /nobreak >nul

echo.
echo   ─────────────────────────────────────────────
echo   Available CLI commands (in a new terminal):
echo     npm run cli -- stats
echo     npm run cli -- test-telegram
echo     npm run cli -- failed-jobs list
echo     npm run cli -- flush-queue
echo     npm run cli -- reprocess ^<url^>
echo   ─────────────────────────────────────────────
echo.

echo   Pipeline scheduler is running. Close this window to stop.
echo.
node dist\index.js

:end
echo.
pause

# R300 Trade Bot

Autonomous trading agent for South African investors.

- **JSE shares/ETFs** via EasyEquities — semi-automatic (Telegram alerts, you execute)
- **Crypto BTC/ETH** via VALR — fully automated execution
- **Budget**: R300/week, resets every Monday
- **Scans**: Hourly during market hours (Mon–Fri 08:00–17:30 SAST)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Dashboard (Vite + Tailwind)   :5173           │
│  5 tabs: Live Feed, Positions, Signals, History,     │
│  Settings                                            │
└──────────────────────┬──────────────────────────────┘
                       │ SSE + REST API
┌──────────────────────▼──────────────────────────────┐
│  Express API Server                          :3001   │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │aggregator│  │ brain.js │  │   engine.js      │   │
│  │(data)    │→ │(Claude)  │→ │ (validate+route) │   │
│  └──────────┘  └──────────┘  └────────┬────────┘   │
│                                        │             │
│            ┌───────────────────────────┤             │
│            ▼                           ▼             │
│       valr.js                    alerts.js           │
│    (VALR API exec)           (Telegram bot)          │
│            │                           │             │
│       SQLite DB                  Telegram            │
└─────────────────────────────────────────────────────┘
```

---

## Getting Your API Keys

### 1. Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create account → API Keys → **Create Key**
3. Copy to `ANTHROPIC_API_KEY`

### 2. VALR API Key
1. Go to [valr.com](https://valr.com) → log in
2. Account → **API Keys** → Create API Key
3. Enable permissions: **View**, **Trade**
4. Copy both **API Key** and **Secret** to `VALR_API_KEY` / `VALR_API_SECRET`

> ⚠️ Start with `PAPER_TRADING=true` to test without real money!

### 3. Telegram Bot
1. Open Telegram → search **@BotFather** → `/newbot`
2. Follow prompts → copy the **bot token** to `TELEGRAM_BOT_TOKEN`
3. Start a chat with your new bot (search its name)
4. Visit `https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates`
5. Send a message to the bot, then refresh — find `message.chat.id`
6. Copy that number to `TELEGRAM_CHAT_ID`

### 4. NewsAPI
1. Go to [newsapi.org](https://newsapi.org) → **Get API Key** (free)
2. Copy to `NEWS_API_KEY`

---

## Installation

```bash
# Clone (if not already)
git clone https://github.com/mondemashigo-tech/darkandlovelyspinwheel.git
cd DarkandLovelySpinWheel

# Copy env template and fill in your keys
cp .env.example .env
# Edit .env with your API keys

# Install all dependencies
npm run install:all
```

---

## Running the Bot

### Terminal 1 — API Server + Agent
```bash
node server/index.js
```

### Terminal 2 — Dashboard UI
```bash
cd client && npm run dev
```

Open http://localhost:5173 in your browser.

---

## First Run & Testing

### 1. Paper Trading Mode (recommended first)
Make sure `.env` has:
```
PAPER_TRADING=true
```
All VALR trades will be **simulated** — logged as `SIMULATED` in the DB, never real money.

### 2. Trigger a manual scan
```bash
curl -X POST http://localhost:3001/api/agent/scan
```
Or click **"SCAN NOW"** in Settings tab.

### 3. Check the dashboard
- **Live Feed** tab: see market data, Fear & Greed, latest signals
- **Signals** tab: see Claude's full analysis and decisions
- **Settings** tab: agent status, health checks

### 4. Reading Telegram alerts
- **🟢 BUY SIGNAL** → Open EasyEquities app, search ticker, buy stated amount
- **🚨 EXIT ALERT** → Open EasyEquities, sell immediately
- **⚡ CRYPTO EXECUTED** → Trade was auto-executed on VALR (if `PAPER_TRADING=false`)
- **📊 Hourly Summary** → No trades this hour, here's the market status

### Telegram Bot Commands
| Command | Action |
|---------|--------|
| `/status` | Current positions + P&L |
| `/portfolio` | Full portfolio breakdown |
| `/pause` | Pause auto-trading (crypto) |
| `/resume` | Resume auto-trading |
| `/budget` | Weekly spend remaining |
| `/stop` | Emergency stop all activity |

---

## Budget & Risk Rules

| Rule | Value |
|------|-------|
| Weekly budget | R300 (resets Monday 07:00) |
| Max open positions | 6 |
| Max ETF trade | R120 |
| Max share trade | R90 |
| Max crypto trade | R60 |
| Stop-loss | Auto-exit at −8% |
| Take-profit flag | Alert at +15% |
| JSE pre-close blackout | No new buys 30min before 17:00 SAST |

---

## JSE Tickers Monitored

**ETFs:** CSP500, CTOP50, ETF500, ETF5IT, ETFGLD, ETFGGB, ETFBND, ETFEMA, ETFGRE, ETFPLD, CSGOVI, CSPROP, CSYSB

**Shares:** ABG, ACL, ADH, AEG, AFE, AFT, AGL, ANG, ANH, ACS, AFH

**Crypto:** BTC, ETH (VALR pairs: BTCZAR, ETHZAR)

---

## Data Sources

| Source | Data | Auth |
|--------|------|------|
| VALR Public API | BTC/ETH prices | None |
| Yahoo Finance | JSE quotes, MA50/MA200 | None |
| ExchangeRate-API | USD/ZAR rate | None |
| NewsAPI | SA market headlines | Free key |
| Anthropic Claude | Trade analysis | API key |

---

## File Structure

```
/client             React + Vite dashboard
  /src
    App.jsx
    /pages          LiveFeed, Positions, Signals, History, Settings
    /components     AgentStatus, FearGreedGauge, DecisionCard, PositionRow, BudgetBar
    /hooks          useSSE, usePositions, useBudget
/server
  index.js          Express app + SSE endpoint
  scheduler.js      Hourly cron jobs
  aggregator.js     Market data fetching
  brain.js          Claude AI analysis
  engine.js         Decision validation + routing
  valr.js           VALR API execution
  alerts.js         Telegram bot
  db.js             SQLite queries
/data
  trades.db         Auto-created on first run
.env                Your secrets (never commit!)
.env.example        Template
```

---

## Disclaimer

This bot is for **educational and personal use only**. It is not financial advice.
Always start with `PAPER_TRADING=true`. Past analysis performance does not guarantee future results.
Never invest more than you can afford to lose. JSE execution is manual — you control all JSE trades.

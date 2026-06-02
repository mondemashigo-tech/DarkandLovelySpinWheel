require('dotenv').config();
const express   = require('express');
const Database  = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────

const db = new Database('trades.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker     TEXT    NOT NULL,
    type       TEXT    NOT NULL,
    action     TEXT    NOT NULL DEFAULT 'BUY',
    amount     REAL    NOT NULL,
    note       TEXT,
    date       TEXT    NOT NULL,
    week       INTEGER NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ai_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key  TEXT UNIQUE NOT NULL,
    response   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Constants ─────────────────────────────────────────────────────────────

const START_DATE  = new Date('2026-06-02');
const TOTAL_WEEKS = 17;
const TICKERS = {
  ETFs:   ['CSP500','CTOP50','ETF500','ETF5IT','ETFGLD','ETFGGB','ETFBND','ETFEMA','ETFGRE','ETFPLD','CSGOVI','CSPROP','CSYSB'],
  Shares: ['ABG','ACL','ADH','AEG','AFE','AFT','AGL','ANG','ANH','ACS','AFH','27FGMF','91DINC','91GINC'],
  Crypto: ['BTC','ETH']
};

// ── Helpers ───────────────────────────────────────────────────────────────

function currentWeek() {
  const ms = new Date() - START_DATE;
  return Math.max(1, Math.min(Math.floor(ms / (7 * 86400000)) + 1, TOTAL_WEEKS));
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function weekKey() {
  const n   = new Date();
  const jan = new Date(n.getFullYear(), 0, 1);
  const w   = Math.ceil(((n - jan) / 86400000 + jan.getDay() + 1) / 7);
  return `${n.getFullYear()}-W${String(w).padStart(2, '0')}`;
}

function getCached(key) {
  const row = db.prepare('SELECT response FROM ai_cache WHERE cache_key = ?').get(key);
  return row ? JSON.parse(row.response) : null;
}

function setCache(key, data) {
  db.prepare('INSERT OR REPLACE INTO ai_cache (cache_key, response) VALUES (?,?)').run(key, JSON.stringify(data));
}

function getPortfolio() {
  const trades    = db.prepare('SELECT * FROM trades ORDER BY created_at ASC').all();
  const positions = {};
  for (const t of trades) {
    if (t.action === 'BUY') {
      if (!positions[t.ticker]) positions[t.ticker] = { ticker: t.ticker, type: t.type, invested: 0, entryDate: t.date, entryWeek: t.week };
      positions[t.ticker].invested += t.amount;
    } else if ((t.action === 'SELL' || t.action === 'EXIT') && positions[t.ticker]) {
      positions[t.ticker].invested -= t.amount;
      if (positions[t.ticker].invested <= 0) delete positions[t.ticker];
    }
  }
  return Object.values(positions);
}

function buildContext(positions) {
  const week     = currentWeek();
  const now      = new Date();
  const dayName  = now.toLocaleDateString('en-ZA', { weekday: 'long' });
  const dateStr  = now.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
  return {
    platform: 'EasyEquities JSE + VALR',
    budget:   'R300/week',
    challenge:`4-month JSE challenge, week ${week} of ${TOTAL_WEEKS}, ${TOTAL_WEEKS - week + 1} weeks remaining`,
    tickers:  TICKERS,
    currentPositions: positions.map(p => ({
      ticker: p.ticker, type: p.type, invested: `R${p.invested.toFixed(2)}`,
      entryDate: p.entryDate, entryWeek: p.entryWeek, weeksHeld: week - p.entryWeek
    })),
    today:      `${dayName} ${dateStr}`,
    allocation: { ETFs: 'R120 (40%)', Shares: 'R90 (30%)', Crypto: 'R60 (20%)', Reserve: 'R30 (10%)' }
  };
}

// ── AI ────────────────────────────────────────────────────────────────────

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callAI(system, user, cacheKey, bypass = false) {
  if (!bypass) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  const resp = await ai.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 2000,
    system,
    messages:   [{ role: 'user', content: user }]
  });
  const text = resp.content[0].text.trim();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
  if (parsed) setCache(cacheKey, parsed);
  return parsed;
}

// ── Express ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) =>
  res.json({ ok: true, week: currentWeek(), date: todayKey() })
);

app.get('/api/daily', async (req, res) => {
  try {
    const ctx    = buildContext(getPortfolio());
    const bypass = req.query.refresh === '1';
    const data   = await callAI(
      `You are an expert JSE investment advisor for a South African retail investor on EasyEquities and VALR. Today is ${ctx.today}. Respond with valid JSON only — no markdown.`,
      `Context: ${JSON.stringify(ctx)}

Return ONLY this JSON (no extra text):
{"dayScore":<1-10>,"sentiment":"<Bullish|Neutral|Bearish>","marketSummary":"<one sentence>","signals":[{"ticker":"<ticker from context list>","name":"<full fund/company name>","type":"<ETF|Share|Crypto>","amount":<ZAR integer, min 10>,"action":"<BUY NOW|LIMIT ORDER>","limitPrice":"<price string or null>","urgency":"<High|Medium|Low>","conviction":"<High|Medium|Low>","reason":"<one sentence why>"}],"totalZAR":<sum of amounts, max 300>,"avoid":["<ticker or sector>"],"note":"<one tactical tip>"}

Rules: 2-4 signals, total ≤ R300, ETFs ≤ R120, Shares ≤ R90, Crypto ≤ R60, only tickers from context.`,
      `daily-${todayKey()}`, bypass
    );
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/weekly', async (req, res) => {
  try {
    const ctx    = buildContext(getPortfolio());
    const bypass = req.query.refresh === '1';
    const data   = await callAI(
      `You are an expert JSE investment strategist for a South African retail investor. Respond with valid JSON only — no markdown.`,
      `Context: ${JSON.stringify(ctx)}

Return ONLY this JSON:
{"weekNumber":<n>,"theme":"<2 sentence week thesis>","riskLevel":"<Low|Medium|High>","projectedReturn":"<e.g. 2.5%>","buys":[{"ticker":"<ticker>","name":"<full name>","type":"<ETF|Share|Crypto>","amount":<ZAR>,"bestDay":"<Monday|Tuesday|Wednesday|Thursday|Friday>","priceTarget":"<e.g. +3.5% in 4 weeks>","stopLoss":"<e.g. -5% from entry>","ceilingSignal":"<when to exit>","conviction":"<High|Medium|Low>"}],"reservePlan":"<what to do with R30>","schedule":{"Monday":"<action>","Tuesday":"<action>","Wednesday":"<action>","Thursday":"<action>","Friday":"<action>"},"weekGoal":"<one sentence>"}

Rules: 3-5 buys, total ≤ R270, ETFs ≤ R120, Shares ≤ R90, Crypto ≤ R60.`,
      `weekly-${weekKey()}`, bypass
    );
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/exits', async (req, res) => {
  try {
    const positions = getPortfolio();
    if (!positions.length) return res.json({ positions: [], healthNote: 'No open positions. Log trades first.' });
    const ctx    = buildContext(positions);
    const bypass = req.query.refresh === '1';
    const data   = await callAI(
      `You are an expert JSE exit strategist. Respond with valid JSON only — no markdown.`,
      `Context: ${JSON.stringify(ctx)}

Analyse each open position and return ONLY this JSON:
{"positions":[{"ticker":"<ticker>","signal":"<HOLD|WATCH|TAKE PROFIT|EXIT NOW>","ceilingAssessment":"<one sentence — has it peaked?>","action":"<exact step on EasyEquities/VALR>","exitTarget":"<price, gain % or time trigger>","urgency":"<High|Medium|Low>","reinvestSuggestion":"<where to redeploy if exiting>"}],"healthNote":"<2 sentence overall portfolio health>"}`,
      `exits-${todayKey()}`, bypass
    );
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trades', (req, res) => {
  res.json(db.prepare('SELECT * FROM trades ORDER BY created_at DESC').all());
});

app.post('/api/trades', (req, res) => {
  try {
    const { ticker, type, action, amount, note, date, week } = req.body;
    if (!ticker || !type || !amount) return res.status(400).json({ error: 'ticker, type, amount required' });
    const r = db.prepare(
      'INSERT INTO trades (ticker,type,action,amount,note,date,week) VALUES (?,?,?,?,?,?,?)'
    ).run(ticker.toUpperCase(), type, action || 'BUY', parseFloat(amount), note || '',
          date || todayKey(), week || currentWeek());
    res.json({ id: r.lastInsertRowid, ticker: ticker.toUpperCase(), type, action, amount, note, date, week });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/portfolio', (req, res) => {
  const positions = getPortfolio();
  res.json({
    positions,
    totalInvested: positions.reduce((s, p) => s + p.invested, 0),
    totalBudget:   TOTAL_WEEKS * 300,
    currentWeek:   currentWeek()
  });
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(`R300 Trade Signal → http://localhost:${PORT}`)
);

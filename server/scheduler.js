'use strict';

const cron = require('node-cron');
const aggregator = require('./aggregator');
const brain = require('./brain');
const engine = require('./engine');
const alerts = require('./alerts');
const db = require('./db');

// ─── SSE Client Management ────────────────────────────────────────────────────

let sseClients = [];

function addSSEClient(res) {
  sseClients.push(res);
}

function removeSSEClient(res) {
  sseClients = sseClients.filter((client) => client !== res);
}

function emitSSE(event, data) {
  const payload = JSON.stringify({ type: event, ...data });
  const message = `data: ${payload}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      // Client may have disconnected
    }
  }
}

// ─── ISO Week Helper ──────────────────────────────────────────────────────────

function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return { week, year: now.getFullYear() };
}

// ─── Full Agent Scan Cycle ────────────────────────────────────────────────────

async function runScanCycle() {
  const startTime = Date.now();

  // Check pause/stop state
  if (alerts.isPaused()) {
    db.logAgent('INFO', 'scheduler', 'Scan skipped — agent is paused');
    return;
  }
  if (alerts.isEmergencyStopped()) {
    db.logAgent('WARN', 'scheduler', 'Scan skipped — emergency stop active');
    return;
  }

  try {
    db.logAgent('INFO', 'scheduler', 'Hourly scan cycle starting');

    // a. Fetch snapshot
    const snapshot = await aggregator.fetchMarketSnapshot();

    // b. Get open positions
    const positions = db.getOpenPositions();

    // c. Check stop-losses for each position
    const stopLossPositions = positions.filter(
      (p) => p.gain_pct !== null && p.gain_pct <= -8
    );
    if (stopLossPositions.length > 0) {
      db.logAgent('WARN', 'scheduler', `Stop-loss triggered for ${stopLossPositions.length} positions`, {
        tickers: stopLossPositions.map((p) => p.ticker),
      });
    }

    // d. Get/create weekly budget
    const { week, year } = getCurrentWeekNumber();
    const weeklyBudget = db.getOrCreateWeeklyBudget(week, year);

    // e. Send to Claude for analysis
    const analysis = await brain.analyzeMarket(snapshot, positions, weeklyBudget);

    // f. Process decisions through engine
    const engineResult = await engine.processAnalysis(analysis, snapshot, positions, weeklyBudget);

    // g. Save scan to DB
    const freshBudget = db.getWeeklyBudget(week, year);
    db.insertScan({
      timestamp: snapshot.timestamp,
      market_mood: analysis.marketMood || null,
      fear_greed_score: snapshot.fearGreedScore || null,
      btc_price: snapshot.crypto?.BTCZAR?.lastTradedPrice || null,
      eth_price: snapshot.crypto?.ETHZAR?.lastTradedPrice || null,
      usdzar: snapshot.usdzar || null,
      snapshot_json: JSON.stringify(snapshot),
      analysis_json: JSON.stringify(analysis),
      decisions_count: (analysis.decisions || []).length,
      alerts_count: (analysis.exitAlerts || []).length,
    });

    // h. Send hourly summary to Telegram
    await alerts.sendHourlySummary(analysis, freshBudget || weeklyBudget, db.getOpenPositions());

    // i. Emit SSE event
    emitSSE('scan_complete', {
      timestamp: snapshot.timestamp,
      marketMood: analysis.marketMood,
      fearGreedScore: snapshot.fearGreedScore,
      processed: engineResult.processed,
      rejected: engineResult.rejected,
      cryptoExecuted: engineResult.cryptoExecuted,
      jseAlerts: engineResult.jseAlerts,
      duration: Date.now() - startTime,
    });

    // j. Log completion
    db.logAgent('INFO', 'scheduler', 'Scan cycle complete', {
      duration: Date.now() - startTime,
      ...engineResult,
    });

  } catch (err) {
    db.logAgent('ERROR', 'scheduler', 'Scan cycle failed', { error: err.message });
    emitSSE('scan_error', { error: err.message, timestamp: new Date().toISOString() });
  }
}

// ─── Is Market Hours? (Manual check inside fallback job) ─────────────────────

function isMarketHours() {
  const now = new Date();
  const sastStr = now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' });
  const sast = new Date(sastStr);
  const day = sast.getDay();
  const hours = sast.getHours();
  return day >= 1 && day <= 5 && hours >= 8 && hours <= 17;
}

// ─── Start All Scheduled Jobs ─────────────────────────────────────────────────

function startScheduler() {
  // 1. Hourly scan — Mon-Fri 08:00-17:00 SAST
  cron.schedule('0 8-17 * * 1-5', async () => {
    await runScanCycle();
  }, { timezone: 'Africa/Johannesburg' });

  // Fallback hourly job — runs every hour but checks market hours internally
  cron.schedule('0 * * * *', async () => {
    if (isMarketHours()) {
      await runScanCycle();
    }
  }, { timezone: 'Africa/Johannesburg' });

  // 2. Weekly budget reset — Monday 07:00 SAST
  cron.schedule('0 7 * * 1', async () => {
    try {
      const { week, year } = getCurrentWeekNumber();
      db.getOrCreateWeeklyBudget(week, year);
      await alerts.sendAlert('📅 New week started. Budget reset to R300');
      db.logAgent('INFO', 'scheduler', `Weekly budget created for week ${week}/${year}`);
    } catch (err) {
      db.logAgent('ERROR', 'scheduler', 'Weekly budget reset failed', { error: err.message });
    }
  }, { timezone: 'Africa/Johannesburg' });

  // 3. Morning brief — Mon-Fri 08:00 SAST
  cron.schedule('0 8 * * 1-5', async () => {
    try {
      const snapshot = await aggregator.fetchMarketSnapshot();
      const positions = db.getOpenPositions();
      const { week, year } = getCurrentWeekNumber();
      const budget = db.getWeeklyBudget(week, year);

      const btcPrice = snapshot.crypto?.BTCZAR?.lastTradedPrice?.toLocaleString('en-ZA') || 'N/A';
      const btcChange = snapshot.crypto?.BTCZAR?.changeFromPrevious?.toFixed(2) || '0.00';
      const ethPrice = snapshot.crypto?.ETHZAR?.lastTradedPrice?.toLocaleString('en-ZA') || 'N/A';
      const ethChange = snapshot.crypto?.ETHZAR?.changeFromPrevious?.toFixed(2) || '0.00';
      const usdzar = snapshot.usdzar?.toFixed(2) || 'N/A';

      // Find top JSE mover
      let topMover = { ticker: 'N/A', changePct: 0 };
      for (const [ticker, data] of Object.entries(snapshot.jse || {})) {
        if (data.changePct !== null && Math.abs(data.changePct) > Math.abs(topMover.changePct)) {
          topMover = { ticker, changePct: data.changePct };
        }
      }

      const remaining = budget ? (budget.remaining_zar / 100).toFixed(0) : '300';

      const message = `☀️ Good morning! R300 Bot daily brief
BTC: R${btcPrice} (${btcChange}%)
ETH: R${ethPrice} (${ethChange}%)
USD/ZAR: ${usdzar}
Open positions: ${positions.length}
Budget remaining: R${remaining}
Top JSE mover: ${topMover.ticker} ${topMover.changePct >= 0 ? '+' : ''}${topMover.changePct.toFixed(2)}%`;

      await alerts.sendAlert(message);
      db.logAgent('INFO', 'scheduler', 'Morning brief sent');
    } catch (err) {
      db.logAgent('ERROR', 'scheduler', 'Morning brief failed', { error: err.message });
    }
  }, { timezone: 'Africa/Johannesburg' });

  // 4. End of day summary — Mon-Fri 17:30 SAST
  cron.schedule('30 17 * * 1-5', async () => {
    try {
      const positions = db.getOpenPositions();
      const { week, year } = getCurrentWeekNumber();
      const trades = db.getTrades({ week });
      const budget = db.getWeeklyBudget(week, year);

      const spent = budget ? (budget.spent_zar / 100).toFixed(0) : '0';
      const remaining = budget ? (budget.remaining_zar / 100).toFixed(0) : '300';
      const todayTrades = trades.filter((t) => {
        if (!t.created_at) return false;
        const tradeDate = t.created_at.slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        return tradeDate === today;
      });

      const openGain = positions.reduce((sum, p) => sum + (p.gain_pct || 0), 0);
      const avgGain = positions.length > 0 ? (openGain / positions.length).toFixed(2) : '0.00';

      const message = `🌙 End of Day Summary
Open positions: ${positions.length} | Avg gain: ${avgGain}%
Trades today: ${todayTrades.length}
Week spend: R${spent} / R300 | Remaining: R${remaining}
Session closed.`;

      await alerts.sendAlert(message);
      db.logAgent('INFO', 'scheduler', 'EOD summary sent');
    } catch (err) {
      db.logAgent('ERROR', 'scheduler', 'EOD summary failed', { error: err.message });
    }
  }, { timezone: 'Africa/Johannesburg' });

  db.logAgent('INFO', 'scheduler', 'All scheduled jobs started');
  console.log('[scheduler] All cron jobs registered (timezone: Africa/Johannesburg)');
}

// Export runScanCycle so index.js can trigger it manually
module.exports = {
  startScheduler,
  runScanCycle,
  addSSEClient,
  removeSSEClient,
  emitSSE,
};

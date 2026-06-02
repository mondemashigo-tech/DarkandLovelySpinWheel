'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const db = require('./db');
const aggregator = require('./aggregator');
const brain = require('./brain');
const engine = require('./engine');
const alerts = require('./alerts');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: `http://localhost:${process.env.CLIENT_PORT || 5173}`,
}));
app.use(express.json());

// ─── ISO Week Helper ──────────────────────────────────────────────────────────

function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return { week, year: now.getFullYear() };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/status
app.get('/api/status', (req, res) => {
  try {
    const latestScan = db.getLatestScan();
    res.json({
      agentRunning: true,
      paused: alerts.isPaused(),
      emergencyStop: alerts.isEmergencyStopped(),
      lastScan: latestScan?.timestamp || null,
      version: '1.0.0',
    });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/status error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/snapshot
app.get('/api/snapshot', (req, res) => {
  try {
    const scan = db.getLatestScan();
    if (!scan) {
      return res.json(null);
    }
    let snapshot = null;
    try {
      snapshot = JSON.parse(scan.snapshot_json);
    } catch (_) {
      snapshot = null;
    }
    res.json(snapshot);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/snapshot error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/positions
app.get('/api/positions', (req, res) => {
  try {
    const positions = db.getOpenPositions();
    res.json(positions);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/positions error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/signals
app.get('/api/signals', (req, res) => {
  try {
    const scan = db.getLatestScan();
    if (!scan) {
      return res.json(null);
    }
    let analysis = null;
    try {
      analysis = JSON.parse(scan.analysis_json);
    } catch (_) {
      analysis = null;
    }
    res.json(analysis);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/signals error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/trades
app.get('/api/trades', (req, res) => {
  try {
    const filters = {};
    if (req.query.week !== undefined) filters.week = req.query.week;
    if (req.query.type !== undefined) filters.type = req.query.type;
    const trades = db.getTrades(filters);
    res.json(trades);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/trades error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/budget
app.get('/api/budget', (req, res) => {
  try {
    const { week, year } = getCurrentWeekNumber();
    const budget = db.getOrCreateWeeklyBudget(week, year);
    res.json(budget);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/budget error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/scans
app.get('/api/scans', (req, res) => {
  try {
    const scans = db.getRecentScans(24);
    res.json(scans);
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/scans error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trade/manual
app.post('/api/trade/manual', (req, res) => {
  try {
    const { ticker, action, amount, price, platform, assetType } = req.body;

    if (!ticker || !action || !amount) {
      return res.status(400).json({ error: 'ticker, action, and amount are required' });
    }

    const { week } = getCurrentWeekNumber();
    const id = db.insertTrade({
      ticker,
      action,
      asset_type: assetType || null,
      platform: platform || 'EasyEquities',
      amount_zar: Math.round(amount * 100),
      price: price || null,
      quantity: null,
      order_id: null,
      status: 'PENDING',
      reason: 'Manual trade',
      confidence: 'High',
      executed_at: new Date().toISOString(),
      week_number: week,
      source: 'MANUAL',
    });

    db.logAgent('INFO', 'index', `Manual trade logged: ${ticker} ${action}`, { id });
    res.json({ success: true, id });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/trade/manual error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/position/close
app.post('/api/position/close', (req, res) => {
  try {
    const { id, closePrice, reason } = req.body;

    if (!id || closePrice === undefined) {
      return res.status(400).json({ error: 'id and closePrice are required' });
    }

    db.closePosition(id, closePrice, reason || 'Manual close', null);
    db.logAgent('INFO', 'index', `Position closed manually: id=${id}`);
    res.json({ success: true });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/position/close error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/pause
app.post('/api/agent/pause', async (req, res) => {
  try {
    alerts.setPaused(true);
    db.logAgent('INFO', 'index', 'Agent paused via API');
    await alerts.sendAlert('⏸ Agent paused via API');
    res.json({ paused: true });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/agent/pause error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/resume
app.post('/api/agent/resume', async (req, res) => {
  try {
    alerts.setPaused(false);
    db.logAgent('INFO', 'index', 'Agent resumed via API');
    await alerts.sendAlert('▶️ Agent resumed via API');
    res.json({ paused: false });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/agent/resume error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/agent/scan — trigger immediate scan, return 202
app.post('/api/agent/scan', (req, res) => {
  try {
    // Run async without awaiting — return 202 immediately
    scheduler.runScanCycle().catch((err) => {
      db.logAgent('ERROR', 'index', 'Manual scan cycle error', { error: err.message });
    });
    res.status(202).json({ message: 'Scan triggered', timestamp: new Date().toISOString() });
  } catch (err) {
    db.logAgent('ERROR', 'index', '/api/agent/scan error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events — Server-Sent Events stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Register this client
  scheduler.addSSEClient(res);

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat every 30s to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    } catch (_) {
      // Client disconnected
    }
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    scheduler.removeSSEClient(res);
  });
});

// ─── Uncaught Error Handlers ──────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[index] Uncaught exception:', err.message, err.stack);
  try {
    db.logAgent('ERROR', 'index', 'Uncaught exception', { error: err.message, stack: err.stack });
  } catch (_) {
    // DB might be unavailable
  }
  // Do NOT crash — keep running
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error('[index] Unhandled rejection:', message);
  try {
    db.logAgent('ERROR', 'index', 'Unhandled rejection', { error: message });
  } catch (_) {
    // DB might be unavailable
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  // Initialise weekly budget for current week on startup
  try {
    const { week, year } = getCurrentWeekNumber();
    db.getOrCreateWeeklyBudget(week, year);
  } catch (err) {
    console.error('[index] Failed to initialise weekly budget:', err.message);
  }

  scheduler.startScheduler();
  console.log(`R300 Trade Bot running on port ${PORT}`);
});

module.exports = app;

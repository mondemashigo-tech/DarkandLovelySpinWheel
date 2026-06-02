'use strict';

const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbPath = process.env.DB_PATH || './data/trades.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new BetterSqlite3(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create Tables ────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS positions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker            TEXT,
    asset_type        TEXT CHECK(asset_type IN ('ETF','Share','Crypto')),
    platform          TEXT CHECK(platform IN ('EasyEquities','VALR')),
    invested_zar      INTEGER,
    entry_price       REAL,
    entry_date        TEXT,
    entry_week        INTEGER,
    quantity          REAL,
    current_price     REAL,
    gain_pct          REAL DEFAULT 0,
    status            TEXT DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','PENDING','EXIT_PENDING')),
    stop_loss_price   REAL,
    take_profit_price REAL,
    closed_at         TEXT,
    close_reason      TEXT,
    close_price       REAL,
    realised_pnl      INTEGER,
    created_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT,
    action      TEXT,
    asset_type  TEXT,
    platform    TEXT,
    amount_zar  INTEGER,
    price       REAL,
    quantity    REAL,
    order_id    TEXT,
    status      TEXT DEFAULT 'PENDING',
    reason      TEXT,
    confidence  TEXT,
    executed_at TEXT,
    week_number INTEGER,
    source      TEXT DEFAULT 'AUTO' CHECK(source IN ('AUTO','MANUAL','ALERT','SIMULATED')),
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT,
    market_mood     TEXT,
    fear_greed_score REAL,
    btc_price       REAL,
    eth_price       REAL,
    usdzar          REAL,
    snapshot_json   TEXT,
    analysis_json   TEXT,
    decisions_count INTEGER DEFAULT 0,
    alerts_count    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS weekly_budget (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number   INTEGER,
    year          INTEGER,
    budget_zar    INTEGER DEFAULT 30000,
    spent_zar     INTEGER DEFAULT 0,
    remaining_zar INTEGER DEFAULT 30000,
    reset_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    level     TEXT CHECK(level IN ('INFO','WARN','ERROR')),
    layer     TEXT,
    message   TEXT,
    data_json TEXT
  );
`);

// ─── Prepared Statements ──────────────────────────────────────────────────────

const stmts = {
  insertOrIgnoreBudget: db.prepare(`
    INSERT OR IGNORE INTO weekly_budget (week_number, year, budget_zar, spent_zar, remaining_zar, reset_at)
    VALUES (?, ?, 30000, 0, 30000, datetime('now'))
  `),
  selectBudget: db.prepare(`
    SELECT * FROM weekly_budget WHERE week_number = ? AND year = ? ORDER BY id DESC LIMIT 1
  `),
  updateBudgetSpend: db.prepare(`
    UPDATE weekly_budget
    SET spent_zar = spent_zar + ?, remaining_zar = remaining_zar - ?
    WHERE week_number = ? AND year = ?
  `),
  insertPosition: db.prepare(`
    INSERT INTO positions
      (ticker, asset_type, platform, invested_zar, entry_price, entry_date, entry_week, quantity, current_price, gain_pct, status, stop_loss_price, take_profit_price)
    VALUES
      (@ticker, @asset_type, @platform, @invested_zar, @entry_price, @entry_date, @entry_week, @quantity, @current_price, @gain_pct, @status, @stop_loss_price, @take_profit_price)
  `),
  updatePositionPrice: db.prepare(`
    UPDATE positions SET current_price = ?, gain_pct = ? WHERE ticker = ? AND status IN ('OPEN','PENDING')
  `),
  getOpenPositions: db.prepare(`
    SELECT * FROM positions WHERE status IN ('OPEN','PENDING') ORDER BY created_at DESC
  `),
  closePosition: db.prepare(`
    UPDATE positions
    SET status = 'CLOSED', close_price = ?, close_reason = ?, realised_pnl = ?, closed_at = datetime('now')
    WHERE id = ?
  `),
  insertTrade: db.prepare(`
    INSERT INTO trades
      (ticker, action, asset_type, platform, amount_zar, price, quantity, order_id, status, reason, confidence, executed_at, week_number, source)
    VALUES
      (@ticker, @action, @asset_type, @platform, @amount_zar, @price, @quantity, @order_id, @status, @reason, @confidence, @executed_at, @week_number, @source)
  `),
  insertScan: db.prepare(`
    INSERT INTO scans
      (timestamp, market_mood, fear_greed_score, btc_price, eth_price, usdzar, snapshot_json, analysis_json, decisions_count, alerts_count)
    VALUES
      (@timestamp, @market_mood, @fear_greed_score, @btc_price, @eth_price, @usdzar, @snapshot_json, @analysis_json, @decisions_count, @alerts_count)
  `),
  getLatestScan: db.prepare(`
    SELECT * FROM scans ORDER BY id DESC LIMIT 1
  `),
  insertAgentLog: db.prepare(`
    INSERT INTO agent_log (level, layer, message, data_json)
    VALUES (?, ?, ?, ?)
  `),
  getClosedPositions: db.prepare(`
    SELECT * FROM positions WHERE status = 'CLOSED' ORDER BY closed_at DESC
  `),
  updatePositionStatus: db.prepare(`
    UPDATE positions SET status = ? WHERE id = ?
  `),
};

// ─── Exported Query Functions ─────────────────────────────────────────────────

/**
 * Insert budget row if not present, then return it.
 */
function getOrCreateWeeklyBudget(weekNumber, year) {
  stmts.insertOrIgnoreBudget.run(weekNumber, year);
  return stmts.selectBudget.get(weekNumber, year);
}

/**
 * Add amountCents to spent, subtract from remaining.
 */
function updateWeeklySpend(weekNumber, year, amountCents) {
  stmts.updateBudgetSpend.run(amountCents, amountCents, weekNumber, year);
}

/**
 * Return the current week budget row.
 */
function getWeeklyBudget(weekNumber, year) {
  return stmts.selectBudget.get(weekNumber, year);
}

/**
 * Insert a new position. data must match column names.
 */
function insertPosition(data) {
  const info = stmts.insertPosition.run(data);
  return info.lastInsertRowid;
}

/**
 * Update current_price and gain_pct for all open/pending rows with given ticker.
 */
function updatePositionPrice(ticker, currentPrice, gainPct) {
  stmts.updatePositionPrice.run(currentPrice, gainPct, ticker);
}

/**
 * Return all OPEN and PENDING positions.
 */
function getOpenPositions() {
  return stmts.getOpenPositions.all();
}

/**
 * Close a position by id.
 */
function closePosition(id, closePrice, closeReason, realisedPnl) {
  stmts.closePosition.run(closePrice, closeReason, realisedPnl, id);
}

/**
 * Insert a trade record.
 */
function insertTrade(data) {
  const info = stmts.insertTrade.run(data);
  return info.lastInsertRowid;
}

/**
 * Insert a market scan.
 */
function insertScan(data) {
  const info = stmts.insertScan.run(data);
  return info.lastInsertRowid;
}

/**
 * Return scans from the last `hours` hours.
 */
function getRecentScans(hours) {
  const stmt = db.prepare(`
    SELECT * FROM scans
    WHERE timestamp >= datetime('now', ? || ' hours')
    ORDER BY id DESC
  `);
  return stmt.all(`-${hours}`);
}

/**
 * Return the most recent scan.
 */
function getLatestScan() {
  return stmts.getLatestScan.get();
}

/**
 * Write an entry to agent_log.
 */
function logAgent(level, layer, message, data) {
  try {
    const dataJson = data ? JSON.stringify(data) : null;
    stmts.insertAgentLog.run(level, layer, message, dataJson);
  } catch (err) {
    console.error('[db.logAgent] Failed to write log:', err.message);
  }
}

/**
 * Return trades with optional filters.
 * filters: { week?: number, type?: string }
 */
function getTrades(filters = {}) {
  let sql = 'SELECT * FROM trades WHERE 1=1';
  const params = [];
  if (filters.week !== undefined && filters.week !== null && filters.week !== '') {
    sql += ' AND week_number = ?';
    params.push(Number(filters.week));
  }
  if (filters.type) {
    sql += ' AND asset_type = ?';
    params.push(filters.type);
  }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

/**
 * Return all CLOSED positions.
 */
function getClosedPositions() {
  return stmts.getClosedPositions.all();
}

/**
 * Update status of a position by id.
 */
function updatePositionStatus(id, status) {
  stmts.updatePositionStatus.run(status, id);
}

module.exports = {
  db,
  getOrCreateWeeklyBudget,
  updateWeeklySpend,
  getWeeklyBudget,
  insertPosition,
  updatePositionPrice,
  getOpenPositions,
  closePosition,
  insertTrade,
  insertScan,
  getRecentScans,
  getLatestScan,
  logAgent,
  getTrades,
  getClosedPositions,
  updatePositionStatus,
};

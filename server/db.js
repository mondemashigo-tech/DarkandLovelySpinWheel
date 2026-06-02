import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'trades.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'BUY',
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    week INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export const getTrades = () =>
  db.prepare('SELECT * FROM trades ORDER BY created_at DESC').all();

export const getTradesByTicker = (ticker) =>
  db.prepare('SELECT * FROM trades WHERE ticker = ? ORDER BY created_at ASC').all(ticker);

export const insertTrade = (trade) => {
  const stmt = db.prepare(
    'INSERT INTO trades (ticker, type, action, amount, note, date, week) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    trade.ticker, trade.type, trade.action || 'BUY',
    trade.amount, trade.note || '', trade.date, trade.week
  );
  return { id: result.lastInsertRowid, ...trade };
};

export const getPortfolio = () => {
  const trades = db.prepare('SELECT * FROM trades ORDER BY created_at ASC').all();
  const positions = {};

  for (const t of trades) {
    const key = t.ticker;
    if (t.action === 'BUY') {
      if (!positions[key]) {
        positions[key] = {
          ticker: t.ticker,
          type: t.type,
          invested: 0,
          entryDate: t.date,
          entryWeek: t.week,
          trades: []
        };
      }
      positions[key].invested += t.amount;
      positions[key].trades.push(t);
    } else if (t.action === 'SELL' || t.action === 'EXIT') {
      if (positions[key]) {
        positions[key].invested -= t.amount;
        if (positions[key].invested <= 0) {
          delete positions[key];
        }
      }
    }
  }

  return Object.values(positions);
};

export const getCached = (key) => {
  const row = db.prepare('SELECT response FROM ai_cache WHERE cache_key = ?').get(key);
  return row ? JSON.parse(row.response) : null;
};

export const setCache = (key, data) => {
  db.prepare(
    'INSERT OR REPLACE INTO ai_cache (cache_key, response) VALUES (?, ?)'
  ).run(key, JSON.stringify(data));
};

export default db;

'use strict';

const db = require('./db');

// ─── Module-level State ───────────────────────────────────────────────────────

let paused = false;
let emergencyStop = false;

// ─── Telegram Bot Init ────────────────────────────────────────────────────────

let bot = null;
let usingStub = false;

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

try {
  const TelegramBot = require('node-telegram-bot-api');
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('[alerts] Telegram bot initialised with polling');
} catch (err) {
  usingStub = true;
  console.warn('[alerts] Telegram bot unavailable — using console stub:', err.message);
}

// ─── Core Send Function ───────────────────────────────────────────────────────

async function sendAlert(message) {
  try {
    if (usingStub || !bot) {
      console.log('[TELEGRAM STUB]', message);
      return;
    }
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[alerts] sendAlert failed:', err.message);
    db.logAgent('WARN', 'alerts', 'Telegram send failed', { error: err.message });
  }
}

// ─── Formatted Alert Senders ──────────────────────────────────────────────────

async function sendBuySignal(decision) {
  const message = `🟢 BUY SIGNAL — ${decision.ticker}
Amount: R${decision.amount}
Reason: ${decision.reason}
Confidence: ${decision.confidence}
Action: Open EasyEquities → search ${decision.ticker} → Buy R${decision.amount}
⏱ Urgency: ${decision.urgency}`;

  await sendAlert(message);
}

async function sendSellAlert(decision, position) {
  const gainPct = position ? (position.gain_pct || 0).toFixed(2) : 'N/A';
  const signal = decision.signal || decision.action || 'EXIT';
  const reason = decision.reason || decision.action || 'Exit signal triggered';

  const message = `🚨 EXIT ALERT — ${decision.ticker || position?.ticker}
Signal: ${signal}
Current gain/loss: ${gainPct}%
Action: Open EasyEquities → sell ${decision.ticker || position?.ticker} NOW
Reason: ${reason}`;

  await sendAlert(message);
}

async function sendCryptoExecuted(result) {
  const message = `⚡ CRYPTO TRADE EXECUTED — ${result.pair || ''}
Action: ${result.side || 'BUY'}
Amount: R${result.zarAmount} @ R${result.price}/coin
Qty: ${result.quantity}
Order ID: ${result.orderId}
Status: ${result.status}`;

  await sendAlert(message);
}

async function sendHourlySummary(analysis, budget, positions) {
  const score = analysis.fearGreedScore ?? '—';
  const mood = analysis.marketMood ?? 'Unknown';
  const count = Array.isArray(positions) ? positions.length : 0;
  const spent = budget ? (budget.spent_zar / 100).toFixed(0) : '0';
  const nextNote = analysis.nextScanNote ?? '—';

  const message = `📊 Hourly Scan Complete
Market: ${mood} | Fear/Greed: ${score}
Positions: ${count} open | Week spend: R${spent}/R300
Next watch: ${nextNote}`;

  await sendAlert(message);
}

// ─── Telegram Bot Commands ────────────────────────────────────────────────────

function registerCommands() {
  if (!bot || usingStub) return;

  // /status — open positions summary
  bot.onText(/\/status/, async (msg) => {
    try {
      const positions = db.getOpenPositions();
      if (positions.length === 0) {
        await bot.sendMessage(msg.chat.id, '📭 No open positions.');
        return;
      }
      const lines = positions.map(
        (p) => `• ${p.ticker} | ${p.gain_pct >= 0 ? '+' : ''}${(p.gain_pct || 0).toFixed(2)}% | ${p.status}`
      );
      await bot.sendMessage(msg.chat.id, `📈 Open Positions:\n${lines.join('\n')}`);
    } catch (err) {
      console.error('[alerts] /status error:', err.message);
    }
  });

  // /portfolio — full breakdown
  bot.onText(/\/portfolio/, async (msg) => {
    try {
      const positions = db.getOpenPositions();
      if (positions.length === 0) {
        await bot.sendMessage(msg.chat.id, '📭 Portfolio is empty.');
        return;
      }
      const lines = positions.map((p) => {
        const invested = (p.invested_zar / 100).toFixed(2);
        const currentVal = p.current_price && p.quantity
          ? (p.current_price * p.quantity).toFixed(2)
          : 'N/A';
        const gain = (p.gain_pct || 0).toFixed(2);
        return `• ${p.ticker} (${p.asset_type})\n  Invested: R${invested} | Current: R${currentVal} | Gain: ${gain}%`;
      });
      await bot.sendMessage(msg.chat.id, `💼 Portfolio:\n\n${lines.join('\n\n')}`);
    } catch (err) {
      console.error('[alerts] /portfolio error:', err.message);
    }
  });

  // /pause
  bot.onText(/\/pause/, async (msg) => {
    paused = true;
    db.logAgent('INFO', 'alerts', 'Agent paused via Telegram command');
    await bot.sendMessage(msg.chat.id, '⏸ Agent paused. Send /resume to continue.');
  });

  // /resume
  bot.onText(/\/resume/, async (msg) => {
    paused = false;
    db.logAgent('INFO', 'alerts', 'Agent resumed via Telegram command');
    await bot.sendMessage(msg.chat.id, '▶️ Agent resumed.');
  });

  // /budget
  bot.onText(/\/budget/, async (msg) => {
    try {
      // Get current ISO week
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const budget = db.getWeeklyBudget(week, now.getFullYear());
      if (!budget) {
        await bot.sendMessage(msg.chat.id, '💰 No budget record for this week.');
        return;
      }
      const remaining = (budget.remaining_zar / 100).toFixed(2);
      const spent = (budget.spent_zar / 100).toFixed(2);
      await bot.sendMessage(
        msg.chat.id,
        `💰 Week ${budget.week_number} Budget:\nSpent: R${spent} / R300\nRemaining: R${remaining}`
      );
    } catch (err) {
      console.error('[alerts] /budget error:', err.message);
    }
  });

  // /stop — emergency stop
  bot.onText(/\/stop/, async (msg) => {
    emergencyStop = true;
    db.logAgent('WARN', 'alerts', 'EMERGENCY STOP activated via Telegram');
    await bot.sendMessage(
      msg.chat.id,
      '🛑 EMERGENCY STOP ACTIVATED. All auto-trading halted. Use API to reset.'
    );
  });
}

// Register commands if bot is available
registerCommands();

// ─── Getter Functions ─────────────────────────────────────────────────────────

function isPaused() {
  return paused;
}

function isEmergencyStopped() {
  return emergencyStop;
}

function resetEmergencyStop() {
  emergencyStop = false;
  db.logAgent('INFO', 'alerts', 'Emergency stop reset programmatically');
}

module.exports = {
  sendAlert,
  sendBuySignal,
  sendSellAlert,
  sendCryptoExecuted,
  sendHourlySummary,
  isPaused,
  isEmergencyStopped,
  resetEmergencyStop,
  // For direct pause control from API
  setPaused: (val) => { paused = val; },
};

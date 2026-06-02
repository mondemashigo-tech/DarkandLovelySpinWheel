'use strict';

const db = require('./db');
const valr = require('./valr');
const alerts = require('./alerts');

// ─── Size Limits by Asset Type ────────────────────────────────────────────────

const MAX_SIZE = {
  ETF: 12000,    // R120 in cents
  Share: 9000,   // R90 in cents
  Crypto: 6000,  // R60 in cents
};

// ─── JSE Pre-close Blackout Check ────────────────────────────────────────────

function isPreCloseBlackout() {
  const now = new Date();
  const sastStr = now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' });
  const sast = new Date(sastStr);
  const hours = sast.getHours();
  const minutes = sast.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // 17:00 = 1020 minutes, 16:30 = 990 minutes
  return totalMinutes >= 990 && totalMinutes < 1020;
}

// ─── Get Current ISO Week ─────────────────────────────────────────────────────

function getCurrentWeekNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return { week, year: now.getFullYear() };
}

// ─── Main Processing Function ─────────────────────────────────────────────────

async function processAnalysis(analysis, snapshot, positions, weeklyBudget) {
  const result = {
    processed: 0,
    rejected: 0,
    cryptoExecuted: 0,
    jseAlerts: 0,
    errors: [],
  };

  const decisions = analysis.decisions || [];
  const exitAlerts = analysis.exitAlerts || [];

  // ── Process Exit Alerts from Claude ──────────────────────────────────────────

  for (const exitAlert of exitAlerts) {
    try {
      const matchingPosition = positions.find(
        (p) => p.ticker === exitAlert.ticker && ['OPEN', 'PENDING'].includes(p.status)
      );

      if (!matchingPosition) {
        db.logAgent('WARN', 'engine', `Exit alert for unknown position: ${exitAlert.ticker}`);
        continue;
      }

      if (alerts.isEmergencyStopped()) {
        db.logAgent('WARN', 'engine', `Exit alert skipped (emergency stop): ${exitAlert.ticker}`);
        continue;
      }

      if (matchingPosition.asset_type === 'Crypto') {
        // Auto-execute crypto exit
        const pair = `${exitAlert.ticker}ZAR`;
        const sellResult = await valr.executeCryptoSell(pair, matchingPosition.quantity);
        if (sellResult.success) {
          db.closePosition(matchingPosition.id, matchingPosition.current_price, exitAlert.signal, null);
          const { week, year } = getCurrentWeekNumber();
          db.insertTrade({
            ticker: exitAlert.ticker,
            action: 'SELL',
            asset_type: 'Crypto',
            platform: 'VALR',
            amount_zar: matchingPosition.invested_zar,
            price: matchingPosition.current_price,
            quantity: matchingPosition.quantity,
            order_id: sellResult.orderId,
            status: sellResult.status,
            reason: exitAlert.signal,
            confidence: 'High',
            executed_at: new Date().toISOString(),
            week_number: week,
            source: 'AUTO',
          });
          await alerts.sendCryptoExecuted({
            pair,
            side: 'SELL',
            zarAmount: matchingPosition.invested_zar / 100,
            price: matchingPosition.current_price,
            quantity: matchingPosition.quantity,
            orderId: sellResult.orderId,
            status: sellResult.status,
          });
          result.cryptoExecuted++;
        } else {
          result.errors.push(`Crypto exit sell failed for ${exitAlert.ticker}: ${sellResult.error || sellResult.reason}`);
          db.logAgent('ERROR', 'engine', `Crypto exit sell failed: ${exitAlert.ticker}`, sellResult);
        }
      } else {
        // JSE — send urgent Telegram alert and mark EXIT_PENDING
        const decision = {
          ticker: exitAlert.ticker,
          signal: exitAlert.signal,
          action: exitAlert.action,
          reason: exitAlert.signal,
        };
        await alerts.sendSellAlert(decision, matchingPosition);
        db.updatePositionStatus(matchingPosition.id, 'EXIT_PENDING');
        result.jseAlerts++;
      }
    } catch (err) {
      result.errors.push(`exitAlert processing error for ${exitAlert.ticker}: ${err.message}`);
      db.logAgent('ERROR', 'engine', `exitAlert processing error: ${exitAlert.ticker}`, { error: err.message });
    }
  }

  // ── Process Trade Decisions ───────────────────────────────────────────────────

  for (const decision of decisions) {
    const amountCents = Math.round((decision.amount || 0) * 100);
    let rejectionReason = null;

    // Emergency stop check
    if (alerts.isEmergencyStopped()) {
      rejectionReason = 'Emergency stop active';
    }

    // Budget check
    if (!rejectionReason && weeklyBudget.remaining_zar < amountCents && ['BUY'].includes(decision.action)) {
      rejectionReason = 'Insufficient weekly budget';
    }

    // Position count check
    if (!rejectionReason && decision.action === 'BUY') {
      const openCount = positions.filter((p) => ['OPEN', 'PENDING'].includes(p.status)).length;
      if (openCount >= 6) {
        rejectionReason = 'Max positions reached';
      }
    }

    // Size limit check
    if (!rejectionReason && decision.action === 'BUY') {
      const maxCents = MAX_SIZE[decision.asset] || 0;
      if (maxCents > 0 && amountCents > maxCents) {
        rejectionReason = `Exceeds max position size for asset type (max R${maxCents / 100})`;
      }
    }

    // Market hours check for JSE buys
    if (!rejectionReason && decision.action === 'BUY' && decision.asset !== 'Crypto') {
      if (snapshot.marketSession !== 'OPEN') {
        rejectionReason = 'JSE market closed';
      }
    }

    // Pre-close blackout for JSE
    if (!rejectionReason && decision.action === 'BUY' && decision.asset !== 'Crypto') {
      if (isPreCloseBlackout()) {
        rejectionReason = 'Pre-close blackout period';
      }
    }

    if (rejectionReason) {
      db.logAgent('WARN', 'engine', `Decision rejected: ${decision.ticker} — ${rejectionReason}`, {
        ticker: decision.ticker,
        action: decision.action,
        reason: rejectionReason,
      });
      result.rejected++;
      continue;
    }

    // ── Valid decision — route by asset type and action ──────────────────────

    try {
      const { week, year } = getCurrentWeekNumber();

      if (decision.asset === 'Crypto') {
        const pair = `${decision.ticker}ZAR`;

        if (decision.action === 'BUY') {
          const buyResult = await valr.executeCryptoBuy(pair, decision.amount);

          if (buyResult.success) {
            // Insert trade
            db.insertTrade({
              ticker: decision.ticker,
              action: 'BUY',
              asset_type: 'Crypto',
              platform: 'VALR',
              amount_zar: amountCents,
              price: buyResult.price,
              quantity: buyResult.quantity,
              order_id: buyResult.orderId,
              status: buyResult.status,
              reason: decision.reason,
              confidence: decision.confidence,
              executed_at: new Date().toISOString(),
              week_number: week,
              source: buyResult.status === 'SIMULATED' ? 'SIMULATED' : 'AUTO',
            });

            // Update weekly budget spent
            db.updateWeeklySpend(week, year, amountCents);

            // Refresh weeklyBudget object for subsequent iterations
            weeklyBudget.remaining_zar -= amountCents;
            weeklyBudget.spent_zar += amountCents;

            // Insert position
            db.insertPosition({
              ticker: decision.ticker,
              asset_type: 'Crypto',
              platform: 'VALR',
              invested_zar: amountCents,
              entry_price: buyResult.price,
              entry_date: new Date().toISOString().slice(0, 10),
              entry_week: week,
              quantity: buyResult.quantity,
              current_price: buyResult.price,
              gain_pct: 0,
              status: 'OPEN',
              stop_loss_price: decision.stopLoss || null,
              take_profit_price: decision.entryPrice ? decision.entryPrice * 1.15 : null,
            });

            // Send Telegram
            await alerts.sendCryptoExecuted({
              pair,
              side: 'BUY',
              zarAmount: decision.amount,
              price: buyResult.price,
              quantity: buyResult.quantity,
              orderId: buyResult.orderId,
              status: buyResult.status,
            });

            result.cryptoExecuted++;
            result.processed++;
          } else {
            const errMsg = buyResult.reason || buyResult.error || 'Unknown error';
            result.errors.push(`Crypto BUY failed for ${decision.ticker}: ${errMsg}`);
            await alerts.sendAlert(`❌ Crypto BUY FAILED — ${decision.ticker}\nReason: ${errMsg}`);
            db.logAgent('ERROR', 'engine', `Crypto BUY failed: ${decision.ticker}`, buyResult);
            result.rejected++;
          }

        } else if (decision.action === 'SELL' || decision.action === 'STOP_LOSS' || decision.action === 'TAKE_PROFIT') {
          const matchingPosition = positions.find(
            (p) => p.ticker === decision.ticker && ['OPEN', 'PENDING'].includes(p.status)
          );

          if (!matchingPosition) {
            db.logAgent('WARN', 'engine', `Sell/exit for position not found: ${decision.ticker}`);
            result.rejected++;
            continue;
          }

          const sellResult = await valr.executeCryptoSell(pair, matchingPosition.quantity);

          if (sellResult.success) {
            const realisedPnl = matchingPosition.current_price
              ? Math.round((matchingPosition.current_price - matchingPosition.entry_price) * matchingPosition.quantity * 100)
              : null;

            db.closePosition(matchingPosition.id, matchingPosition.current_price, decision.action, realisedPnl);

            db.insertTrade({
              ticker: decision.ticker,
              action: decision.action,
              asset_type: 'Crypto',
              platform: 'VALR',
              amount_zar: matchingPosition.invested_zar,
              price: matchingPosition.current_price,
              quantity: matchingPosition.quantity,
              order_id: sellResult.orderId,
              status: sellResult.status,
              reason: decision.reason,
              confidence: decision.confidence,
              executed_at: new Date().toISOString(),
              week_number: week,
              source: sellResult.status === 'SIMULATED' ? 'SIMULATED' : 'AUTO',
            });

            await alerts.sendCryptoExecuted({
              pair,
              side: 'SELL',
              zarAmount: matchingPosition.invested_zar / 100,
              price: matchingPosition.current_price,
              quantity: matchingPosition.quantity,
              orderId: sellResult.orderId,
              status: sellResult.status,
            });

            result.cryptoExecuted++;
            result.processed++;
          } else {
            const errMsg = sellResult.error || 'Unknown error';
            result.errors.push(`Crypto SELL failed for ${decision.ticker}: ${errMsg}`);
            db.logAgent('ERROR', 'engine', `Crypto SELL failed: ${decision.ticker}`, sellResult);
            result.rejected++;
          }
        } else {
          // HOLD/WATCH — just log
          db.logAgent('INFO', 'engine', `Crypto ${decision.action}: ${decision.ticker}`, decision);
          result.processed++;
        }

      } else {
        // JSE (ETF or Share)

        if (decision.action === 'BUY') {
          // Send Telegram alert for manual execution
          await alerts.sendBuySignal(decision);

          // Log as ALERT in trades table
          db.insertTrade({
            ticker: decision.ticker,
            action: 'BUY',
            asset_type: decision.asset,
            platform: 'EasyEquities',
            amount_zar: amountCents,
            price: decision.entryPrice || null,
            quantity: null,
            order_id: null,
            status: 'ALERT',
            reason: decision.reason,
            confidence: decision.confidence,
            executed_at: null,
            week_number: week,
            source: 'ALERT',
          });

          result.jseAlerts++;
          result.processed++;

        } else if (
          decision.action === 'SELL' ||
          decision.action === 'STOP_LOSS' ||
          decision.action === 'TAKE_PROFIT'
        ) {
          const matchingPosition = positions.find(
            (p) => p.ticker === decision.ticker && ['OPEN', 'PENDING', 'EXIT_PENDING'].includes(p.status)
          );

          // Send urgent Telegram exit alert
          await alerts.sendSellAlert(decision, matchingPosition || null);

          // Log as PENDING
          db.insertTrade({
            ticker: decision.ticker,
            action: decision.action,
            asset_type: decision.asset,
            platform: 'EasyEquities',
            amount_zar: matchingPosition ? matchingPosition.invested_zar : amountCents,
            price: matchingPosition ? matchingPosition.current_price : null,
            quantity: matchingPosition ? matchingPosition.quantity : null,
            order_id: null,
            status: 'PENDING',
            reason: decision.reason,
            confidence: decision.confidence,
            executed_at: null,
            week_number: week,
            source: 'AUTO',
          });

          if (matchingPosition) {
            db.updatePositionStatus(matchingPosition.id, 'EXIT_PENDING');
          }

          result.jseAlerts++;
          result.processed++;

        } else {
          // HOLD/WATCH
          db.logAgent('INFO', 'engine', `JSE ${decision.action}: ${decision.ticker}`, decision);
          result.processed++;
        }
      }
    } catch (err) {
      result.errors.push(`Processing error for ${decision.ticker}: ${err.message}`);
      db.logAgent('ERROR', 'engine', `Decision processing error: ${decision.ticker}`, { error: err.message });
      result.rejected++;
    }
  }

  // ── Update All Open Position Prices from Snapshot ────────────────────────────

  try {
    const freshPositions = db.getOpenPositions();
    for (const pos of freshPositions) {
      let currentPrice = null;

      if (pos.asset_type === 'Crypto') {
        const pair = `${pos.ticker}ZAR`;
        currentPrice = snapshot.crypto?.[pair]?.lastTradedPrice ?? null;
      } else {
        currentPrice = snapshot.jse?.[pos.ticker]?.price ?? null;
      }

      if (currentPrice !== null && pos.entry_price) {
        const gainPct = ((currentPrice - pos.entry_price) / pos.entry_price) * 100;
        db.updatePositionPrice(pos.ticker, currentPrice, gainPct);
      }
    }
  } catch (err) {
    db.logAgent('WARN', 'engine', 'Position price update failed', { error: err.message });
  }

  db.logAgent('INFO', 'engine', 'processAnalysis complete', result);
  return result;
}

module.exports = { processAnalysis };

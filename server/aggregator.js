'use strict';

const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;
const db = require('./db');

// ─── Ticker Lists ─────────────────────────────────────────────────────────────

const ETF_TICKERS = [
  'CSP500', 'CTOP50', 'ETF500', 'ETF5IT', 'ETFGLD', 'ETFGGB',
  'ETFBND', 'ETFEMA', 'ETFGRE', 'ETFPLD', 'CSGOVI', 'CSPROP', 'CSYSB',
];

const SHARE_TICKERS = [
  'ABG', 'ACL', 'ADH', 'AEG', 'AFE', 'AFT', 'AGL', 'ANG', 'ANH', 'ACS', 'AFH',
];

// Tickers known to be problematic with Yahoo Finance — skip gracefully
const FRAGILE_TICKERS = ['27FGMF', '91DINC', '91GINC'];

const CRYPTO_PAIRS = ['BTCZAR', 'ETHZAR'];

const VALR_BASE = 'https://api.valr.com';
const EXCHANGE_RATE_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

// Baseline USD/ZAR for fear/greed calculation when no cached rate available
const USDZAR_BASELINE = 18.5;

// Module-level cache
let lastSnapshot = null;

// ─── Helper: Normalize a percentage change to 0–100 score ────────────────────

function normalizePct(changePct, minPct = -10, maxPct = 10) {
  const clamped = Math.max(minPct, Math.min(maxPct, changePct));
  return ((clamped - minPct) / (maxPct - minPct)) * 100;
}

// ─── VALR Public Market Summary ───────────────────────────────────────────────

async function fetchCryptoPair(pair) {
  try {
    const url = `${VALR_BASE}/v1/public/${pair}/marketsummary`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return {
      lastTradedPrice: parseFloat(data.lastTradedPrice),
      changeFromPrevious: parseFloat(data.changeFromPrevious),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      baseVolume: parseFloat(data.baseVolume),
    };
  } catch (err) {
    db.logAgent('WARN', 'aggregator', `VALR fetch failed for ${pair}`, { error: err.message });
    return null;
  }
}

// ─── Yahoo Finance JSE Quotes ─────────────────────────────────────────────────

async function fetchJSEQuotes() {
  const results = {};
  const allTickers = [...ETF_TICKERS, ...SHARE_TICKERS];

  for (const ticker of allTickers) {
    const yTicker = `${ticker}.JO`;
    const isFragile = FRAGILE_TICKERS.includes(ticker);
    try {
      const quote = await yahooFinance.quote(yTicker, {
        fields: [
          'regularMarketPrice',
          'regularMarketChangePercent',
          'regularMarketVolume',
          'fiftyDayAverage',
          'twoHundredDayAverage',
          'regularMarketDayHigh',
          'regularMarketDayLow',
        ],
      });

      results[ticker] = {
        price: quote.regularMarketPrice ?? null,
        changePct: quote.regularMarketChangePercent ?? null,
        volume: quote.regularMarketVolume ?? null,
        ma50: quote.fiftyDayAverage ?? null,
        ma200: quote.twoHundredDayAverage ?? null,
        high: quote.regularMarketDayHigh ?? null,
        low: quote.regularMarketDayLow ?? null,
      };
    } catch (err) {
      if (!isFragile) {
        db.logAgent('WARN', 'aggregator', `Yahoo Finance failed for ${ticker}`, { error: err.message });
      }
      // skip this ticker — do not add to results
    }
  }

  return results;
}

// ─── USD/ZAR Exchange Rate ────────────────────────────────────────────────────

async function fetchUSDZAR() {
  try {
    const { data } = await axios.get(EXCHANGE_RATE_URL, { timeout: 8000 });
    return data.rates?.ZAR ?? null;
  } catch (err) {
    db.logAgent('WARN', 'aggregator', 'Exchange rate fetch failed', { error: err.message });
    return null;
  }
}

// ─── NewsAPI Headlines ────────────────────────────────────────────────────────

async function fetchNews() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    db.logAgent('WARN', 'aggregator', 'NEWS_API_KEY not set — skipping news fetch');
    return [];
  }

  try {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'JSE OR South Africa stocks OR VALR OR rand',
        from,
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey,
      },
      timeout: 8000,
    });

    return (data.articles || []).map((a) => ({
      title: a.title,
      source: a.source?.name ?? 'Unknown',
      publishedAt: a.publishedAt,
    }));
  } catch (err) {
    db.logAgent('WARN', 'aggregator', 'NewsAPI fetch failed', { error: err.message });
    return [];
  }
}

// ─── Fear & Greed Score ───────────────────────────────────────────────────────

const POSITIVE_WORDS = ['rally', 'gains', 'surge', 'bullish', 'rise', 'up', 'record'];
const NEGATIVE_WORDS = ['crash', 'drop', 'selloff', 'bearish', 'slump', 'loss', 'tumble'];

function calcFearGreed(btcChangePct, aglChangePct, angChangePct, usdzar, news, prevUsdzar) {
  // BTC 24h change — weight 30%
  const btcScore = normalizePct(btcChangePct ?? 0) * 0.30;

  // AGL + ANG average — weight 30%
  const miningAvg = ((aglChangePct ?? 0) + (angChangePct ?? 0)) / 2;
  const miningScore = normalizePct(miningAvg) * 0.30;

  // USD/ZAR change — weight 20% (inverted: ZAR weakening = fear)
  const prev = prevUsdzar || USDZAR_BASELINE;
  const zarChangePct = usdzar != null ? ((usdzar - prev) / prev) * 100 : 0;
  // Invert: if ZAR weakened (zarChange > 0), score is lower (fear)
  const zarScore = normalizePct(-zarChangePct) * 0.20;

  // News sentiment — weight 20%
  let posCount = 0;
  let negCount = 0;
  for (const article of news) {
    const text = (article.title || '').toLowerCase();
    for (const w of POSITIVE_WORDS) if (text.includes(w)) posCount++;
    for (const w of NEGATIVE_WORDS) if (text.includes(w)) negCount++;
  }
  const total = posCount + negCount || 1;
  const newsSentiment = (posCount / total) * 100; // 0-100
  const newsScore = newsSentiment * 0.20;

  const raw = btcScore + miningScore + zarScore + newsScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Market Session ───────────────────────────────────────────────────────────

function getMarketSession() {
  // Get current time in Africa/Johannesburg
  const now = new Date();
  const sastStr = now.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
  // Parse the locale string — format: "DD/MM/YYYY, HH:MM:SS"
  const [datePart, timePart] = sastStr.split(', ');
  const [hours, minutes] = timePart.split(':').map(Number);
  const dayOfWeek = new Date(
    now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' })
  ).getDay(); // 0=Sun, 1=Mon...6=Sat

  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (!isWeekday) return 'CLOSED';

  const totalMinutes = hours * 60 + minutes;
  const openMinutes = 9 * 60;    // 09:00
  const closeMinutes = 17 * 60;  // 17:00

  if (totalMinutes < openMinutes) return 'PRE';
  if (totalMinutes >= closeMinutes) return 'CLOSED';
  return 'OPEN';
}

// ─── Main Export ──────────────────────────────────────────────────────────────

async function fetchMarketSnapshot() {
  try {
    // Previous USD/ZAR from cache for fear/greed calc
    const prevUsdzar = lastSnapshot?.usdzar ?? null;

    // Fetch all sources concurrently
    const [btcData, ethData, jseQuotes, usdzar, news] = await Promise.all([
      fetchCryptoPair('BTCZAR'),
      fetchCryptoPair('ETHZAR'),
      fetchJSEQuotes(),
      fetchUSDZAR(),
      fetchNews(),
    ]);

    const aglChangePct = jseQuotes['AGL']?.changePct ?? null;
    const angChangePct = jseQuotes['ANG']?.changePct ?? null;
    const btcChangePct = btcData?.changeFromPrevious ?? null;

    const fearGreedScore = calcFearGreed(
      btcChangePct,
      aglChangePct,
      angChangePct,
      usdzar,
      news,
      prevUsdzar
    );

    const snapshot = {
      timestamp: new Date().toISOString(),
      crypto: {
        BTCZAR: btcData,
        ETHZAR: ethData,
      },
      jse: jseQuotes,
      usdzar: usdzar,
      news,
      fearGreedScore,
      marketSession: getMarketSession(),
    };

    // Cache the successful snapshot
    lastSnapshot = snapshot;
    return snapshot;
  } catch (err) {
    db.logAgent('ERROR', 'aggregator', 'fetchMarketSnapshot failed', { error: err.message });

    if (lastSnapshot) {
      return {
        ...lastSnapshot,
        timestamp: new Date().toISOString(),
        fromCache: true,
      };
    }

    // Return a minimal safe object if no cache available
    return {
      timestamp: new Date().toISOString(),
      crypto: { BTCZAR: null, ETHZAR: null },
      jse: {},
      usdzar: null,
      news: [],
      fearGreedScore: 50,
      marketSession: getMarketSession(),
      fromCache: false,
      error: err.message,
    };
  }
}

module.exports = { fetchMarketSnapshot };

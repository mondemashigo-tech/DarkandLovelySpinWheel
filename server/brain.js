'use strict';

const Anthropic = require('@anthropic/sdk');
const db = require('./db');

const client = new Anthropic();

// ─── Safe Default Analysis ────────────────────────────────────────────────────

function defaultAnalysis(reason) {
  return {
    marketMood: 'Neutral',
    fearGreedLabel: 'Neutral',
    summary: `Analysis unavailable - ${reason}`,
    decisions: [],
    exitAlerts: [],
    nextScanNote: 'Retry next scan cycle',
  };
}

// ─── Strip Markdown Code Fences ───────────────────────────────────────────────

function stripMarkdown(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

// ─── Main Export ──────────────────────────────────────────────────────────────

async function analyzeMarket(snapshot, positions, weeklyBudget) {
  const weeklySpend = (weeklyBudget.spent_zar / 100).toFixed(2);
  const remaining = (weeklyBudget.remaining_zar / 100).toFixed(2);

  const systemPrompt = `You are an expert South African quantitative trading analyst and portfolio manager. You specialise in JSE-listed ETFs, shares, and crypto (BTC/ETH via VALR).

Your job: analyse the provided real-time market snapshot and current portfolio, then return precise trade decisions.

HARD RULES you must never break:
- Weekly budget: R300. Spent this week: R${weeklySpend}. Remaining: R${remaining}
- Max position size: R120 ETF, R90 share, R60 crypto
- Stop-loss trigger: 8% drop from entry
- Take-profit flag: 15% gain from entry
- Max 6 open positions total
- Never recommend buying if weekly budget exhausted
- JSE decisions: recommendations only (human executes)
- Crypto decisions: will be auto-executed on VALR

Analyse using these frameworks:
1. Trend: price vs 50-day MA vs 200-day MA (golden cross / death cross signals)
2. Momentum: 24h/7d change direction and acceleration
3. Volume: unusual volume = conviction signal
4. Macro: USD/ZAR impact on JSE mining stocks and ETFs
5. Sentiment: news headlines + fear/greed score
6. Position management: for existing holdings check if stop-loss hit, take-profit reached, or ceiling approaching

Return ONLY valid JSON — no markdown, no explanation outside JSON.`;

  const userMessage = JSON.stringify({
    snapshot,
    positions,
    weeklySpend: weeklyBudget.spent_zar / 100,
    weeklyBudgetRemaining: weeklyBudget.remaining_zar / 100,
    currentWeek: weeklyBudget.week_number,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const rawText = response.content[0]?.text ?? '';
    const cleaned = stripMarkdown(rawText);

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      db.logAgent('ERROR', 'brain', 'JSON parse failed', {
        error: parseErr.message,
        raw: rawText.slice(0, 500),
      });
      return defaultAnalysis('parse error');
    }

    db.logAgent('INFO', 'brain', 'Analysis complete', {
      marketMood: analysis.marketMood,
      decisionsCount: analysis.decisions?.length ?? 0,
      alertsCount: analysis.exitAlerts?.length ?? 0,
    });

    return analysis;
  } catch (err) {
    db.logAgent('ERROR', 'brain', 'Claude API call failed', { error: err.message });
    return defaultAnalysis('API error');
  }
}

module.exports = { analyzeMarket };

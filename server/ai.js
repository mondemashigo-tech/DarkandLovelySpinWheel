import Anthropic from '@anthropic-ai/sdk';
import { getCached, setCache } from './db.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const START_DATE = new Date('2026-06-02');
const TOTAL_WEEKS = 17;

export function getCurrentWeek() {
  const now = new Date();
  const diffMs = now - START_DATE;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(diffWeeks, TOTAL_WEEKS));
}

export function getISOWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

const TICKERS = {
  ETFs: ['CSP500', 'CTOP50', 'ETF500', 'ETF5IT', 'ETFGLD', 'ETFGGB', 'ETFBND', 'ETFEMA', 'ETFGRE', 'ETFPLD', 'CSGOVI', 'CSPROP', 'CSYSB'],
  Shares: ['ABG', 'ACL', 'ADH', 'AEG', 'AFE', 'AFT', 'AGL', 'ANG', 'ANH', 'ACS', 'AFH', '27FGMF', '91DINC', '91GINC'],
  Crypto: ['BTC', 'ETH']
};

function buildContext(positions = []) {
  const currentWeek = getCurrentWeek();
  const weeksLeft = TOTAL_WEEKS - currentWeek + 1;
  const now = new Date();
  const dayName = now.toLocaleDateString('en-ZA', { weekday: 'long' });
  const dateString = now.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });

  return {
    platform: 'EasyEquities JSE + VALR',
    budget: 'R300/week',
    challenge: `4-month JSE investment challenge, week ${currentWeek} of ${TOTAL_WEEKS}, ${weeksLeft} weeks remaining`,
    tickers: TICKERS,
    currentPositions: positions.map(p => ({
      ticker: p.ticker,
      type: p.type,
      invested: `R${p.invested.toFixed(2)}`,
      entryDate: p.entryDate,
      entryWeek: p.entryWeek,
      weeksHeld: currentWeek - p.entryWeek
    })),
    today: `${dayName} ${dateString}`,
    allocation: { ETFs: 'R120 (40%)', Shares: 'R90 (30%)', Crypto: 'R60 (20%)', Reserve: 'R30 (10%)' }
  };
}

async function callAI(systemPrompt, userPrompt, cacheKey, bypass = false) {
  if (!bypass) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const text = response.content[0].text.trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('AI returned non-JSON response');
  }

  setCache(cacheKey, parsed);
  return parsed;
}

export async function getDailySignals(positions = [], bypass = false) {
  const ctx = buildContext(positions);
  const cacheKey = `daily-${getTodayKey()}`;

  const systemPrompt = `You are an expert JSE investment advisor for a South African investor using EasyEquities and VALR.
You provide precise, actionable trade signals for small retail investors with R300/week budgets.
You must respond with valid JSON only — no markdown, no explanations outside the JSON structure.
Today is ${ctx.today}.`;

  const userPrompt = `Context: ${JSON.stringify(ctx)}

Generate today's buy signals. Return ONLY this exact JSON structure:
{
  "dayScore": <number 1-10>,
  "sentiment": "<Bullish|Neutral|Bearish>",
  "marketSummary": "<one sentence about JSE/crypto conditions today>",
  "signals": [
    {
      "ticker": "<ticker>",
      "name": "<full company/fund name>",
      "type": "<ETF|Share|Crypto>",
      "amount": <ZAR number>,
      "action": "<BUY NOW|LIMIT ORDER>",
      "limitPrice": "<price string or null>",
      "urgency": "<High|Medium|Low>",
      "conviction": "<High|Medium|Low>",
      "reason": "<one sentence>"
    }
  ],
  "totalZAR": <sum of all amounts, must not exceed 300>,
  "avoid": ["<ticker or sector to avoid today>"],
  "note": "<one tactical note for the day>"
}

Rules:
- Include 2-4 signals only
- Total ZAR across all signals must not exceed R300
- ETF allocation max R120, Shares max R90, Crypto max R60
- Pick tickers only from the provided lists
- Amounts must be realistic for the platform (min R10 per trade)`;

  return callAI(systemPrompt, userPrompt, cacheKey, bypass);
}

export async function getWeeklyPlan(positions = [], bypass = false) {
  const ctx = buildContext(positions);
  const cacheKey = `weekly-${getISOWeekKey()}`;

  const systemPrompt = `You are an expert JSE investment strategist for a South African investor.
You create weekly investment plans for R300/week budgets on EasyEquities and VALR.
You must respond with valid JSON only — no markdown, no explanations outside the JSON structure.`;

  const userPrompt = `Context: ${JSON.stringify(ctx)}

Generate this week's investment plan. Return ONLY this exact JSON structure:
{
  "weekNumber": <number>,
  "theme": "<2-sentence week theme>",
  "riskLevel": "<Low|Medium|High>",
  "projectedReturn": "<percentage string e.g. '2.5%'>",
  "buys": [
    {
      "ticker": "<ticker>",
      "name": "<full name>",
      "type": "<ETF|Share|Crypto>",
      "amount": <ZAR number>,
      "bestDay": "<Monday|Tuesday|Wednesday|Thursday|Friday>",
      "priceTarget": "<e.g. '+3.5% in 4 weeks'>",
      "stopLoss": "<e.g. '-5% from entry'>",
      "ceilingSignal": "<when to consider exiting>",
      "conviction": "<High|Medium|Low>"
    }
  ],
  "reservePlan": "<what to do with R30 reserve>",
  "schedule": {
    "Monday": "<action>",
    "Tuesday": "<action>",
    "Wednesday": "<action>",
    "Thursday": "<action>",
    "Friday": "<action>"
  },
  "weekGoal": "<one sentence goal for the week>"
}

Rules:
- Include 3-5 buys
- Total weekly spend across all buys must not exceed R270 (R30 is reserve)
- Respect allocation: ETFs R120 max, Shares R90 max, Crypto R60 max
- Pick only from the provided ticker lists
- Price targets should be realistic for 4-week JSE timeframes`;

  return callAI(systemPrompt, userPrompt, cacheKey, bypass);
}

export async function getExitSignals(positions = [], bypass = false) {
  if (!positions.length) {
    return { positions: [], healthNote: 'No open positions to analyse. Log your first trade to get exit signals.' };
  }

  const ctx = buildContext(positions);
  const cacheKey = `exits-${getTodayKey()}`;

  const systemPrompt = `You are an expert JSE exit strategist. You analyse open positions and provide clear exit/hold signals.
You must respond with valid JSON only — no markdown, no explanations outside the JSON structure.`;

  const userPrompt = `Context: ${JSON.stringify(ctx)}

Analyse each open position and return exit signals. Return ONLY this exact JSON structure:
{
  "positions": [
    {
      "ticker": "<ticker>",
      "signal": "<HOLD|WATCH|TAKE PROFIT|EXIT NOW>",
      "ceilingAssessment": "<has it peaked? one sentence>",
      "action": "<exact step to take on EasyEquities/VALR>",
      "exitTarget": "<price target, gain % or time trigger>",
      "urgency": "<High|Medium|Low>",
      "reinvestSuggestion": "<where to redeploy if exiting>"
    }
  ],
  "healthNote": "<overall portfolio health assessment, 2 sentences>"
}

Signal meanings:
- HOLD: position is performing well, keep
- WATCH: showing weakness, monitor closely
- TAKE PROFIT: near target, consider partial exit
- EXIT NOW: exit immediately, protect capital

Analyse each position individually based on ticker type, weeks held, and invested amount.`;

  return callAI(systemPrompt, userPrompt, cacheKey, bypass);
}

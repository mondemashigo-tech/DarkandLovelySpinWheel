import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getTrades, insertTrade, getPortfolio } from './db.js';
import { getDailySignals, getWeeklyPlan, getExitSignals, getCurrentWeek } from './ai.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, week: getCurrentWeek() });
});

app.get('/api/daily', async (req, res) => {
  try {
    const positions = getPortfolio();
    const bypass = req.query.refresh === '1';
    const data = await getDailySignals(positions, bypass);
    res.json(data);
  } catch (err) {
    console.error('Daily signals error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weekly', async (req, res) => {
  try {
    const positions = getPortfolio();
    const bypass = req.query.refresh === '1';
    const data = await getWeeklyPlan(positions, bypass);
    res.json(data);
  } catch (err) {
    console.error('Weekly plan error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/exits', async (req, res) => {
  try {
    const positions = getPortfolio();
    const bypass = req.query.refresh === '1';
    const data = await getExitSignals(positions, bypass);
    res.json(data);
  } catch (err) {
    console.error('Exit signals error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trades', (req, res) => {
  try {
    const trades = getTrades();
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trades', (req, res) => {
  try {
    const { ticker, type, action, amount, note, date, week } = req.body;
    if (!ticker || !type || !amount) {
      return res.status(400).json({ error: 'ticker, type, and amount are required' });
    }
    const today = date || new Date().toISOString().split('T')[0];
    const currentWeek = week || getCurrentWeek();
    const trade = insertTrade({ ticker: ticker.toUpperCase(), type, action: action || 'BUY', amount: parseFloat(amount), note, date: today, week: currentWeek });
    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/portfolio', (req, res) => {
  try {
    const portfolio = getPortfolio();
    const currentWeek = getCurrentWeek();
    const totalInvested = portfolio.reduce((sum, p) => sum + p.invested, 0);
    const weeklyBudgetUsed = totalInvested;
    const totalBudget = currentWeek * 300;
    res.json({ positions: portfolio, totalInvested, totalBudget, currentWeek, utilizationPct: totalBudget > 0 ? (totalInvested / totalBudget * 100).toFixed(1) : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`R300 Trade Signal API running on http://localhost:${PORT}`);
});

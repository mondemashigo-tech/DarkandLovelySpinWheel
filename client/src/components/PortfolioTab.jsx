import { useState, useEffect } from 'react';
import { EmptyState } from './LoadingState';

const TOTAL_WEEKS = 17;
const WEEKLY_BUDGET = 300;
const START_DATE = new Date('2026-06-02');

function getCurrentWeek() {
  const now = new Date();
  const diffMs = now - START_DATE;
  const w = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(w, TOTAL_WEEKS));
}

function compoundProjection(invested, weeklyAdd, weeks, rate = 0.02) {
  let total = invested;
  for (let i = 0; i < weeks; i++) {
    total = (total + weeklyAdd) * (1 + rate);
  }
  return total.toFixed(2);
}

function PositionCard({ pos, index }) {
  const typeColor = pos.type === 'ETF' ? 'var(--cyan)' :
                    pos.type === 'Crypto' ? 'var(--orange)' : 'var(--green)';
  const currentWeek = getCurrentWeek();
  const weeksHeld = currentWeek - pos.entryWeek;

  return (
    <div className={`card fade-up delay-${(index % 5) + 1}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-xl" style={{ color: typeColor }}>{pos.ticker}</span>
            <span className="badge" style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}40` }}>
              {pos.type}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,228,255,0.4)' }}>
            since {pos.entryDate} · week {pos.entryWeek} · {weeksHeld}w held
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl" style={{ color: 'var(--gold)' }}>
            R{pos.invested.toFixed(2)}
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,228,255,0.35)' }}>invested</p>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioTab() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const currentWeek = getCurrentWeek();
  const weeksRemaining = TOTAL_WEEKS - currentWeek;
  const totalBudget = TOTAL_WEEKS * WEEKLY_BUDGET;
  const invested = portfolio?.totalInvested || 0;
  const progress17 = ((currentWeek - 1) / (TOTAL_WEEKS - 1)) * 100;

  const positions = portfolio?.positions || [];
  const byType = { ETF: 0, Share: 0, Crypto: 0 };
  positions.forEach(p => {
    if (p.type === 'ETF') byType.ETF += p.invested;
    else if (p.type === 'Share') byType.Share += p.invested;
    else if (p.type === 'Crypto') byType.Crypto += p.invested;
  });

  return (
    <div className="space-y-4">
      {/* 17-week progress */}
      <div className="card fade-up" style={{ borderColor: 'rgba(255,200,61,0.2)', background: 'rgba(255,200,61,0.02)' }}>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.4)' }}>
            17-WEEK CHALLENGE PROGRESS
          </p>
          <span className="font-display text-lg" style={{ color: 'var(--gold)' }}>
            Week {currentWeek} / {TOTAL_WEEKS}
          </span>
        </div>
        <div className="w-full h-2 rounded-full mb-3" style={{ background: 'rgba(232,228,255,0.07)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress17}%`,
              background: 'linear-gradient(90deg, var(--gold), var(--orange))',
              boxShadow: '0 0 8px var(--gold)',
              transition: 'width 1s ease'
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs" style={{ color: 'rgba(232,228,255,0.35)' }}>INVESTED</p>
            <p className="font-display text-xl" style={{ color: 'var(--gold)' }}>R{invested.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(232,228,255,0.35)' }}>TOTAL BUDGET</p>
            <p className="font-display text-xl" style={{ color: 'var(--cyan)' }}>R{totalBudget}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'rgba(232,228,255,0.35)' }}>WEEKS LEFT</p>
            <p className="font-display text-xl" style={{ color: 'var(--green)' }}>{weeksRemaining}</p>
          </div>
        </div>
      </div>

      {/* Allocation breakdown */}
      {invested > 0 && (
        <div className="card fade-up delay-1">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(232,228,255,0.4)' }}>
            ALLOCATION BREAKDOWN
          </p>
          <div className="space-y-2">
            {[
              { label: 'ETFs', value: byType.ETF, color: 'var(--cyan)', target: invested * 0.4 },
              { label: 'Shares', value: byType.Share, color: 'var(--green)', target: invested * 0.3 },
              { label: 'Crypto', value: byType.Crypto, color: 'var(--orange)', target: invested * 0.2 },
            ].map(({ label, value, color, target }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color }}>{label}</span>
                  <span style={{ color: 'rgba(232,228,255,0.5)' }}>R{value.toFixed(0)}</span>
                </div>
                <div className="w-full h-1 rounded-full" style={{ background: 'rgba(232,228,255,0.08)' }}>
                  <div className="h-full rounded-full" style={{
                    width: target > 0 ? `${Math.min((value / (target * 1.5)) * 100, 100)}%` : '0%',
                    background: color, transition: 'width 0.8s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compound projections */}
      <div className="card fade-up delay-2">
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(232,228,255,0.4)' }}>
          COMPOUND PROJECTIONS (2% weekly return)
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[4, 8, weeksRemaining].map((w, i) => (
            <div key={i} className="rounded-md p-2" style={{ background: 'rgba(46,232,255,0.04)', border: '1px solid rgba(46,232,255,0.1)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>{w}W</p>
              <p className="font-display text-lg" style={{ color: 'var(--green)' }}>
                R{compoundProjection(invested, WEEKLY_BUDGET, w)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Positions */}
      {positions.length === 0 ? (
        <EmptyState
          message="No open positions yet"
          action="Log your first trade in the LOG tab"
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.3)' }}>
            OPEN POSITIONS ({positions.length})
          </p>
          {positions.map((pos, i) => (
            <PositionCard key={pos.ticker} pos={pos} index={i} />
          ))}
        </div>
      )}

      <button
        onClick={load}
        className="w-full py-2 rounded-md text-xs tracking-widest uppercase border"
        style={{ borderColor: 'rgba(46,232,255,0.2)', color: 'rgba(46,232,255,0.5)' }}
      >
        REFRESH PORTFOLIO
      </button>
    </div>
  );
}

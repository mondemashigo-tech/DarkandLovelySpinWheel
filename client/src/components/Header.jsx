import { useState, useEffect } from 'react';

const START_DATE = new Date('2026-06-02');
const TOTAL_WEEKS = 17;

function getCurrentWeek() {
  const now = new Date();
  const diffMs = now - START_DATE;
  const w = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(w, TOTAL_WEEKS));
}

export default function Header({ onQuickAction }) {
  const [week, setWeek] = useState(getCurrentWeek());
  const progress = (week / TOTAL_WEEKS) * 100;

  useEffect(() => {
    const id = setInterval(() => setWeek(getCurrentWeek()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="px-4 py-4 md:px-8">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="pulse-dot w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--green)' }}
            />
            <h1 className="font-display text-4xl md:text-5xl tracking-widest" style={{ color: 'var(--text)' }}>
              R300 TRADE SIGNAL
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'rgba(232,228,255,0.5)' }}>
              WEEK
            </span>
            <span className="font-display text-2xl" style={{ color: 'var(--gold)' }}>
              {week}
            </span>
            <span className="text-xs" style={{ color: 'rgba(232,228,255,0.3)' }}>
              / {TOTAL_WEEKS}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-4" style={{ background: 'rgba(46,232,255,0.1)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--cyan), var(--green))',
              boxShadow: '0 0 8px var(--cyan)'
            }}
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onQuickAction('today')}
            className="px-3 py-1.5 rounded-md text-xs tracking-widest uppercase border transition-all"
            style={{
              borderColor: 'var(--green)',
              color: 'var(--green)',
              background: 'rgba(77,255,159,0.07)'
            }}
          >
            TODAY'S BUYS
          </button>
          <button
            onClick={() => onQuickAction('week')}
            className="px-3 py-1.5 rounded-md text-xs tracking-widest uppercase border transition-all"
            style={{
              borderColor: 'var(--gold)',
              color: 'var(--gold)',
              background: 'rgba(255,200,61,0.07)'
            }}
          >
            WEEK PLAN
          </button>
          <button
            onClick={() => onQuickAction('exits')}
            className="px-3 py-1.5 rounded-md text-xs tracking-widest uppercase border transition-all"
            style={{
              borderColor: 'var(--pink)',
              color: 'var(--pink)',
              background: 'rgba(255,61,138,0.07)'
            }}
          >
            EXIT SIGNALS
          </button>
        </div>
      </div>
    </header>
  );
}

import { useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import LoadingState, { ErrorState } from './LoadingState';

const DAY_COLORS = {
  Monday: 'var(--cyan)', Tuesday: 'var(--green)', Wednesday: 'var(--gold)',
  Thursday: 'var(--orange)', Friday: 'var(--pink)'
};

function WeekBuyCard({ buy, index }) {
  const typeColor = buy.type === 'ETF' ? 'var(--cyan)' :
                    buy.type === 'Crypto' ? 'var(--orange)' : 'var(--green)';
  const convColor = buy.conviction === 'High' ? 'var(--green)' :
                    buy.conviction === 'Medium' ? 'var(--gold)' : 'rgba(232,228,255,0.5)';
  const dayColor = DAY_COLORS[buy.bestDay] || 'var(--cyan)';

  return (
    <div className={`card fade-up delay-${index + 1}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-2xl" style={{ color: typeColor }}>{buy.ticker}</span>
            <span className="badge" style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}40` }}>
              {buy.type}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,228,255,0.5)' }}>{buy.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display text-3xl" style={{ color: 'var(--gold)' }}>
            R{buy.amount}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="badge" style={{ background: `${dayColor}15`, color: dayColor, border: `1px solid ${dayColor}40` }}>
          BUY {buy.bestDay?.toUpperCase()}
        </span>
        <span className="badge" style={{ background: `${convColor}12`, color: convColor, border: `1px solid ${convColor}35` }}>
          {buy.conviction} conviction
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="rounded-md p-2.5" style={{ background: 'rgba(77,255,159,0.07)', border: '1px solid rgba(77,255,159,0.2)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--green)' }}>TARGET</p>
          <p className="text-sm font-display" style={{ color: 'var(--green)' }}>{buy.priceTarget}</p>
        </div>
        <div className="rounded-md p-2.5" style={{ background: 'rgba(255,61,138,0.07)', border: '1px solid rgba(255,61,138,0.2)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--pink)' }}>STOP LOSS</p>
          <p className="text-sm font-display" style={{ color: 'var(--pink)' }}>{buy.stopLoss}</p>
        </div>
        <div className="rounded-md p-2.5" style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--orange)' }}>⚠ CEILING</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--orange)' }}>{buy.ceilingSignal}</p>
        </div>
      </div>
    </div>
  );
}

function DaySchedule({ schedule }) {
  if (!schedule) return null;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return (
    <div className="card fade-up">
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(232,228,255,0.4)' }}>
        WEEK SCHEDULE
      </p>
      <div className="space-y-2">
        {days.map(day => (
          <div key={day} className="flex items-start gap-3">
            <span className="badge flex-shrink-0 mt-0.5" style={{
              background: `${DAY_COLORS[day]}15`,
              color: DAY_COLORS[day],
              border: `1px solid ${DAY_COLORS[day]}40`,
              minWidth: '80px', justifyContent: 'center'
            }}>
              {day.slice(0, 3).toUpperCase()}
            </span>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.65)' }}>
              {schedule[day]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeekTab({ autoLoad }) {
  const { data, loading, error, fetch } = useApi('/api/weekly');

  useEffect(() => {
    if (autoLoad) fetch();
  }, [autoLoad, fetch]);

  return (
    <div className="space-y-4">
      {!data && !loading && !error && (
        <div className="flex flex-col items-center py-12 gap-4">
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,228,255,0.3)' }}>
            THIS WEEK'S INVESTMENT PLAN
          </p>
          <button
            onClick={fetch}
            className="px-6 py-2.5 rounded-md text-sm tracking-widest uppercase border font-display"
            style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'rgba(255,200,61,0.07)', letterSpacing: '0.1em' }}
          >
            GENERATE WEEK PLAN
          </button>
        </div>
      )}

      {loading && <LoadingState message="Strategising week plan..." />}
      {error && <ErrorState error={error} onRetry={fetch} />}

      {data && (
        <>
          {/* Week overview */}
          <div className="card fade-up" style={{ borderColor: 'rgba(255,200,61,0.2)', background: 'rgba(255,200,61,0.03)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>
                  WEEK {data.weekNumber} THEME
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{data.theme}</p>
              </div>
              <div className="flex gap-3">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.4)' }}>RISK</p>
                  <span className="font-display text-lg" style={{
                    color: data.riskLevel === 'High' ? 'var(--pink)' : data.riskLevel === 'Medium' ? 'var(--gold)' : 'var(--green)'
                  }}>
                    {data.riskLevel}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.4)' }}>PROJECTED</p>
                  <span className="font-display text-lg" style={{ color: 'var(--green)' }}>{data.projectedReturn}</span>
                </div>
              </div>
            </div>
            <p className="text-xs" style={{ color: 'rgba(232,228,255,0.5)', borderTop: '1px solid rgba(232,228,255,0.06)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              🎯 {data.weekGoal}
            </p>
          </div>

          {/* Buy cards */}
          <div className="space-y-3">
            {data.buys?.map((buy, i) => (
              <WeekBuyCard key={i} buy={buy} index={i} />
            ))}
          </div>

          {/* Reserve plan */}
          {data.reservePlan && (
            <div className="card fade-up" style={{ borderColor: 'rgba(46,232,255,0.2)' }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--cyan)' }}>
                RESERVE — R30
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.6)' }}>
                {data.reservePlan}
              </p>
            </div>
          )}

          {/* Daily schedule */}
          <DaySchedule schedule={data.schedule} />

          <button
            onClick={() => fetch(true)}
            className="w-full py-2 rounded-md text-xs tracking-widest uppercase border mt-2"
            style={{ borderColor: 'rgba(46,232,255,0.2)', color: 'rgba(46,232,255,0.5)' }}
          >
            REFRESH (bypass cache)
          </button>
        </>
      )}
    </div>
  );
}

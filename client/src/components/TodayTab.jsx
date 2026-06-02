import { useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import LoadingState, { ErrorState, EmptyState } from './LoadingState';

function SentimentBar({ score }) {
  const color = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--gold)' : 'var(--pink)';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(232,228,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score * 10}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
      <span className="font-display text-lg" style={{ color }}>{score}/10</span>
    </div>
  );
}

function BuyCard({ signal, index }) {
  const typeColor = signal.type === 'ETF' ? 'var(--cyan)' :
                    signal.type === 'Crypto' ? 'var(--orange)' : 'var(--green)';
  const actionColor = signal.action === 'BUY NOW' ? 'var(--green)' : 'var(--gold)';
  const urgencyColor = signal.urgency === 'High' ? 'var(--pink)' :
                       signal.urgency === 'Medium' ? 'var(--gold)' : 'var(--cyan)';
  const convColor = signal.conviction === 'High' ? 'var(--green)' :
                    signal.conviction === 'Medium' ? 'var(--gold)' : 'rgba(232,228,255,0.5)';

  return (
    <div className={`card fade-up delay-${index + 1}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-2xl" style={{ color: typeColor }}>{signal.ticker}</span>
            <span className="badge" style={{ background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}40` }}>
              {signal.type}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,228,255,0.5)' }}>{signal.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display text-3xl" style={{ color: 'var(--gold)' }}>
            R{signal.amount}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="badge" style={{
          background: `${actionColor}18`,
          color: actionColor,
          border: `1px solid ${actionColor}50`
        }}>
          {signal.action}
        </span>
        {signal.limitPrice && (
          <span className="badge" style={{ background: 'rgba(255,200,61,0.1)', color: 'var(--gold)', border: '1px solid rgba(255,200,61,0.3)' }}>
            LIMIT @ {signal.limitPrice}
          </span>
        )}
        <span className="badge" style={{ background: `${urgencyColor}12`, color: urgencyColor, border: `1px solid ${urgencyColor}35` }}>
          {signal.urgency} urgency
        </span>
        <span className="badge" style={{ background: `${convColor}12`, color: convColor, border: `1px solid ${convColor}35` }}>
          {signal.conviction} conviction
        </span>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.7)', borderLeft: '2px solid rgba(46,232,255,0.2)', paddingLeft: '0.75rem' }}>
        {signal.reason}
      </p>
    </div>
  );
}

export default function TodayTab({ autoLoad }) {
  const { data, loading, error, fetch } = useApi('/api/daily');

  useEffect(() => {
    if (autoLoad) fetch();
  }, [autoLoad, fetch]);

  return (
    <div className="space-y-4">
      {!data && !loading && !error && (
        <div className="flex flex-col items-center py-12 gap-4">
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,228,255,0.3)' }}>
            TODAY'S BUY SIGNALS
          </p>
          <button
            onClick={fetch}
            className="px-6 py-2.5 rounded-md text-sm tracking-widest uppercase border font-display"
            style={{ borderColor: 'var(--green)', color: 'var(--green)', background: 'rgba(77,255,159,0.07)', letterSpacing: '0.1em' }}
          >
            GENERATE SIGNALS
          </button>
        </div>
      )}

      {loading && <LoadingState message="Analysing JSE conditions..." />}
      {error && <ErrorState error={error} onRetry={fetch} />}

      {data && (
        <>
          {/* Market summary bar */}
          <div className="card fade-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>
                  MARKET SENTIMENT
                </p>
                <span className="font-display text-xl" style={{
                  color: data.sentiment === 'Bullish' ? 'var(--green)' :
                         data.sentiment === 'Bearish' ? 'var(--pink)' : 'var(--gold)'
                }}>
                  {data.sentiment}
                </span>
              </div>
              <div className="flex-1 max-w-[200px]">
                <SentimentBar score={data.dayScore} />
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.6)' }}>
              {data.marketSummary}
            </p>
          </div>

          {/* Signal cards */}
          <div className="space-y-3">
            {data.signals?.map((s, i) => (
              <BuyCard key={i} signal={s} index={i} />
            ))}
          </div>

          {/* Summary row */}
          <div className="card fade-up" style={{ borderColor: 'rgba(255,200,61,0.2)', background: 'rgba(255,200,61,0.04)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.4)' }}>TOTAL TODAY</p>
                <span className="font-display text-3xl" style={{ color: 'var(--gold)' }}>R{data.totalZAR}</span>
                <span className="text-xs ml-2" style={{ color: 'rgba(232,228,255,0.4)' }}>/ R300</span>
              </div>
              {data.avoid?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--pink)' }}>AVOID TODAY</p>
                  <div className="flex gap-1 flex-wrap">
                    {data.avoid.map((a, i) => (
                      <span key={i} className="badge" style={{ background: 'rgba(255,61,138,0.1)', color: 'var(--pink)', border: '1px solid rgba(255,61,138,0.3)' }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {data.note && (
              <p className="text-xs mt-3 pt-3 leading-relaxed" style={{ color: 'rgba(232,228,255,0.5)', borderTop: '1px solid rgba(232,228,255,0.06)' }}>
                💡 {data.note}
              </p>
            )}
          </div>

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

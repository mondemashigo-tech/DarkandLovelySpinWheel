import { useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import LoadingState, { ErrorState, EmptyState } from './LoadingState';

const SIGNAL_CONFIG = {
  'HOLD':         { color: 'var(--green)',  bg: 'rgba(77,255,159,0.08)',  border: 'rgba(77,255,159,0.3)' },
  'WATCH':        { color: 'var(--gold)',   bg: 'rgba(255,200,61,0.08)',  border: 'rgba(255,200,61,0.3)' },
  'TAKE PROFIT':  { color: 'var(--orange)', bg: 'rgba(255,140,0,0.08)',   border: 'rgba(255,140,0,0.3)' },
  'EXIT NOW':     { color: 'var(--pink)',   bg: 'rgba(255,61,138,0.08)',  border: 'rgba(255,61,138,0.3)' },
};

function ExitCard({ pos, index }) {
  const cfg = SIGNAL_CONFIG[pos.signal] || SIGNAL_CONFIG['HOLD'];
  const urgColor = pos.urgency === 'High' ? 'var(--pink)' : pos.urgency === 'Medium' ? 'var(--gold)' : 'var(--green)';

  return (
    <div className={`card fade-up delay-${index + 1}`} style={{ borderColor: cfg.border }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="font-display text-2xl" style={{ color: cfg.color }}>{pos.ticker}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="badge text-sm font-display" style={{
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
            padding: '4px 14px', fontSize: '0.85rem'
          }}>
            {pos.signal}
          </span>
          <span className="badge" style={{ background: `${urgColor}12`, color: urgColor, border: `1px solid ${urgColor}35` }}>
            {pos.urgency} urgency
          </span>
        </div>
      </div>

      {/* Ceiling assessment */}
      <div className="rounded-md p-2.5 mb-3" style={{ background: 'rgba(255,140,0,0.05)', border: '1px solid rgba(255,140,0,0.15)' }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--orange)' }}>⚠ CEILING ASSESSMENT</p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.7)' }}>{pos.ceilingAssessment}</p>
      </div>

      {/* Action box */}
      <div className="rounded-md p-2.5 mb-3" style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}30` }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: cfg.color }}>ACTION</p>
        <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text)' }}>{pos.action}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md p-2" style={{ background: 'rgba(14,14,26,0.8)', border: '1px solid rgba(232,228,255,0.07)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(232,228,255,0.35)' }}>EXIT TARGET</p>
          <p className="text-xs" style={{ color: 'var(--text)' }}>{pos.exitTarget}</p>
        </div>
        <div className="rounded-md p-2" style={{ background: 'rgba(14,14,26,0.8)', border: '1px solid rgba(232,228,255,0.07)' }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(232,228,255,0.35)' }}>REINVEST IN</p>
          <p className="text-xs" style={{ color: 'var(--cyan)' }}>{pos.reinvestSuggestion}</p>
        </div>
      </div>
    </div>
  );
}

export default function ExitsTab({ autoLoad }) {
  const { data, loading, error, fetch } = useApi('/api/exits');

  useEffect(() => {
    if (autoLoad) fetch();
  }, [autoLoad, fetch]);

  return (
    <div className="space-y-4">
      {!data && !loading && !error && (
        <div className="flex flex-col items-center py-12 gap-4">
          <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(232,228,255,0.3)' }}>
            EXIT SIGNAL ANALYSIS
          </p>
          <button
            onClick={fetch}
            className="px-6 py-2.5 rounded-md text-sm tracking-widest uppercase border font-display"
            style={{ borderColor: 'var(--pink)', color: 'var(--pink)', background: 'rgba(255,61,138,0.07)', letterSpacing: '0.1em' }}
          >
            ANALYSE POSITIONS
          </button>
        </div>
      )}

      {loading && <LoadingState message="Analysing open positions..." />}
      {error && <ErrorState error={error} onRetry={fetch} />}

      {data && (
        <>
          {data.positions?.length === 0 ? (
            <EmptyState
              message="No open positions to analyse"
              action="Log trades in the LOG tab first to get exit signals"
            />
          ) : (
            <div className="space-y-3">
              {data.positions?.map((pos, i) => (
                <ExitCard key={i} pos={pos} index={i} />
              ))}
            </div>
          )}

          {data.healthNote && (
            <div className="card fade-up" style={{ borderColor: 'rgba(46,232,255,0.2)', background: 'rgba(46,232,255,0.03)' }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--cyan)' }}>
                PORTFOLIO HEALTH
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,228,255,0.7)' }}>
                {data.healthNote}
              </p>
            </div>
          )}

          <button
            onClick={() => fetch(true)}
            className="w-full py-2 rounded-md text-xs tracking-widest uppercase border mt-2"
            style={{ borderColor: 'rgba(46,232,255,0.2)', color: 'rgba(46,232,255,0.5)' }}
          >
            REFRESH ANALYSIS (bypass cache)
          </button>
        </>
      )}
    </div>
  );
}

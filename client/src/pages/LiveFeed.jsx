import { useState, useEffect } from 'react';
import AgentStatus from '../components/AgentStatus';
import FearGreedGauge from '../components/FearGreedGauge';
import DecisionCard from '../components/DecisionCard';
import BudgetBar from '../components/BudgetBar';
import { useSSE } from '../hooks/useSSE';
import { useBudget } from '../hooks/useBudget';

export default function LiveFeed() {
  const [status, setStatus] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [signals, setSignals] = useState(null);
  const { lastEvent } = useSSE('http://localhost:3001/api/events');
  const { budget } = useBudget();

  const fetchData = async () => {
    try {
      const [s, snap, sig] = await Promise.all([
        fetch('http://localhost:3001/api/status').then(r => r.json()),
        fetch('http://localhost:3001/api/snapshot').then(r => r.json()),
        fetch('http://localhost:3001/api/signals').then(r => r.json()),
      ]);
      setStatus(s); setSnapshot(snap); setSignals(sig);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if (lastEvent?.type === 'scan_complete') fetchData(); }, [lastEvent]);

  const moodColor = signals?.marketMood === 'Bullish' ? '#4DFF9F' : signals?.marketMood === 'Bearish' ? '#FF3D8A' : '#FFC83D';

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <AgentStatus
          paused={status?.paused}
          emergencyStop={status?.emergencyStop}
          lastScan={status?.lastScan}
        />
        <div className="flex-1 max-w-xs">
          <BudgetBar budget={budget} />
        </div>
      </div>

      {/* Market mood banner */}
      {signals && (
        <div className="border rounded-lg p-4 text-center" style={{ borderColor: moodColor + '40', backgroundColor: moodColor + '10' }}>
          <div className="font-display text-3xl" style={{ color: moodColor }}>{signals.marketMood?.toUpperCase()} MARKET</div>
          <div className="text-muted text-sm mt-1">{signals.summary}</div>
        </div>
      )}

      {/* Market data grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'BTC/ZAR', value: snapshot?.crypto?.BTCZAR?.lastTradedPrice, change: snapshot?.crypto?.BTCZAR?.changeFromPrevious },
          { label: 'ETH/ZAR', value: snapshot?.crypto?.ETHZAR?.lastTradedPrice, change: snapshot?.crypto?.ETHZAR?.changeFromPrevious },
          { label: 'USD/ZAR', value: snapshot?.usdzar, change: null },
          { label: 'Session', value: snapshot?.marketSession || '—', change: null, isLabel: true },
        ].map(item => (
          <div key={item.label} className="bg-card border border-white/5 rounded-lg p-4">
            <div className="text-muted text-xs mb-1">{item.label}</div>
            {item.isLabel ? (
              <div className={`font-display text-xl ${item.value === 'OPEN' ? 'text-green' : 'text-muted'}`}>{item.value}</div>
            ) : (
              <>
                <div className="font-display text-xl text-text">
                  {item.value ? `R${Number(item.value).toLocaleString()}` : '—'}
                </div>
                {item.change !== null && item.change !== undefined && (
                  <div className={`text-xs ${parseFloat(item.change) >= 0 ? 'text-green' : 'text-red'}`}>
                    {parseFloat(item.change) >= 0 ? '+' : ''}{parseFloat(item.change).toFixed(2)}%
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fear & Greed */}
        <div className="bg-card border border-white/5 rounded-lg p-6 flex flex-col items-center">
          <div className="font-display text-lg text-muted mb-4">FEAR & GREED INDEX</div>
          <FearGreedGauge score={snapshot?.fearGreedScore ?? 50} label={signals?.fearGreedLabel || 'Neutral'} />
        </div>

        {/* Latest decisions */}
        <div className="bg-card border border-white/5 rounded-lg p-6">
          <div className="font-display text-lg text-muted mb-4">LATEST SIGNALS</div>
          {signals?.decisions?.slice(0, 3).map((d, i) => (
            <DecisionCard key={i} decision={d} />
          ))}
          {!signals?.decisions?.length && <div className="text-muted text-sm">No signals yet</div>}
        </div>
      </div>

      {/* Next scan note */}
      {signals?.nextScanNote && (
        <div className="bg-card border border-cyan/20 rounded-lg p-4 text-sm text-cyan">
          👁 Next scan: {signals.nextScanNote}
        </div>
      )}
    </div>
  );
}

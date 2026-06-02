import { useState, useEffect } from 'react';
import DecisionCard from '../components/DecisionCard';

export default function Signals() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/signals')
      .then(r => r.json()).then(setAnalysis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-muted">Loading analysis...</div>;
  if (!analysis || !analysis.decisions) return <div className="p-6 text-muted">No analysis available. Trigger a scan first.</div>;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-white/5 rounded-lg p-4">
          <div className="text-muted text-xs mb-1">Market Mood</div>
          <div className={`font-display text-2xl ${
            analysis.marketMood === 'Bullish' ? 'text-green' :
            analysis.marketMood === 'Bearish' ? 'text-red' : 'text-gold'
          }`}>{analysis.marketMood}</div>
        </div>
        <div className="bg-card border border-white/5 rounded-lg p-4">
          <div className="text-muted text-xs mb-1">Fear & Greed</div>
          <div className="font-display text-2xl text-cyan">{analysis.fearGreedLabel}</div>
        </div>
      </div>

      {analysis.summary && (
        <div className="bg-card border border-cyan/20 rounded-lg p-4 mb-6 text-sm text-text">
          {analysis.summary}
        </div>
      )}

      {analysis.exitAlerts?.length > 0 && (
        <div className="mb-6">
          <div className="font-display text-xl text-red mb-3">🚨 EXIT ALERTS</div>
          {analysis.exitAlerts.map((alert, i) => (
            <div key={i} className="bg-red/10 border border-red/30 rounded-lg p-4 mb-2">
              <div className="flex justify-between">
                <span className="font-display text-red">{alert.ticker}</span>
                <span className="text-red text-sm">{alert.signal}</span>
              </div>
              <div className="text-muted text-xs mt-1">
                Current: {alert.currentGainPct > 0 ? '+' : ''}{alert.currentGainPct?.toFixed(2)}% | {alert.action}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="font-display text-xl text-muted mb-4">ALL DECISIONS ({analysis.decisions?.length})</div>
      {analysis.decisions?.map((d, i) => <DecisionCard key={i} decision={d} />)}

      {analysis.nextScanNote && (
        <div className="mt-6 bg-card border border-white/5 rounded-lg p-4 text-sm text-cyan">
          👁 {analysis.nextScanNote}
        </div>
      )}
    </div>
  );
}

export default function DecisionCard({ decision }) {
  const actionColors = {
    BUY: 'bg-green text-bg',
    SELL: 'bg-red text-white',
    HOLD: 'bg-surface text-muted border border-muted',
    WATCH: 'bg-cyan text-bg',
    STOP_LOSS: 'bg-red text-white',
    TAKE_PROFIT: 'bg-gold text-bg',
  };
  const confWidth = decision.confidence === 'High' ? 'w-full' : decision.confidence === 'Medium' ? 'w-2/3' : 'w-1/3';
  const confColor = decision.confidence === 'High' ? 'bg-green' : decision.confidence === 'Medium' ? 'bg-gold' : 'bg-red';

  return (
    <div className="bg-card border border-white/5 rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xl text-text">{decision.ticker}</span>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted">{decision.asset}</span>
          <span className={`px-2 py-1 rounded text-xs font-bold font-display ${actionColors[decision.action] || 'bg-surface text-muted'}`}>
            {decision.action}
          </span>
        </div>
      </div>
      {decision.amount > 0 && (
        <div className="text-gold font-display text-lg mb-1">R{decision.amount}</div>
      )}
      <div className="text-muted text-xs mb-2">{decision.reason}</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted">Confidence:</span>
        <div className="flex-1 bg-surface rounded h-1.5">
          <div className={`h-1.5 rounded ${confWidth} ${confColor}`}></div>
        </div>
        <span className="text-xs text-muted">{decision.confidence}</span>
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>&#x23F1; {decision.urgency}</span>
        {decision.stopLoss && <span>SL: R{decision.stopLoss?.toFixed(2)}</span>}
      </div>
      {decision.asset !== 'Crypto' && (
        <div className="mt-2 text-xs text-gold border border-gold/20 rounded px-2 py-1">
          &#x26A0;&#xFE0F; Manual Action Required via EasyEquities
        </div>
      )}
      {decision.asset === 'Crypto' && (
        <div className="mt-2 text-xs text-cyan border border-cyan/20 rounded px-2 py-1">
          &#x26A1; Auto-Executing on VALR
        </div>
      )}
    </div>
  );
}

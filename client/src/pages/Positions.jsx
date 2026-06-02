import { useState } from 'react';
import PositionRow from '../components/PositionRow';
import { usePositions } from '../hooks/usePositions';

export default function Positions() {
  const { positions, loading, refetch } = usePositions();
  const [closing, setClosing] = useState(null);

  const handleClose = async (id) => {
    const closePrice = prompt('Enter close price (e.g. 1234.56):');
    if (!closePrice) return;
    const reason = prompt('Close reason (e.g. Manual, Take Profit):') || 'Manual';
    setClosing(id);
    try {
      await fetch('http://localhost:3001/api/position/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, closePrice: parseFloat(closePrice), reason })
      });
      refetch();
    } finally { setClosing(null); }
  };

  const totalInvested = positions.reduce((s, p) => s + (p.invested_zar || 0), 0) / 100;
  const totalValue = positions.reduce((s, p) => {
    if (p.current_price && p.quantity) return s + p.current_price * p.quantity;
    return s + (p.invested_zar || 0) / 100;
  }, 0);
  const totalGain = totalValue - totalInvested;
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return (
    <div className="p-6">
      {/* P&L Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Invested', value: `R${totalInvested.toFixed(2)}`, color: 'text-text' },
          { label: 'Current Value', value: `R${totalValue.toFixed(2)}`, color: 'text-cyan' },
          { label: 'Total Gain/Loss', value: `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%`, color: gainPct >= 0 ? 'text-green' : 'text-red' },
        ].map(item => (
          <div key={item.label} className="bg-card border border-white/5 rounded-lg p-4">
            <div className="text-muted text-xs mb-1">{item.label}</div>
            <div className={`font-display text-2xl ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
        <div className="font-display text-xl p-4 border-b border-white/5">OPEN POSITIONS</div>
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : positions.length === 0 ? (
          <div className="p-8 text-center text-muted">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-muted text-xs">
                  {['Ticker','Type','Invested','Current','Gain%','Stop-Loss','Status','Action'].map(h => (
                    <th key={h} className="py-3 px-4 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <PositionRow key={p.id} position={p} onClose={handleClose} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function History() {
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState({ type: '', week: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(filter).toString();
    fetch(`http://localhost:3001/api/trades?${params}`)
      .then(r => r.json()).then(setTrades).catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  // Weekly spend data for chart
  const weeklyData = trades.reduce((acc, t) => {
    const week = `W${t.week_number}`;
    const existing = acc.find(d => d.week === week);
    if (existing) existing.amount += t.amount_zar / 100;
    else acc.push({ week, amount: t.amount_zar / 100 });
    return acc;
  }, []);

  const wins = trades.filter(t => t.action === 'SELL' && t.status === 'FILLED').length;
  const losses = trades.filter(t => t.action === 'STOP_LOSS').length;

  const actionColor = { BUY: '#4DFF9F', SELL: '#FF3D8A', HOLD: '#6B6B8A', STOP_LOSS: '#FF3D8A', TAKE_PROFIT: '#FFC83D' };

  return (
    <div className="p-6 space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-white/5 rounded-lg p-4">
          <div className="text-muted text-xs">Total Trades</div>
          <div className="font-display text-2xl text-cyan">{trades.length}</div>
        </div>
        <div className="bg-card border border-white/5 rounded-lg p-4">
          <div className="text-muted text-xs">Wins / Losses</div>
          <div className="font-display text-2xl"><span className="text-green">{wins}</span> / <span className="text-red">{losses}</span></div>
        </div>
        <div className="bg-card border border-white/5 rounded-lg p-4">
          <div className="text-muted text-xs">Win Rate</div>
          <div className="font-display text-2xl text-gold">{wins + losses > 0 ? ((wins/(wins+losses))*100).toFixed(0) : 0}%</div>
        </div>
      </div>

      {/* Weekly spend chart */}
      {weeklyData.length > 0 && (
        <div className="bg-card border border-white/5 rounded-lg p-6">
          <div className="font-display text-lg text-muted mb-4">WEEKLY SPEND</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="week" stroke="#6B6B8A" tick={{ fontFamily: 'Syne Mono', fontSize: 12 }} />
              <YAxis stroke="#6B6B8A" tick={{ fontFamily: 'Syne Mono', fontSize: 12 }} tickFormatter={v => `R${v}`} />
              <Tooltip
                contentStyle={{ background: '#12122A', border: '1px solid #2EE8FF30', borderRadius: 8, fontFamily: 'Syne Mono' }}
                formatter={v => [`R${v.toFixed(2)}`, 'Spent']}
              />
              <Bar dataKey="amount" radius={[4,4,0,0]}>
                {weeklyData.map((_, i) => <Cell key={i} fill="#2EE8FF" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="bg-card border border-white/10 rounded px-3 py-2 text-sm text-text"
        >
          <option value="">All Types</option>
          <option value="ETF">ETF</option>
          <option value="Share">Share</option>
          <option value="Crypto">Crypto</option>
        </select>
      </div>

      {/* Trade list */}
      <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
        <div className="font-display text-xl p-4 border-b border-white/5">TRADE HISTORY</div>
        {loading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : trades.length === 0 ? (
          <div className="p-8 text-center text-muted">No trades yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-muted text-xs">
                  {['Date','Ticker','Action','Amount','Price','Status','Source'].map(h => (
                    <th key={h} className="py-3 px-4 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="py-3 px-4 text-muted text-xs">{new Date(t.executed_at || t.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-display">{t.ticker}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: (actionColor[t.action] || '#6B6B8A') + '20', color: actionColor[t.action] || '#6B6B8A' }}>
                        {t.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">R{(t.amount_zar/100).toFixed(2)}</td>
                    <td className="py-3 px-4">{t.price ? `R${t.price.toFixed(2)}` : '—'}</td>
                    <td className="py-3 px-4 text-muted text-xs">{t.status}</td>
                    <td className="py-3 px-4"><span className={`text-xs ${t.source === 'AUTO' ? 'text-cyan' : t.source === 'SIMULATED' ? 'text-gold' : 'text-muted'}`}>{t.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

const TICKERS = [
  'CSP500','CTOP50','ETF500','ETF5IT','ETFGLD','ETFGGB','ETFBND',
  'ETFEMA','ETFGRE','ETFPLD','CSGOVI','CSPROP','CSYSB',
  'ABG','ACL','ADH','AEG','AFE','AFT','AGL','ANG','ANH','ACS','AFH',
  '27FGMF','91DINC','91GINC','BTC','ETH'
];

const TYPES = ['ETF', 'Share', 'Crypto'];
const ACTIONS = ['BUY', 'SELL', 'EXIT'];

const START_DATE = new Date('2026-06-02');
function getCurrentWeek() {
  const now = new Date();
  const diffMs = now - START_DATE;
  const w = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(w, 17));
}

function TradeRow({ trade }) {
  const actionColor = trade.action === 'BUY' ? 'var(--green)' :
                      trade.action === 'SELL' ? 'var(--gold)' : 'var(--pink)';
  const typeColor = trade.type === 'ETF' ? 'var(--cyan)' :
                    trade.type === 'Crypto' ? 'var(--orange)' : 'var(--green)';

  return (
    <div className="flex items-center gap-3 py-2.5 text-xs" style={{ borderBottom: '1px solid rgba(232,228,255,0.05)' }}>
      <span className="badge" style={{ background: `${actionColor}12`, color: actionColor, border: `1px solid ${actionColor}35`, minWidth: '42px', justifyContent: 'center' }}>
        {trade.action}
      </span>
      <span className="font-display text-base w-20 flex-shrink-0" style={{ color: typeColor }}>{trade.ticker}</span>
      <span style={{ color: 'var(--gold)', minWidth: '60px' }}>R{trade.amount?.toFixed(2)}</span>
      <span className="badge flex-shrink-0" style={{ background: `${typeColor}10`, color: typeColor, border: `1px solid ${typeColor}25` }}>{trade.type}</span>
      <span style={{ color: 'rgba(232,228,255,0.35)', flex: 1, textAlign: 'right' }}>{trade.date} W{trade.week}</span>
    </div>
  );
}

export default function LogTab() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    ticker: '',
    type: 'ETF',
    action: 'BUY',
    amount: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
    week: getCurrentWeek()
  });

  const loadTrades = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trades');
      const data = await res.json();
      setTrades(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrades(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ticker || !form.amount) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        setForm(f => ({ ...f, ticker: '', amount: '', note: '' }));
        loadTrades();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Log form */}
      <div className="card fade-up" style={{ borderColor: 'rgba(77,255,159,0.2)' }}>
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--green)' }}>
          LOG TRADE
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>TICKER</label>
              <select value={form.ticker} onChange={e => set('ticker', e.target.value)} required>
                <option value="">Select ticker...</option>
                {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>TYPE</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>ACTION</label>
              <select value={form.action} onChange={e => set('action', e.target.value)}>
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>AMOUNT (ZAR)</label>
              <input
                type="number" min="1" max="300" step="0.01"
                placeholder="e.g. 120"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>DATE</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>WEEK #</label>
              <input type="number" min="1" max="17" value={form.week} onChange={e => set('week', parseInt(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1" style={{ color: 'rgba(232,228,255,0.4)' }}>NOTE (optional)</label>
            <input type="text" placeholder="e.g. Bought at open" value={form.note} onChange={e => set('note', e.target.value)} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-md text-sm tracking-widest uppercase border font-display"
            style={{
              borderColor: success ? 'var(--green)' : 'var(--green)',
              color: success ? 'var(--bg)' : 'var(--green)',
              background: success ? 'var(--green)' : 'rgba(77,255,159,0.08)',
              letterSpacing: '0.12em',
              opacity: submitting ? 0.6 : 1
            }}
          >
            {success ? '✓ LOGGED' : submitting ? 'LOGGING...' : 'LOG TRADE'}
          </button>
        </form>
      </div>

      {/* Trade history */}
      <div className="card fade-up delay-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232,228,255,0.4)' }}>
            TRADE HISTORY ({trades.length})
          </p>
          <button
            onClick={loadTrades}
            className="text-xs"
            style={{ color: 'rgba(46,232,255,0.5)', background: 'none', border: 'none', padding: 0 }}
          >
            REFRESH
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-6"><div className="spinner" /></div>
        )}

        {!loading && trades.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'rgba(232,228,255,0.25)' }}>
            No trades logged yet
          </p>
        )}

        {!loading && trades.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {trades.map(t => <TradeRow key={t.id} trade={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const ALL_TICKERS = [
  'CSP500','CTOP50','ETF500','ETF5IT','ETFGLD','ETFGGB','ETFBND',
  'ETFEMA','ETFGRE','ETFPLD','CSGOVI','CSPROP','CSYSB',
  'ABG','ACL','ADH','AEG','AFE','AFT','AGL','ANG','ANH','ACS','AFH',
  '27FGMF','91DINC','91GINC','BTC','ETH'
];

export default function TickerTape() {
  const items = [...ALL_TICKERS, ...ALL_TICKERS];

  return (
    <div className="overflow-hidden border-y py-2" style={{
      borderColor: 'rgba(46,232,255,0.1)',
      background: 'rgba(46,232,255,0.03)'
    }}>
      <div className="ticker-tape flex gap-8">
        {items.map((t, i) => (
          <span key={i} className="text-xs font-display tracking-widest" style={{
            color: t === 'BTC' || t === 'ETH' ? 'var(--orange)' :
                   t.startsWith('ETF') || t.startsWith('CS') ? 'var(--cyan)' : 'var(--green)'
          }}>
            {t} <span style={{ color: 'rgba(232,228,255,0.2)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

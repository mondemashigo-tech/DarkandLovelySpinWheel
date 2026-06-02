export default function PositionRow({ position, onClose }) {
  const gain = position.gain_pct || 0;
  const color = gain > 5 ? 'text-green' : gain > 0 ? 'text-cyan' : gain < -5 ? 'text-red' : 'text-gold';
  const nearStop = gain < -6;

  return (
    <tr className={`border-b border-white/5 ${nearStop ? 'bg-red/5' : ''}`}>
      <td className="py-3 px-4 font-display text-lg">{position.ticker}</td>
      <td className="py-3 px-4 text-muted text-sm">{position.asset_type}</td>
      <td className="py-3 px-4">R{(position.invested_zar / 100).toFixed(2)}</td>
      <td className="py-3 px-4">
        {position.current_price ? `R${position.current_price.toFixed(2)}` : '—'}
      </td>
      <td className={`py-3 px-4 font-bold ${color}`}>
        {gain > 0 ? '+' : ''}{gain.toFixed(2)}%
      </td>
      <td className="py-3 px-4 text-muted text-xs">
        {position.stop_loss_price ? `R${position.stop_loss_price.toFixed(2)}` : '—'}
      </td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 rounded text-xs ${
          position.status === 'OPEN' ? 'bg-green/20 text-green' :
          position.status === 'PENDING' ? 'bg-gold/20 text-gold' :
          'bg-red/20 text-red'
        }`}>{position.status}</span>
      </td>
      <td className="py-3 px-4">
        <button
          onClick={() => onClose(position.id)}
          className="text-xs text-red border border-red/30 px-2 py-1 rounded hover:bg-red/10 transition"
        >
          Close
        </button>
      </td>
    </tr>
  );
}

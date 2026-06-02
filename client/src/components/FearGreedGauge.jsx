export default function FearGreedGauge({ score = 50, label = 'Neutral' }) {
  const angle = (score / 100) * 180 - 90; // -90 to 90 degrees
  const color = score < 20 ? '#FF3D8A' : score < 40 ? '#FF6B35' : score < 60 ? '#FFC83D' : score < 80 ? '#2EE8FF' : '#4DFF9F';

  const polarToCartesian = (cx, cy, r, deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcPath = (cx, cy, r, startDeg, endDeg) => {
    const s = polarToCartesian(cx, cy, r, startDeg);
    const e = polarToCartesian(cx, cy, r, endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = polarToCartesian(100, 100, 70, angle);

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <path d={arcPath(100,100,80,180,360)} fill="none" stroke="#1A1A2E" strokeWidth="20"/>
        <path d={arcPath(100,100,80,180,180 + (score/100)*180)} fill="none" stroke={color} strokeWidth="20" strokeLinecap="round"/>
        <line x1="100" y1="100" x2={needle.x} y2={needle.y} stroke="#E8E4FF" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="100" cy="100" r="5" fill="#E8E4FF"/>
        <text x="100" y="80" textAnchor="middle" fill={color} fontSize="24" fontFamily="'Bebas Neue'" >{score}</text>
      </svg>
      <div className="font-display text-lg" style={{ color }}>{label}</div>
    </div>
  );
}

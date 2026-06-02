import { useState, useRef, useCallback } from 'react';

const PRIZES = [
  { label: 'Brush',           color: '#ffffff', text: '#67318C' },
  { label: 'Wallet',          color: '#67318C', text: '#ffffff' },
  { label: 'Comb set',        color: '#D6CAE2', text: '#67318C' },
  { label: '😔 Next time',    color: '#000004', text: '#ffffff' },
  { label: 'Hair ties',       color: '#ffffff', text: '#67318C' },
  { label: 'Hair curlers',    color: '#67318C', text: '#ffffff' },
  { label: 'Cosmetic bag',    color: '#D6CAE2', text: '#67318C' },
  { label: '25% off voucher', color: '#000004', text: '#ffffff' },
];

const N = PRIZES.length;
const SLICE = 360 / N;
const CX = 210, CY = 210, R = 190;

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, start, end) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = (end - start) <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

export default function SpinWheel() {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const baseAngleRef = useRef(0);
  const rafRef = useRef(null);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setShowResult(false);
    setWinner(null);

    const winIndex = Math.floor(Math.random() * N);
    const targetCenter = winIndex * SLICE + SLICE / 2;
    const extraTurns = 4 + Math.floor(Math.random() * 4);
    const from = baseAngleRef.current;
    const to = from + extraTurns * 360 - targetCenter;

    const duration = 2800;
    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setAngle(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        baseAngleRef.current = to % 360;
        setWinner(PRIZES[winIndex]);
        setSpinning(false);
        setTimeout(() => setShowResult(true), 100);
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [spinning]);

  const dismiss = () => {
    setShowResult(false);
    setWinner(null);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: '#DAB1DA', fontFamily: '"Gotham", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
    >
      <h2 style={{ margin: '0 0 4px', fontWeight: 800, color: '#ffffff', fontSize: 'clamp(28px, 6vw, 44px)', textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        Spin the Wheel
      </h2>
      <h3 style={{ color: '#ffffff', margin: '0 0 20px', fontWeight: 600, fontSize: 'clamp(13px, 3vw, 17px)', textAlign: 'center', opacity: 0.92 }}>
        Spin for a chance to win amazing prizes!
      </h3>

      {/* Pointer */}
      <svg
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.28))', transform: 'rotate(180deg)', flexShrink: 0 }}
        width="44" height="32" viewBox="0 0 30 24" aria-hidden="true"
      >
        <polygon points="15,0 30,24 0,24" fill="#C0C0C0" />
      </svg>

      {/* Wheel */}
      <svg
        style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.25))', width: 'min(480px, 92vw)', height: 'min(480px, 92vw)' }}
        viewBox="0 0 420 420"
        aria-label="Prize wheel"
      >
        <circle cx={CX} cy={CY} r={205} fill="none" stroke="#C0C0C0" strokeWidth="8" />
        <g transform={`rotate(${angle} ${CX} ${CY})`}>
          {PRIZES.map((prize, i) => {
            const start = i * SLICE;
            const end = (i + 1) * SLICE;
            const mid = start + SLICE / 2;
            const pos = polar(CX, CY, R * 0.68, mid);
            return (
              <g key={i}>
                <path
                  d={arcPath(CX, CY, R, start, end)}
                  fill={prize.color}
                  stroke="#D6CAE2"
                  strokeWidth="2"
                />
                <text
                  x={pos.x} y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill={prize.text}
                  transform={`rotate(${mid} ${pos.x} ${pos.y})`}
                  style={{ fontFamily: 'inherit', userSelect: 'none', pointerEvents: 'none' }}
                >
                  {prize.label.length > 12
                    ? prize.label.split(' ').map((word, wi) => (
                        <tspan key={wi} x={pos.x} dy={wi === 0 ? '-7' : '15'}>{word}</tspan>
                      ))
                    : prize.label
                  }
                </text>
              </g>
            );
          })}
        </g>
        <circle cx={CX} cy={CY} r="14" fill="#67318C" />
        <circle cx={CX} cy={CY} r="6" fill="#C0C0C0" />
      </svg>

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning}
        style={{
          marginTop: '20px',
          backgroundColor: spinning ? '#9a6dbf' : '#67318C',
          color: '#fff',
          border: 'none',
          padding: '14px 36px',
          borderRadius: '10px',
          fontSize: '18px',
          fontWeight: 700,
          cursor: spinning ? 'not-allowed' : 'pointer',
          boxShadow: '0 6px 14px rgba(0,0,0,0.22)',
          transform: spinning ? 'none' : undefined,
          transition: 'transform 0.2s, background-color 0.2s',
          fontFamily: 'inherit',
          letterSpacing: '0.03em',
        }}
        onMouseEnter={e => { if (!spinning) e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {spinning ? 'Spinning…' : 'Spin the Wheel'}
      </button>

      {/* Result overlay */}
      {showResult && winner && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, padding: '1rem',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '18px',
              padding: '2.5rem 2rem',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>
              {winner.label.includes('Next time') ? '😔' : '🎉'}
            </div>
            <p style={{ margin: '0 0 6px', color: '#67318C', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {winner.label.includes('Next time') ? 'Better luck next time!' : 'Congratulations!'}
            </p>
            <h3 style={{ margin: '0 0 1.5rem', color: '#000004', fontWeight: 800, fontSize: 'clamp(22px, 5vw, 30px)' }}>
              {winner.label.includes('Next time') ? 'No prize this time' : `You won: ${winner.label}`}
            </h3>
            <button
              onClick={dismiss}
              style={{
                backgroundColor: '#67318C', color: '#fff', border: 'none',
                padding: '11px 28px', borderRadius: '8px', fontSize: '15px',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Spin Again
            </button>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes popIn { from { transform: scale(0.8); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          `}</style>
        </div>
      )}
    </div>
  );
}

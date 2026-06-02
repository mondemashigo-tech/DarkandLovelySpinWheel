import { useState, useEffect } from 'react';
export default function AgentStatus({ status, lastScan, paused, emergencyStop }) {
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(next.getHours() + 1, 0, 0, 0);
      const diff = Math.max(0, next - now);
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}m ${s.toString().padStart(2,'0')}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const label = emergencyStop ? 'STOPPED' : paused ? 'PAUSED' : 'SCANNING';
  const color = emergencyStop ? 'text-red' : paused ? 'text-gold' : 'text-green';

  return (
    <div className="flex items-center gap-4">
      <div className={`font-display text-2xl ${color} flex items-center gap-2`}>
        <span className={`w-3 h-3 rounded-full inline-block ${emergencyStop ? 'bg-red' : paused ? 'bg-gold' : 'bg-green animate-pulse'}`}></span>
        {label}
      </div>
      <div className="text-muted text-sm">Next scan: {countdown}</div>
      {lastScan && <div className="text-muted text-xs">Last: {new Date(lastScan).toLocaleTimeString()}</div>}
    </div>
  );
}

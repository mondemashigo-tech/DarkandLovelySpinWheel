import { useState, useEffect } from 'react';

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState('');
  const [scanning, setScanning] = useState(false);
  const [healthChecks, setHealthChecks] = useState({});

  useEffect(() => {
    fetch('http://localhost:3001/api/status').then(r => r.json()).then(setStatus).catch(console.error);
  }, []);

  const toggleAgent = async () => {
    const endpoint = status?.paused ? 'resume' : 'pause';
    await fetch(`http://localhost:3001/api/agent/${endpoint}`, { method: 'POST' });
    const s = await fetch('http://localhost:3001/api/status').then(r => r.json());
    setStatus(s);
  };

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch('http://localhost:3001/api/agent/scan', { method: 'POST' });
      setTesting('Scan triggered! Check Live Feed.');
    } finally { setTimeout(() => setScanning(false), 3000); }
  };

  const testTelegram = async () => {
    setTesting('Sending test message...');
    try {
      await fetch('http://localhost:3001/api/agent/scan', { method: 'POST' });
      setTesting('Test sent! Check Telegram.');
    } catch { setTesting('Failed to send.'); }
    setTimeout(() => setTesting(''), 3000);
  };

  const checkHealth = async () => {
    try {
      const r = await fetch('http://localhost:3001/health');
      const data = await r.json();
      setHealthChecks({ server: 'OK', timestamp: data.timestamp });
    } catch { setHealthChecks({ server: 'ERROR' }); }
  };

  const Row = ({ label, children }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/5">
      <span className="text-text">{label}</span>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <div className="font-display text-3xl text-cyan mb-6">SETTINGS</div>

      <div className="bg-card border border-white/5 rounded-lg p-6 space-y-1">
        <Row label="Agent Status">
          <button
            onClick={toggleAgent}
            className={`px-4 py-2 rounded font-display ${status?.paused ? 'bg-green text-bg' : 'bg-red/20 text-red border border-red/30'}`}
          >
            {status?.paused ? 'RESUME AGENT' : 'PAUSE AGENT'}
          </button>
        </Row>

        <Row label="Paper Trading Mode">
          <div className="text-gold text-sm font-mono">
            {process.env.PAPER_TRADING === 'true' ? 'ENABLED (Safe)' : 'Set PAPER_TRADING=true in .env'}
          </div>
        </Row>

        <Row label="Weekly Budget">
          <div className="text-cyan font-display text-xl">R300 / week</div>
        </Row>

        <Row label="Trigger Manual Scan">
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-4 py-2 rounded font-display bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30 transition disabled:opacity-50"
          >
            {scanning ? 'SCANNING...' : 'SCAN NOW'}
          </button>
        </Row>

        <Row label="Test Telegram Alert">
          <button
            onClick={testTelegram}
            className="px-4 py-2 rounded font-display bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 transition"
          >
            SEND TEST
          </button>
        </Row>

        <Row label="API Health Check">
          <button
            onClick={checkHealth}
            className="px-4 py-2 rounded font-display bg-surface text-muted border border-white/10 hover:bg-card transition"
          >
            CHECK HEALTH
          </button>
        </Row>
      </div>

      {testing && (
        <div className="mt-4 bg-cyan/10 border border-cyan/30 rounded-lg p-3 text-cyan text-sm">{testing}</div>
      )}

      {Object.keys(healthChecks).length > 0 && (
        <div className="mt-4 bg-card border border-white/5 rounded-lg p-4">
          <div className="font-display text-muted text-sm mb-2">HEALTH STATUS</div>
          {Object.entries(healthChecks).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-1">
              <span className="text-muted">{k}</span>
              <span className={v === 'OK' ? 'text-green' : v === 'ERROR' ? 'text-red' : 'text-text'}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-card border border-white/5 rounded-lg p-4 text-xs text-muted space-y-1">
        <div className="font-display text-sm text-text mb-2">ENVIRONMENT VARIABLES</div>
        <div>Server port: {3001}</div>
        <div>DB: ./data/trades.db</div>
        <div>Timezone: Africa/Johannesburg</div>
        <div className="text-red mt-2">Never share your .env file!</div>
      </div>
    </div>
  );
}

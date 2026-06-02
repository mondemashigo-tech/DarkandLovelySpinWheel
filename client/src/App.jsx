import { useState } from 'react';
import LiveFeed from './pages/LiveFeed';
import Positions from './pages/Positions';
import Signals from './pages/Signals';
import History from './pages/History';
import Settings from './pages/Settings';
import './index.css';

const tabs = [
  { id: 'feed', label: 'Live Feed' },
  { id: 'positions', label: 'Positions' },
  { id: 'signals', label: 'Signals' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [active, setActive] = useState('feed');

  const pages = {
    feed: <LiveFeed />,
    positions: <Positions />,
    signals: <Signals />,
    history: <History />,
    settings: <Settings />,
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-white/5 bg-surface sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-display text-3xl text-cyan tracking-wider">R300 TRADE BOT</div>
            <div className="text-muted text-xs">South African Autonomous Trading Agent</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-2 h-2 bg-green rounded-full animate-pulse"></span>
            LIVE
          </div>
        </div>

        {/* Navigation */}
        <nav className="max-w-7xl mx-auto px-6">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`px-5 py-3 font-display text-sm tracking-wider transition-all border-b-2 ${
                  active === tab.id
                    ? 'text-cyan border-cyan'
                    : 'text-muted border-transparent hover:text-text hover:border-white/20'
                }`}
              >
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto">
        {pages[active]}
      </main>
    </div>
  );
}

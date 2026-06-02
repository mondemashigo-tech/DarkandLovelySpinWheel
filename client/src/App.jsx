import { useState } from 'react';
import Header from './components/Header';
import TickerTape from './components/TickerTape';
import TodayTab from './components/TodayTab';
import WeekTab from './components/WeekTab';
import ExitsTab from './components/ExitsTab';
import PortfolioTab from './components/PortfolioTab';
import LogTab from './components/LogTab';
import SpinWheel from './components/SpinWheel';

const TABS = [
  { id: 'today',     label: 'TODAY' },
  { id: 'week',      label: 'THIS WEEK' },
  { id: 'exits',     label: 'EXIT SIGNALS' },
  { id: 'portfolio', label: 'PORTFOLIO' },
  { id: 'log',       label: 'LOG' },
  { id: 'spin',      label: '🎡 SPIN' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [autoLoad, setAutoLoad] = useState({});

  const handleQuickAction = (tab) => {
    setActiveTab(tab);
    setAutoLoad(prev => ({ ...prev, [tab]: (prev[tab] || 0) + 1 }));
  };

  if (activeTab === 'spin') {
    return (
      <>
        <div style={{ position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <button
            onClick={() => setActiveTab('today')}
            style={{
              background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', padding: '6px 16px', borderRadius: '20px',
              fontSize: '12px', letterSpacing: '0.06em', cursor: 'pointer',
              fontFamily: "'Syne Mono', monospace", backdropFilter: 'blur(6px)'
            }}
          >
            ← BACK TO TRADE SIGNAL
          </button>
        </div>
        <SpinWheel />
      </>
    );
  }

  return (
    <>
      <div className="glow-blob-1" />
      <div className="glow-blob-2" />

      <div className="min-h-screen">
        <Header onQuickAction={handleQuickAction} />
        <TickerTape />

        <main className="px-4 pb-12 md:px-8">
          <div className="max-w-[860px] mx-auto pt-6">
            <div className="flex gap-2 flex-wrap mb-6">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'today' && <TodayTab autoLoad={autoLoad.today} />}
            {activeTab === 'week' && <WeekTab autoLoad={autoLoad.week} />}
            {activeTab === 'exits' && <ExitsTab autoLoad={autoLoad.exits} />}
            {activeTab === 'portfolio' && <PortfolioTab />}
            {activeTab === 'log' && <LogTab />}
          </div>
        </main>
      </div>
    </>
  );
}


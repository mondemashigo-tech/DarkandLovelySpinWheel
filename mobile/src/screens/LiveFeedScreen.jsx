import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AgentStatus from '../components/AgentStatus';
import FearGreedGauge from '../components/FearGreedGauge';
import DecisionCard from '../components/DecisionCard';
import BudgetBar from '../components/BudgetBar';
import { useApi } from '../hooks/useApi';
import { useBudget } from '../hooks/useBudget';
import { API_URL } from '../config';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 10) / 2;

const BG = '#080810';
const SURFACE = '#0D0D1A';
const CARD = '#12122A';
const TEXT = '#E8E4FF';
const MUTED = '#6B6B8A';
const GREEN = '#4DFF9F';
const GOLD = '#FFC83D';
const CYAN = '#2EE8FF';
const RED = '#FF3D8A';

function formatRand(val) {
  if (val == null) return 'R—';
  const n = parseFloat(val);
  if (isNaN(n)) return 'R—';
  if (n >= 1_000_000) return `R${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `R${n.toFixed(2)}`;
}

function formatChange(pct) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${parseFloat(pct).toFixed(2)}%`;
}

function MoodBanner({ mood, summary }) {
  const moodColor =
    mood === 'Extreme Fear' ? RED :
    mood === 'Fear' ? '#FF8C00' :
    mood === 'Neutral' ? GOLD :
    mood === 'Greed' ? CYAN : GREEN;

  return (
    <LinearGradient
      colors={[`${moodColor}22`, `${moodColor}08`]}
      style={styles.moodBanner}
    >
      <View style={[styles.moodPill, { borderColor: moodColor }]}>
        <Text style={[styles.moodPillText, { color: moodColor }]}>
          {mood || 'LOADING'}
        </Text>
      </View>
      {summary ? (
        <Text style={styles.moodSummary} numberOfLines={2}>{summary}</Text>
      ) : null}
    </LinearGradient>
  );
}

function PriceCard({ label, price, change, isSession, sessionStatus }) {
  const changeNum = parseFloat(change);
  const changeColor = changeNum >= 0 ? GREEN : RED;

  if (isSession) {
    const statusColor =
      sessionStatus === 'OPEN' ? GREEN :
      sessionStatus === 'PRE' ? GOLD : RED;
    return (
      <View style={[styles.priceCard, { width: CARD_WIDTH }]}>
        <Text style={styles.priceCardLabel}>{label}</Text>
        <Text style={[styles.sessionStatus, { color: statusColor }]}>
          {sessionStatus || '—'}
        </Text>
        <Text style={styles.priceCardSub}>JSE Session</Text>
      </View>
    );
  }

  return (
    <View style={[styles.priceCard, { width: CARD_WIDTH }]}>
      <Text style={styles.priceCardLabel}>{label}</Text>
      <Text style={styles.priceCardPrice} numberOfLines={1} adjustsFontSizeToFit>
        {price != null ? formatRand(price) : '—'}
      </Text>
      {change != null ? (
        <Text style={[styles.priceCardChange, { color: changeColor }]}>
          {formatChange(change)}
        </Text>
      ) : (
        <Text style={[styles.priceCardChange, { color: MUTED }]}>—</Text>
      )}
    </View>
  );
}

function NewsCard({ item }) {
  const dateStr = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
    : '';
  return (
    <View style={styles.newsCard}>
      <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.newsMeta}>{item.source?.name || item.source || ''}{dateStr ? `  ·  ${dateStr}` : ''}</Text>
    </View>
  );
}

export default function LiveFeedScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: status, refetch: refetchStatus } = useApi('/api/status', 30000);
  const { data: snapshot, refetch: refetchSnapshot } = useApi('/api/snapshot', 30000);
  const { data: signals, refetch: refetchSignals } = useApi('/api/signals', 30000);
  const { budget, refetch: refetchBudget } = useBudget();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStatus(), refetchSnapshot(), refetchSignals(), refetchBudget()]);
    setRefreshing(false);
  }, [refetchStatus, refetchSnapshot, refetchSignals, refetchBudget]);

  const analysis = signals?.analysis || null;
  const decisions = analysis?.decisions || [];
  const exitAlerts = analysis?.exitAlerts || [];
  const fearGreedScore = snapshot?.fearGreed?.score ?? analysis?.fearGreedIndex ?? 50;
  const fearGreedLabel = snapshot?.fearGreed?.label ?? analysis?.fearGreedLabel ?? 'Neutral';
  const mood = analysis?.marketMood || snapshot?.mood || null;
  const moodSummary = analysis?.summary || null;

  const prices = snapshot?.prices || {};
  const btcZar = prices?.BTC?.ZAR ?? snapshot?.btcZar ?? null;
  const btcChange = prices?.BTC?.change ?? snapshot?.btcChange ?? null;
  const ethZar = prices?.ETH?.ZAR ?? snapshot?.ethZar ?? null;
  const ethChange = prices?.ETH?.change ?? snapshot?.ethChange ?? null;
  const usdZar = prices?.USD?.ZAR ?? snapshot?.usdZar ?? null;
  const usdChange = prices?.USD?.change ?? snapshot?.usdChange ?? null;
  const sessionStatus = snapshot?.sessionStatus ?? (snapshot?.marketOpen ? 'OPEN' : 'CLOSED');

  const news = snapshot?.news || [];
  const recentNews = news.slice(-3).reverse();

  const agentPaused = status?.paused ?? false;
  const agentStopped = status?.emergencyStop ?? false;
  const lastScan = status?.lastScan ?? null;

  const hasData = snapshot != null || signals != null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={CYAN}
          colors={[CYAN]}
        />
      }
    >
      {/* Agent status + budget */}
      <View style={styles.topRow}>
        <AgentStatus paused={agentPaused} emergencyStop={agentStopped} lastScan={lastScan} />
      </View>
      {budget && <BudgetBar budget={budget} />}

      {/* Mood banner */}
      {mood && <MoodBanner mood={mood} summary={moodSummary} />}

      {/* No-data state */}
      {!hasData && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No data yet — tap refresh or trigger a scan</Text>
        </View>
      )}

      {/* 2x2 price grid */}
      {hasData && (
        <>
          <Text style={styles.sectionHeader}>MARKET PRICES</Text>
          <View style={styles.priceGrid}>
            <PriceCard label="BTC / ZAR" price={btcZar} change={btcChange} />
            <PriceCard label="ETH / ZAR" price={ethZar} change={ethChange} />
            <PriceCard label="USD / ZAR" price={usdZar} change={usdChange} />
            <PriceCard label="MARKET SESSION" isSession sessionStatus={sessionStatus} />
          </View>
        </>
      )}

      {/* Fear & Greed gauge */}
      {hasData && (
        <View style={styles.gaugeCard}>
          <Text style={styles.sectionHeader}>FEAR & GREED INDEX</Text>
          <FearGreedGauge score={fearGreedScore} label={fearGreedLabel} />
        </View>
      )}

      {/* Latest signals */}
      {decisions.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>LATEST SIGNALS</Text>
          {decisions.slice(0, 3).map((d, i) => (
            <DecisionCard key={d.ticker ?? i} decision={d} />
          ))}
        </>
      )}

      {/* Exit alerts teaser */}
      {exitAlerts.length > 0 && (
        <View style={[styles.card, { borderColor: `${RED}44` }]}>
          <Text style={[styles.sectionHeader, { color: RED }]}>
            🚨 {exitAlerts.length} EXIT ALERT{exitAlerts.length > 1 ? 'S' : ''} — SEE SIGNALS TAB
          </Text>
        </View>
      )}

      {/* News */}
      {recentNews.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>MARKET NEWS</Text>
          {recentNews.map((item, i) => (
            <NewsCard key={i} item={item} />
          ))}
        </>
      )}

      {/* Next scan note */}
      {analysis?.nextScanNote ? (
        <View style={[styles.card, { borderColor: `${CYAN}33` }]}>
          <Text style={styles.nextScanText}>👁 {analysis.nextScanNote}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 16,
    letterSpacing: 2,
    color: TEXT,
    marginBottom: 8,
    marginTop: 4,
  },
  moodBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moodPillText: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 15,
    letterSpacing: 1,
  },
  moodSummary: {
    flex: 1,
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  priceCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
  },
  priceCardLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  priceCardPrice: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 22,
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceCardChange: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
  },
  priceCardSub: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  sessionStatus: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 26,
    letterSpacing: 2,
    marginBottom: 2,
  },
  gaugeCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
    alignItems: 'center',
  },
  newsCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 8,
  },
  newsTitle: {
    color: TEXT,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  newsMeta: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
  },
  nextScanText: {
    color: CYAN,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
  },
});

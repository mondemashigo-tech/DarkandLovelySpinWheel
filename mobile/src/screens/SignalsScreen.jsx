import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useApi } from '../hooks/useApi';
import DecisionCard from '../components/DecisionCard';

const BG = '#080810';
const CARD = '#12122A';
const TEXT = '#E8E4FF';
const MUTED = '#6B6B8A';
const GREEN = '#4DFF9F';
const GOLD = '#FFC83D';
const CYAN = '#2EE8FF';
const RED = '#FF3D8A';

function getMoodColor(mood) {
  if (!mood) return MUTED;
  const m = mood.toLowerCase();
  if (m.includes('extreme fear')) return RED;
  if (m.includes('fear')) return '#FF8C00';
  if (m.includes('neutral')) return GOLD;
  if (m.includes('greed')) return GREEN;
  return CYAN;
}

function getFearGreedColor(score) {
  const n = parseFloat(score);
  if (isNaN(n)) return MUTED;
  if (n < 20) return RED;
  if (n < 40) return '#FF8C00';
  if (n < 60) return GOLD;
  if (n < 80) return CYAN;
  return GREEN;
}

function ExitAlertCard({ alert }) {
  const gainPct = parseFloat(alert.gain_pct ?? alert.gainPct ?? alert.currentGainPct ?? 0);
  const gainColor = gainPct >= 0 ? GREEN : RED;
  return (
    <View style={styles.exitCard}>
      <View style={styles.exitRow}>
        <Text style={styles.exitTicker}>{alert.ticker}</Text>
        {alert.signal ? (
          <View style={styles.exitBadge}>
            <Text style={styles.exitBadgeText}>{alert.signal}</Text>
          </View>
        ) : null}
        <Text style={[styles.exitGain, { color: gainColor }]}>
          {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%
        </Text>
      </View>
      {alert.action ? (
        <Text style={styles.exitAction}>{alert.action}</Text>
      ) : null}
    </View>
  );
}

export default function SignalsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { data: signals, loading, refetch } = useApi('/api/signals', 30000);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const analysis = signals?.analysis || null;
  const decisions = analysis?.decisions || [];
  const exitAlerts = analysis?.exitAlerts || [];
  const marketMood = analysis?.marketMood || null;
  const fearGreedScore = analysis?.fearGreedIndex ?? null;
  const fearGreedLabel = analysis?.fearGreedLabel ?? null;
  const summary = analysis?.summary || null;
  const nextScanNote = analysis?.nextScanNote || null;

  const hasAnalysis = analysis != null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} colors={[CYAN]} />
      }
    >
      {loading && !hasAnalysis && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CYAN} />
          <Text style={styles.loadingText}>Fetching signals...</Text>
        </View>
      )}

      {!loading && !hasAnalysis && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO ANALYSIS YET</Text>
          <Text style={styles.emptySubtitle}>
            No analysis yet. Trigger a scan in Settings tab.
          </Text>
        </View>
      )}

      {hasAnalysis && (
        <>
          {/* Mood + Fear & Greed row */}
          <View style={styles.moodRow}>
            <View style={[styles.moodCard, { flex: 1 }]}>
              <Text style={styles.moodCardLabel}>MARKET MOOD</Text>
              <Text style={[styles.moodCardValue, { color: getMoodColor(marketMood) }]}>
                {marketMood || '—'}
              </Text>
            </View>
            <View style={[styles.moodCard, { flex: 1 }]}>
              <Text style={styles.moodCardLabel}>FEAR & GREED</Text>
              <Text style={[styles.moodCardValue, { color: getFearGreedColor(fearGreedScore) }]}>
                {fearGreedLabel || (fearGreedScore != null ? String(Math.round(fearGreedScore)) : '—')}
              </Text>
              {fearGreedScore != null && (
                <Text style={[styles.moodCardSub, { color: getFearGreedColor(fearGreedScore) }]}>
                  {Math.round(fearGreedScore)} / 100
                </Text>
              )}
            </View>
          </View>

          {/* Summary card */}
          {summary ? (
            <View style={[styles.card, { borderColor: `${CYAN}44` }]}>
              <Text style={styles.summaryLabel}>ANALYSIS SUMMARY</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          ) : null}

          {/* Exit alerts */}
          {exitAlerts.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: RED }]}>
                🚨 EXIT ALERTS ({exitAlerts.length})
              </Text>
              {exitAlerts.map((alert, i) => (
                <ExitAlertCard key={alert.ticker ?? i} alert={alert} />
              ))}
            </>
          )}

          {/* All decisions */}
          <Text style={styles.sectionHeader}>
            ALL DECISIONS ({decisions.length})
          </Text>

          {decisions.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.noDecisionsText}>No trading decisions in this analysis.</Text>
            </View>
          ) : (
            decisions.map((d, i) => (
              <DecisionCard key={d.ticker ?? i} decision={d} />
            ))
          )}

          {/* Next scan note */}
          {nextScanNote ? (
            <View style={[styles.card, { borderColor: `${CYAN}44`, marginTop: 4 }]}>
              <Text style={styles.nextScanText}>👁 {nextScanNote}</Text>
            </View>
          ) : null}
        </>
      )}
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
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 20,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
  },
  sectionHeader: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 16,
    letterSpacing: 2,
    color: TEXT,
    marginBottom: 8,
    marginTop: 4,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  moodCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
  },
  moodCardLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 6,
  },
  moodCardValue: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 18,
    letterSpacing: 1,
  },
  moodCardSub: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  summaryLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryText: {
    color: TEXT,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    lineHeight: 19,
  },
  exitCard: {
    backgroundColor: `${RED}14`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${RED}44`,
    marginBottom: 8,
  },
  exitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  exitTicker: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 22,
    letterSpacing: 1,
    marginRight: 4,
  },
  exitBadge: {
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  exitBadgeText: {
    color: RED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  exitGain: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 13,
  },
  exitAction: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  noDecisionsText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    textAlign: 'center',
  },
  nextScanText: {
    color: CYAN,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
});

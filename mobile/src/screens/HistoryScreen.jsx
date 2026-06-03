import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { API_URL } from '../config';

const BG = '#080810';
const SURFACE = '#0D0D1A';
const CARD = '#12122A';
const TEXT = '#E8E4FF';
const MUTED = '#6B6B8A';
const GREEN = '#4DFF9F';
const GOLD = '#FFC83D';
const CYAN = '#2EE8FF';
const RED = '#FF3D8A';

const ACTION_COLORS = {
  BUY: GREEN,
  SELL: RED,
  HOLD: MUTED,
  WATCH: CYAN,
  STOP_LOSS: RED,
  TAKE_PROFIT: GOLD,
};

function StatCard({ label, value, valueColor }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function WeeklyChart({ data }) {
  const SVG_W = 280;
  const SVG_H = 140;
  const PAD_L = 36;
  const PAD_B = 30;
  const PAD_T = 14;
  const chartW = SVG_W - PAD_L - 8;
  const chartH = SVG_H - PAD_B - PAD_T;

  if (!data || data.length === 0) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.sectionHeader}>WEEKLY SPEND</Text>
        <Text style={styles.noChartText}>No trade history yet</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  const slotW = chartW / data.length;
  const barW = Math.min(28, slotW - 6);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionHeader}>WEEKLY SPEND</Text>
      <Svg width={SVG_W} height={SVG_H}>
        {/* Y-axis label */}
        <SvgText x={PAD_L - 4} y={PAD_T + 4} fill={MUTED} fontSize="8" textAnchor="end">
          R{maxVal.toFixed(0)}
        </SvgText>
        <SvgText x={PAD_L - 4} y={SVG_H - PAD_B} fill={MUTED} fontSize="8" textAnchor="end">
          R0
        </SvgText>
        {data.map((d, i) => {
          const barH = Math.max(3, (d.amount / maxVal) * chartH);
          const x = PAD_L + i * slotW + (slotW - barW) / 2;
          const y = PAD_T + chartH - barH;
          const fill = d.amount >= 240 ? RED : d.amount >= 150 ? GOLD : CYAN;
          return (
            <G key={d.week}>
              <Rect x={x} y={y} width={barW} height={barH} fill={fill} rx={3} opacity={0.9} />
              <SvgText
                x={x + barW / 2}
                y={SVG_H - PAD_B + 12}
                fill={MUTED}
                fontSize="9"
                textAnchor="middle"
              >
                {d.week}
              </SvgText>
              {d.amount > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 3}
                  fill={fill}
                  fontSize="8"
                  textAnchor="middle"
                >
                  R{d.amount.toFixed(0)}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function TradeRow({ trade }) {
  const color = ACTION_COLORS[trade.action] || MUTED;
  const dateStr = trade.executed_at || trade.created_at
    ? new Date(trade.executed_at || trade.created_at).toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'short',
      })
    : '—';
  const amount = trade.amount_zar != null
    ? `R${(trade.amount_zar / 100).toFixed(0)}`
    : trade.amount != null
    ? `R${parseFloat(trade.amount).toFixed(0)}`
    : '—';

  return (
    <View style={styles.tradeRow}>
      <View style={styles.tradeSeparator} />
      <View style={styles.tradeContent}>
        <Text style={styles.tradeDate}>{dateStr}</Text>
        <Text style={styles.tradeTicker}>{trade.ticker}</Text>
        <View style={[styles.actionBadge, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.actionText, { color }]}>{trade.action}</Text>
        </View>
        <Text style={styles.tradeAmount}>{amount}</Text>
        <Text style={[styles.tradeStatus, { color: trade.status === 'FILLED' ? GREEN : MUTED }]}>
          {trade.status || '—'}
        </Text>
      </View>
    </View>
  );
}

const FILTER_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'ETF', value: 'ETF' },
  { label: 'Share', value: 'Share' },
  { label: 'Crypto', value: 'Crypto' },
];

export default function HistoryScreen() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchTrades = useCallback(async () => {
    try {
      const params = filter ? `?type=${filter}` : '';
      const res = await fetch(`${API_URL}/api/trades${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTrades(Array.isArray(json) ? json : json.trades || []);
    } catch (e) {
      console.error('fetchTrades error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchTrades();
  }, [fetchTrades]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrades();
    setRefreshing(false);
  }, [fetchTrades]);

  // Compute weekly spend grouped by week_number, capped at 8 weeks
  const weeklyData = trades
    .reduce((acc, t) => {
      const weekNum = t.week_number ?? 0;
      const key = `W${weekNum}`;
      const existing = acc.find((d) => d.week === key);
      const amountRand = (t.amount_zar != null ? t.amount_zar / 100 : parseFloat(t.amount || 0));
      if (existing) {
        existing.amount += amountRand;
      } else {
        acc.push({ week: key, amount: amountRand, weekNum });
      }
      return acc;
    }, [])
    .sort((a, b) => a.weekNum - b.weekNum)
    .slice(-8);

  // Stats
  const wins = trades.filter(
    (t) => t.action === 'TAKE_PROFIT' || (t.action === 'SELL' && t.status === 'FILLED')
  ).length;
  const losses = trades.filter((t) => t.action === 'STOP_LOSS').length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} colors={[CYAN]} />
      }
    >
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="TOTAL TRADES" value={String(trades.length)} />
        <StatCard label="WINS / LOSSES" value={`${wins} / ${losses}`} valueColor={GREEN} />
        <StatCard label="WIN RATE" value={`${winRate}%`} valueColor={winRate >= 50 ? GREEN : RED} />
      </View>

      {/* Weekly bar chart */}
      <WeeklyChart data={weeklyData} />

      {/* Filter buttons */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterBtn, filter === opt.value && styles.filterBtnActive]}
            onPress={() => setFilter(opt.value)}
          >
            <Text style={[styles.filterText, filter === opt.value && styles.filterTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trade list header */}
      <Text style={styles.sectionHeader}>TRADE HISTORY ({trades.length})</Text>

      {/* Column labels */}
      {trades.length > 0 && (
        <View style={styles.columnHeader}>
          {['DATE', 'TICKER', 'ACTION', 'AMOUNT', 'STATUS'].map((h) => (
            <Text key={h} style={styles.columnHeaderText}>{h}</Text>
          ))}
        </View>
      )}

      {/* Trades */}
      {trades.length === 0 && !loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No trade history yet</Text>
          <Text style={styles.emptySubtitle}>
            Trades will appear here after the bot executes or logs an action.
          </Text>
        </View>
      ) : (
        trades.map((t, i) => <TradeRow key={t.id ?? i} trade={t} />)
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    alignItems: 'center',
  },
  statLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 8,
    letterSpacing: 0.8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 18,
    letterSpacing: 1,
  },
  chartCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
    alignItems: 'center',
  },
  noChartText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionHeader: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 16,
    letterSpacing: 2,
    color: TEXT,
    marginBottom: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffffff18',
    backgroundColor: CARD,
  },
  filterBtnActive: {
    borderColor: CYAN,
    backgroundColor: `${CYAN}15`,
  },
  filterText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
  },
  filterTextActive: {
    color: CYAN,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff0D',
    marginBottom: 2,
  },
  columnHeaderText: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 8,
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
  },
  tradeRow: {
    marginBottom: 2,
  },
  tradeSeparator: {
    height: 1,
    backgroundColor: '#ffffff08',
  },
  tradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tradeDate: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    flex: 1,
  },
  tradeTicker: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  actionBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flex: 1.2,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 8,
    letterSpacing: 0.3,
  },
  tradeAmount: {
    color: TEXT,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  tradeStatus: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    flex: 1,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    alignItems: 'center',
    marginTop: 8,
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
});

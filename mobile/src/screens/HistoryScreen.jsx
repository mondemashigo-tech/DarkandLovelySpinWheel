import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import { API_URL } from '../config';

const ACTION_COLORS = {
  BUY: '#4DFF9F',
  SELL: '#FF3D8A',
  HOLD: '#6B6B8A',
  WATCH: '#2EE8FF',
  STOP_LOSS: '#FF3D8A',
  TAKE_PROFIT: '#FFC83D',
};

function WeeklyChart({ data }) {
  if (!data.length) return null;
  const W = 300;
  const H = 120;
  const padL = 40;
  const padB = 28;
  const chartW = W - padL - 8;
  const chartH = H - padB - 8;
  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  const barW = Math.min(32, (chartW / data.length) - 4);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>WEEKLY SPEND</Text>
      <Svg width={W} height={H}>
        {/* Gridline at R300 budget */}
        <Line x1={padL} y1={8} x2={W - 8} y2={8} stroke="#FFC83D33" strokeWidth={1} strokeDasharray="4,4" />
        <SvgText x={padL - 4} y={12} fill="#6B6B8A" fontSize="9" textAnchor="end">R300</SvgText>
        {data.map((d, i) => {
          const barH = Math.max(2, (d.amount / maxVal) * chartH);
          const x = padL + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
          const y = H - padB - barH;
          const fill = d.amount >= 240 ? '#FF3D8A' : d.amount >= 150 ? '#FFC83D' : '#2EE8FF';
          return (
            <React.Fragment key={d.week}>
              <Rect x={x} y={y} width={barW} height={barH} fill={fill} rx={3} />
              <SvgText x={x + barW / 2} y={H - padB + 12} fill="#6B6B8A" fontSize="9" textAnchor="middle">{d.week}</SvgText>
              <SvgText x={x + barW / 2} y={y - 3} fill={fill} fontSize="8" textAnchor="middle">
                {d.amount > 0 ? `R${d.amount.toFixed(0)}` : ''}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

export default function HistoryScreen() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? `?type=${filter}` : '';
      const res = await fetch(`${API_URL}/api/trades${params}`);
      setTrades(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  const weeklyData = trades.reduce((acc, t) => {
    const key = `W${t.week_number}`;
    const ex = acc.find((d) => d.week === key);
    if (ex) ex.amount += (t.amount_zar || 0) / 100;
    else acc.push({ week: key, amount: (t.amount_zar || 0) / 100 });
    return acc;
  }, []).slice(-8);

  const wins = trades.filter((t) => t.action === 'TAKE_PROFIT' || (t.action === 'SELL' && t.status === 'FILLED')).length;
  const losses = trades.filter((t) => t.action === 'STOP_LOSS').length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const FILTERS = ['', 'ETF', 'Share', 'Crypto'];
  const FILTER_LABELS = ['All', 'ETF', 'Share', 'Crypto'];

  const renderTrade = ({ item: t }) => {
    const color = ACTION_COLORS[t.action] || '#6B6B8A';
    return (
      <View style={styles.tradeRow}>
        <Text style={styles.tradeDate}>{new Date(t.executed_at || t.created_at).toLocaleDateString('en-ZA')}</Text>
        <Text style={styles.tradeTicker}>{t.ticker}</Text>
        <View style={[styles.actionBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.actionText, { color }]}>{t.action}</Text>
        </View>
        <Text style={styles.tradeAmount}>R{((t.amount_zar || 0) / 100).toFixed(0)}</Text>
        <Text style={[styles.tradeSource, { color: t.source === 'SIMULATED' ? '#FFC83D' : t.source === 'AUTO' ? '#2EE8FF' : '#6B6B8A' }]}>
          {t.source}
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTrades} tintColor="#2EE8FF" />}
      ListHeaderComponent={() => (
        <>
          <View style={styles.statRow}>
            <StatCard label="Total Trades" value={String(trades.length)} color="#2EE8FF" />
            <View style={{ width: 8 }} />
            <StatCard label="Wins / Losses" value={`${wins} / ${losses}`} color="#4DFF9F" />
            <View style={{ width: 8 }} />
            <StatCard label="Win Rate" value={`${winRate}%`} color="#FFC83D" />
          </View>

          <WeeklyChart data={weeklyData} />

          <View style={styles.filterRow}>
            {FILTERS.map((f, i) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {FILTER_LABELS[i]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionHeader title="TRADE HISTORY" color="#2EE8FF" />

          <View style={styles.tableHeader}>
            {['Date', 'Ticker', 'Action', 'Amount', 'Source'].map((h) => (
              <Text key={h} style={styles.tableHeaderText}>{h}</Text>
            ))}
          </View>
        </>
      )}
      data={trades}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderTrade}
      ListEmptyComponent={() => (
        !loading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO TRADES YET</Text>
            <Text style={styles.emptySubText}>Trades will appear here after the bot executes or sends alerts.</Text>
          </View>
        )
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },
  content: { padding: 16, paddingBottom: 32 },
  statRow: { flexDirection: 'row', marginBottom: 12 },
  chartCard: { backgroundColor: '#12122A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ffffff0D', marginBottom: 12, alignItems: 'center' },
  chartTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 14, color: '#6B6B8A', letterSpacing: 2, alignSelf: 'flex-start', marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ffffff15', backgroundColor: '#12122A' },
  filterBtnActive: { borderColor: '#2EE8FF', backgroundColor: '#2EE8FF15' },
  filterText: { fontFamily: 'SyneMono_400Regular', fontSize: 11, color: '#6B6B8A' },
  filterTextActive: { color: '#2EE8FF' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4 },
  tableHeaderText: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', flex: 1, textAlign: 'center' },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#12122A', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#ffffff0D' },
  tradeDate: { color: '#6B6B8A', fontSize: 9, fontFamily: 'SyneMono_400Regular', flex: 1 },
  tradeTicker: { fontFamily: 'BebasNeue_400Regular', fontSize: 15, color: '#E8E4FF', flex: 1, textAlign: 'center' },
  actionBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flex: 1, alignItems: 'center' },
  actionText: { fontSize: 9, fontFamily: 'SyneMono_400Regular' },
  tradeAmount: { color: '#E8E4FF', fontSize: 11, fontFamily: 'SyneMono_400Regular', flex: 1, textAlign: 'right' },
  tradeSource: { fontSize: 9, fontFamily: 'SyneMono_400Regular', flex: 1, textAlign: 'right' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: '#6B6B8A' },
  emptySubText: { color: '#6B6B8A', fontSize: 12, fontFamily: 'SyneMono_400Regular', textAlign: 'center', marginTop: 8, lineHeight: 18 },
});

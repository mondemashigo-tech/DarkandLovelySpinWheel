import React, { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useApi } from '../hooks/useApi';
import { LoadingState, ErrorState, Badge, RefreshButton } from '../components/Shared';
import { C, S } from '../components/theme';

function typeColor(type) {
  return type === 'ETF' ? C.cyan : type === 'Crypto' ? C.orange : C.green;
}

function BuyCard({ signal }) {
  const tc = typeColor(signal.type);
  const ac = signal.action === 'BUY NOW' ? C.green : C.gold;
  const uc = signal.urgency === 'High' ? C.pink : signal.urgency === 'Medium' ? C.gold : C.cyan;
  const cc = signal.conviction === 'High' ? C.green : signal.conviction === 'Medium' ? C.gold : C.muted;

  return (
    <View style={S.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={[styles.row, { alignItems: 'center', marginBottom: 4 }]}>
            <Text style={[styles.ticker, { color: tc }]}>{signal.ticker}</Text>
            <Badge label={signal.type} color={tc} />
          </View>
          <Text style={styles.subtext}>{signal.name}</Text>
        </View>
        <Text style={[styles.amount, { color: C.gold }]}>R{signal.amount}</Text>
      </View>

      <View style={styles.badgeRow}>
        <Badge label={signal.action} color={ac} />
        {signal.limitPrice && <Badge label={`LIMIT @ ${signal.limitPrice}`} color={C.gold} />}
        <Badge label={`${signal.urgency} urgency`} color={uc} />
        <Badge label={`${signal.conviction} conviction`} color={cc} />
      </View>

      <View style={styles.reasonBox}>
        <Text style={styles.reasonText}>{signal.reason}</Text>
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const { data, loading, error, fetch } = useApi('/api/daily');
  const [called, setCalled] = useState(false);

  const load = () => { setCalled(true); fetch(); };

  if (!called) return (
    <View style={styles.container}>
      <View style={styles.promptBox}>
        <Text style={styles.promptLabel}>TODAY'S BUY SIGNALS</Text>
        <TouchableOpacity onPress={load} style={styles.genBtn}>
          <Text style={styles.genBtnText}>GENERATE SIGNALS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.container}><LoadingState message="Analysing JSE conditions…" /></View>;
  if (error) return <View style={styles.container}><ErrorState error={error} onRetry={fetch} /></View>;

  const sentColor = data?.sentiment === 'Bullish' ? C.green : data?.sentiment === 'Bearish' ? C.pink : C.gold;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Market overview card */}
      {data && (
        <View style={[S.card, { borderColor: `${sentColor}30` }]}>
          <View style={styles.row}>
            <View>
              <Text style={S.label}>MARKET SENTIMENT</Text>
              <Text style={{ color: sentColor, fontSize: 22, fontWeight: '800' }}>{data.sentiment}</Text>
            </View>
            <View style={styles.scoreBox}>
              <Text style={S.label}>DAY SCORE</Text>
              <Text style={{ color: sentColor, fontSize: 28, fontWeight: '900' }}>{data.dayScore}<Text style={{ fontSize: 14, color: C.muted }}>/10</Text></Text>
            </View>
          </View>
          {data.marketSummary && (
            <Text style={[styles.subtext, { marginTop: 8 }]}>{data.marketSummary}</Text>
          )}
        </View>
      )}

      {/* Signal cards */}
      {data?.signals?.map((s, i) => <BuyCard key={i} signal={s} />)}

      {/* Summary */}
      {data && (
        <View style={[S.card, { borderColor: `${C.gold}30`, backgroundColor: `${C.gold}08` }]}>
          <View style={styles.row}>
            <View>
              <Text style={S.label}>TOTAL TODAY</Text>
              <Text style={{ color: C.gold, fontSize: 28, fontWeight: '900' }}>
                R{data.totalZAR} <Text style={{ fontSize: 12, color: C.muted }}>/ R300</Text>
              </Text>
            </View>
            {data.avoid?.length > 0 && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[S.label, { color: C.pink }]}>AVOID</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {data.avoid.map((a, i) => <Badge key={i} label={a} color={C.pink} />)}
                </View>
              </View>
            )}
          </View>
          {data.note && (
            <Text style={[styles.subtext, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(232,228,255,0.06)' }]}>
              💡 {data.note}
            </Text>
          )}
        </View>
      )}

      <RefreshButton onPress={() => fetch(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ticker: { fontSize: 22, fontWeight: '900', marginRight: 8 },
  amount: { fontSize: 28, fontWeight: '900' },
  subtext: { fontSize: 12, color: C.muted, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 },
  reasonBox: { borderLeftWidth: 2, borderLeftColor: 'rgba(46,232,255,0.2)', paddingLeft: 10 },
  reasonText: { fontSize: 12, color: 'rgba(232,228,255,0.7)', lineHeight: 18 },
  scoreBox: { alignItems: 'flex-end' },
  promptBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  promptLabel: { color: C.dimmed, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20 },
  genBtn: {
    borderWidth: 1, borderColor: C.green, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 8, backgroundColor: `${C.green}0F`,
  },
  genBtnText: { color: C.green, fontWeight: '700', fontSize: 13, letterSpacing: 1.2 },
});

import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApi } from '../hooks/useApi';
import { LoadingState, ErrorState, Badge, RefreshButton } from '../components/Shared';
import { C, S } from '../components/theme';

const DAY_COLORS = {
  Monday: C.cyan, Tuesday: C.green, Wednesday: C.gold,
  Thursday: C.orange, Friday: C.pink,
};

function WeekBuyCard({ buy }) {
  const tc = buy.type === 'ETF' ? C.cyan : buy.type === 'Crypto' ? C.orange : C.green;
  const dc = DAY_COLORS[buy.bestDay] || C.cyan;
  const cc = buy.conviction === 'High' ? C.green : buy.conviction === 'Medium' ? C.gold : C.muted;

  return (
    <View style={S.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={[styles.row, { alignItems: 'center', marginBottom: 4 }]}>
            <Text style={[styles.ticker, { color: tc }]}>{buy.ticker}</Text>
            <Badge label={buy.type} color={tc} />
          </View>
          <Text style={styles.sub}>{buy.name}</Text>
        </View>
        <Text style={[styles.amount, { color: C.gold }]}>R{buy.amount}</Text>
      </View>

      <View style={[styles.row, { marginVertical: 8 }]}>
        <Badge label={`BUY ${buy.bestDay?.toUpperCase()}`} color={dc} />
        <Badge label={`${buy.conviction} conviction`} color={cc} />
      </View>

      <View style={styles.boxes}>
        <View style={[styles.box, { borderColor: `${C.green}35`, backgroundColor: `${C.green}0A` }]}>
          <Text style={[styles.boxLabel, { color: C.green }]}>TARGET</Text>
          <Text style={[styles.boxValue, { color: C.green }]}>{buy.priceTarget}</Text>
        </View>
        <View style={[styles.box, { borderColor: `${C.pink}35`, backgroundColor: `${C.pink}0A` }]}>
          <Text style={[styles.boxLabel, { color: C.pink }]}>STOP LOSS</Text>
          <Text style={[styles.boxValue, { color: C.pink }]}>{buy.stopLoss}</Text>
        </View>
      </View>
      <View style={[styles.box, { borderColor: `${C.orange}35`, backgroundColor: `${C.orange}0A`, marginTop: 6 }]}>
        <Text style={[styles.boxLabel, { color: C.orange }]}>⚠ CEILING SIGNAL</Text>
        <Text style={{ color: C.orange, fontSize: 11, lineHeight: 16 }}>{buy.ceilingSignal}</Text>
      </View>
    </View>
  );
}

function DaySchedule({ schedule }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return (
    <View style={S.card}>
      <Text style={[S.label, { marginBottom: 12 }]}>WEEK SCHEDULE</Text>
      {days.map(day => (
        <View key={day} style={[styles.row, { marginBottom: 10, alignItems: 'flex-start' }]}>
          <View style={[styles.dayBadge, { backgroundColor: `${DAY_COLORS[day]}18`, borderColor: `${DAY_COLORS[day]}40` }]}>
            <Text style={{ color: DAY_COLORS[day], fontSize: 10, fontWeight: '700' }}>{day.slice(0, 3).toUpperCase()}</Text>
          </View>
          <Text style={[styles.sub, { flex: 1, marginLeft: 10 }]}>{schedule[day]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function WeekScreen() {
  const { data, loading, error, fetch } = useApi('/api/weekly');
  const [called, setCalled] = useState(false);

  const load = () => { setCalled(true); fetch(); };

  if (!called) return (
    <View style={styles.container}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.promptLabel}>THIS WEEK'S INVESTMENT PLAN</Text>
        <TouchableOpacity onPress={load} style={[styles.genBtn, { borderColor: C.gold, backgroundColor: `${C.gold}0F` }]}>
          <Text style={[styles.genBtnText, { color: C.gold }]}>GENERATE WEEK PLAN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.container}><LoadingState message="Strategising week plan…" /></View>;
  if (error) return <View style={styles.container}><ErrorState error={error} onRetry={fetch} /></View>;

  const riskColor = data?.riskLevel === 'High' ? C.pink : data?.riskLevel === 'Medium' ? C.gold : C.green;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {data && (
        <View style={[S.card, { borderColor: `${C.gold}30`, backgroundColor: `${C.gold}05` }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={S.label}>WEEK {data.weekNumber} THEME</Text>
              <Text style={[styles.sub, { color: C.text }]}>{data.theme}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={S.label}>RISK</Text>
              <Text style={{ color: riskColor, fontSize: 16, fontWeight: '800' }}>{data.riskLevel}</Text>
              <Text style={S.label}>RETURN</Text>
              <Text style={{ color: C.green, fontSize: 16, fontWeight: '800' }}>{data.projectedReturn}</Text>
            </View>
          </View>
          {data.weekGoal && (
            <Text style={[styles.sub, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(232,228,255,0.06)' }]}>
              🎯 {data.weekGoal}
            </Text>
          )}
        </View>
      )}

      {data?.buys?.map((buy, i) => <WeekBuyCard key={i} buy={buy} />)}

      {data?.reservePlan && (
        <View style={[S.card, { borderColor: `${C.cyan}30` }]}>
          <Text style={[S.label, { color: C.cyan }]}>RESERVE — R30</Text>
          <Text style={styles.sub}>{data.reservePlan}</Text>
        </View>
      )}

      {data?.schedule && <DaySchedule schedule={data.schedule} />}

      <RefreshButton onPress={() => fetch(true)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ticker: { fontSize: 22, fontWeight: '900', marginRight: 8 },
  amount: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 12, color: C.muted, lineHeight: 18 },
  boxes: { flexDirection: 'row', gap: 6 },
  box: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 8 },
  boxLabel: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3, fontWeight: '700' },
  boxValue: { fontSize: 13, fontWeight: '800' },
  dayBadge: {
    borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, minWidth: 40, alignItems: 'center',
  },
  promptLabel: { color: C.muted, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20 },
  genBtn: { borderWidth: 1, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 },
  genBtnText: { fontWeight: '700', fontSize: 13, letterSpacing: 1.2 },
});

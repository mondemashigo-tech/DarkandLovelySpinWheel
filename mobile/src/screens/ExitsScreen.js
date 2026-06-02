import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useApi } from '../hooks/useApi';
import { LoadingState, ErrorState, EmptyState, Badge, RefreshButton } from '../components/Shared';
import { C, S } from '../components/theme';

const SIGNAL_CFG = {
  'HOLD':        { color: C.green,  border: `${C.green}35` },
  'WATCH':       { color: C.gold,   border: `${C.gold}35`  },
  'TAKE PROFIT': { color: C.orange, border: `${C.orange}35`},
  'EXIT NOW':    { color: C.pink,   border: `${C.pink}35`  },
};

function ExitCard({ pos }) {
  const cfg = SIGNAL_CFG[pos.signal] || SIGNAL_CFG['HOLD'];
  const uc = pos.urgency === 'High' ? C.pink : pos.urgency === 'Medium' ? C.gold : C.green;

  return (
    <View style={[S.card, { borderColor: cfg.border }]}>
      <View style={styles.row}>
        <Text style={[styles.ticker, { color: cfg.color }]}>{pos.ticker}</Text>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.signalBadge, { backgroundColor: `${cfg.color}12`, borderColor: `${cfg.color}50` }]}>
            <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 }}>{pos.signal}</Text>
          </View>
          <Badge label={`${pos.urgency} urgency`} color={uc} />
        </View>
      </View>

      {/* Ceiling */}
      <View style={[styles.infoBox, { borderColor: `${C.orange}25`, backgroundColor: `${C.orange}07` }]}>
        <Text style={[styles.boxLabel, { color: C.orange }]}>⚠ CEILING ASSESSMENT</Text>
        <Text style={styles.sub}>{pos.ceilingAssessment}</Text>
      </View>

      {/* Action */}
      <View style={[styles.infoBox, { borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}07` }]}>
        <Text style={[styles.boxLabel, { color: cfg.color }]}>ACTION</Text>
        <Text style={{ color: C.text, fontSize: 12, lineHeight: 18, fontWeight: '600' }}>{pos.action}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.halfBox]}>
          <Text style={styles.boxLabel}>EXIT TARGET</Text>
          <Text style={styles.sub}>{pos.exitTarget}</Text>
        </View>
        <View style={[styles.halfBox, { marginLeft: 6 }]}>
          <Text style={[styles.boxLabel, { color: C.cyan }]}>REINVEST IN</Text>
          <Text style={[styles.sub, { color: C.cyan }]}>{pos.reinvestSuggestion}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ExitsScreen() {
  const { data, loading, error, fetch } = useApi('/api/exits');
  const [called, setCalled] = useState(false);

  const load = () => { setCalled(true); fetch(); };

  if (!called) return (
    <View style={styles.container}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.promptLabel}>EXIT SIGNAL ANALYSIS</Text>
        <TouchableOpacity onPress={load} style={[styles.genBtn, { borderColor: C.pink, backgroundColor: `${C.pink}0F` }]}>
          <Text style={[styles.genBtnText, { color: C.pink }]}>ANALYSE POSITIONS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.container}><LoadingState message="Analysing open positions…" /></View>;
  if (error) return <View style={styles.container}><ErrorState error={error} onRetry={fetch} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {data?.positions?.length === 0
        ? <EmptyState message="No open positions to analyse" hint="Log trades in the LOG tab first" />
        : data?.positions?.map((pos, i) => <ExitCard key={i} pos={pos} />)
      }
      {data?.healthNote && (
        <View style={[S.card, { borderColor: `${C.cyan}30`, backgroundColor: `${C.cyan}05` }]}>
          <Text style={[S.label, { color: C.cyan }]}>PORTFOLIO HEALTH</Text>
          <Text style={styles.sub}>{data.healthNote}</Text>
        </View>
      )}
      <RefreshButton onPress={() => fetch(true)} label="REFRESH ANALYSIS (bypass cache)" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  ticker: { fontSize: 24, fontWeight: '900' },
  sub: { fontSize: 12, color: C.muted, lineHeight: 18 },
  infoBox: { borderWidth: 1, borderRadius: 6, padding: 10, marginBottom: 8 },
  halfBox: { flex: 1, borderWidth: 1, borderColor: 'rgba(232,228,255,0.07)', borderRadius: 6, padding: 8 },
  boxLabel: { fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted, marginBottom: 4, fontWeight: '700' },
  signalBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 5, borderWidth: 1 },
  promptLabel: { color: C.muted, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20 },
  genBtn: { borderWidth: 1, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 },
  genBtnText: { fontWeight: '700', fontSize: 13, letterSpacing: 1.2 },
});

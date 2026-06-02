import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { apiFetch } from '../api';
import { LoadingState, EmptyState } from '../components/Shared';
import { C, S } from '../components/theme';

const TOTAL_WEEKS = 17;
const WEEKLY = 300;
const START = new Date('2026-06-02');

function currentWeek() {
  const ms = new Date() - START;
  return Math.max(1, Math.min(Math.floor(ms / (7 * 86400000)) + 1, TOTAL_WEEKS));
}

function compound(invested, weeklyAdd, weeks, rate = 0.02) {
  let t = invested;
  for (let i = 0; i < weeks; i++) t = (t + weeklyAdd) * (1 + rate);
  return t.toFixed(2);
}

function ProgressBar({ pct, color }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function PortfolioScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const week = currentWeek();
  const weeksLeft = TOTAL_WEEKS - week;
  const progress = ((week - 1) / (TOTAL_WEEKS - 1)) * 100;

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiFetch('/api/portfolio');
      setData(d);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <View style={styles.container}><LoadingState message="Loading portfolio…" /></View>;

  const positions = data?.positions || [];
  const invested = data?.totalInvested || 0;
  const byType = { ETF: 0, Share: 0, Crypto: 0 };
  positions.forEach(p => { if (byType[p.type] !== undefined) byType[p.type] += p.invested; });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* 17-week progress */}
      <View style={[S.card, { borderColor: `${C.gold}30`, backgroundColor: `${C.gold}04` }]}>
        <View style={styles.row}>
          <Text style={S.label}>17-WEEK CHALLENGE</Text>
          <Text style={{ color: C.gold, fontWeight: '800', fontSize: 14 }}>Week {week} / {TOTAL_WEEKS}</Text>
        </View>
        <ProgressBar pct={progress} color={C.gold} />
        <View style={[styles.row, { marginTop: 12 }]}>
          {[['INVESTED', `R${invested.toFixed(0)}`, C.gold], ['BUDGET', `R${TOTAL_WEEKS * WEEKLY}`, C.cyan], ['WEEKS LEFT', weeksLeft, C.green]].map(([l, v, c]) => (
            <View key={l} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={S.label}>{l}</Text>
              <Text style={{ color: c, fontSize: 20, fontWeight: '900' }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Allocation */}
      {invested > 0 && (
        <View style={S.card}>
          <Text style={[S.label, { marginBottom: 12 }]}>ALLOCATION BREAKDOWN</Text>
          {[['ETFs', byType.ETF, C.cyan], ['Shares', byType.Share, C.green], ['Crypto', byType.Crypto, C.orange]].map(([l, v, c]) => (
            <View key={l} style={{ marginBottom: 10 }}>
              <View style={styles.row}>
                <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{l}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>R{v.toFixed(0)}</Text>
              </View>
              <ProgressBar pct={invested > 0 ? (v / invested) * 100 : 0} color={c} />
            </View>
          ))}
        </View>
      )}

      {/* Compound projections */}
      <View style={S.card}>
        <Text style={[S.label, { marginBottom: 12 }]}>COMPOUND PROJECTIONS (2%/wk)</Text>
        <View style={styles.row}>
          {[4, 8, weeksLeft].map(w => (
            <View key={w} style={styles.projBox}>
              <Text style={S.label}>{w}W</Text>
              <Text style={{ color: C.green, fontSize: 18, fontWeight: '900' }}>R{compound(invested, WEEKLY, w)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Positions */}
      {positions.length === 0
        ? <EmptyState message="No open positions yet" hint="Log your first trade in the LOG tab" />
        : <>
            <Text style={[S.label, { paddingHorizontal: 4, marginBottom: 8 }]}>OPEN POSITIONS ({positions.length})</Text>
            {positions.map((pos) => {
              const tc = pos.type === 'ETF' ? C.cyan : pos.type === 'Crypto' ? C.orange : C.green;
              const wh = week - pos.entryWeek;
              return (
                <View key={pos.ticker} style={S.card}>
                  <View style={styles.row}>
                    <View>
                      <Text style={{ color: tc, fontSize: 20, fontWeight: '900' }}>{pos.ticker}</Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{pos.entryDate} · W{pos.entryWeek} · {wh}w held</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: C.gold, fontSize: 22, fontWeight: '900' }}>R{pos.invested.toFixed(2)}</Text>
                      <Text style={{ color: C.muted, fontSize: 10 }}>invested</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
      }

      <TouchableOpacity onPress={load} style={styles.refreshBtn}>
        <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>REFRESH PORTFOLIO</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(232,228,255,0.08)', marginTop: 8, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
  projBox:  { flex: 1, borderWidth: 1, borderColor: 'rgba(46,232,255,0.1)', borderRadius: 8, padding: 10, marginHorizontal: 3, backgroundColor: `${C.cyan}06`, alignItems: 'center' },
  refreshBtn: { borderWidth: 1, borderColor: 'rgba(46,232,255,0.15)', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8, marginBottom: 24 },
});

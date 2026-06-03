import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BudgetBar({ budget }) {
  if (!budget) return <Text style={styles.loading}>Loading budget...</Text>;

  const spent = budget.spent_zar / 100;
  const total = budget.budget_zar / 100;
  const pct = Math.min(100, total > 0 ? (spent / total) * 100 : 0);
  const fillColor = pct > 80 ? '#FF3D8A' : pct > 60 ? '#FFC83D' : '#4DFF9F';

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Weekly Budget</Text>
        <Text style={styles.value}>R{spent.toFixed(0)} / R{total.toFixed(0)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={styles.remaining}>R{(total - spent).toFixed(0)} remaining</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { color: '#6B6B8A', fontSize: 12, fontFamily: 'SyneMono_400Regular' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#6B6B8A', fontSize: 12, fontFamily: 'SyneMono_400Regular' },
  value: { color: '#E8E4FF', fontSize: 12, fontFamily: 'SyneMono_400Regular' },
  track: { height: 6, backgroundColor: '#0D0D1A', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  remaining: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', marginTop: 3 },
});

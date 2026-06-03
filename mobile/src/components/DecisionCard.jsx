import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ACTION_COLORS = {
  BUY: { bg: '#4DFF9F22', border: '#4DFF9F', text: '#4DFF9F' },
  SELL: { bg: '#FF3D8A22', border: '#FF3D8A', text: '#FF3D8A' },
  HOLD: { bg: '#6B6B8A22', border: '#6B6B8A', text: '#6B6B8A' },
  WATCH: { bg: '#2EE8FF22', border: '#2EE8FF', text: '#2EE8FF' },
  STOP_LOSS: { bg: '#FF3D8A22', border: '#FF3D8A', text: '#FF3D8A' },
  TAKE_PROFIT: { bg: '#FFC83D22', border: '#FFC83D', text: '#FFC83D' },
};

const CONF_WIDTHS = { High: '100%', Medium: '66%', Low: '33%' };
const CONF_COLORS = { High: '#4DFF9F', Medium: '#FFC83D', Low: '#FF3D8A' };

export default function DecisionCard({ decision }) {
  const ac = ACTION_COLORS[decision.action] || ACTION_COLORS.HOLD;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.ticker}>{decision.ticker}</Text>
        <View style={styles.rightRow}>
          <Text style={styles.assetType}>{decision.asset}</Text>
          <View style={[styles.badge, { backgroundColor: ac.bg, borderColor: ac.border }]}>
            <Text style={[styles.badgeText, { color: ac.text }]}>{decision.action}</Text>
          </View>
        </View>
      </View>

      {decision.amount > 0 && (
        <Text style={styles.amount}>R{decision.amount}</Text>
      )}

      <Text style={styles.reason}>{decision.reason}</Text>

      <View style={styles.confRow}>
        <Text style={styles.confLabel}>Confidence:</Text>
        <View style={styles.confTrack}>
          <View style={[styles.confFill, { width: CONF_WIDTHS[decision.confidence], backgroundColor: CONF_COLORS[decision.confidence] }]} />
        </View>
        <Text style={styles.confLabel}>{decision.confidence}</Text>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.meta}>⏱ {decision.urgency}</Text>
        {decision.stopLoss != null && <Text style={styles.meta}>SL: R{Number(decision.stopLoss).toFixed(2)}</Text>}
      </View>

      {decision.asset !== 'Crypto' ? (
        <View style={styles.jseAlert}>
          <Text style={styles.jseAlertText}>⚠ Manual Action Required — EasyEquities</Text>
        </View>
      ) : (
        <View style={styles.cryptoAlert}>
          <Text style={styles.cryptoAlertText}>⚡ Auto-Executing on VALR</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#12122A', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#ffffff0D' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticker: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: '#E8E4FF' },
  assetType: { fontSize: 10, color: '#6B6B8A', fontFamily: 'SyneMono_400Regular' },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: 'BebasNeue_400Regular', fontSize: 13, letterSpacing: 0.5 },
  amount: { fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: '#FFC83D', marginBottom: 4 },
  reason: { fontSize: 12, color: '#6B6B8A', fontFamily: 'SyneMono_400Regular', marginBottom: 8, lineHeight: 17 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confLabel: { fontSize: 10, color: '#6B6B8A', fontFamily: 'SyneMono_400Regular', width: 70 },
  confTrack: { flex: 1, height: 4, backgroundColor: '#1A1A2E', borderRadius: 2, overflow: 'hidden' },
  confFill: { height: 4, borderRadius: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 10, color: '#6B6B8A', fontFamily: 'SyneMono_400Regular' },
  jseAlert: { marginTop: 8, backgroundColor: '#FFC83D11', borderWidth: 1, borderColor: '#FFC83D33', borderRadius: 6, padding: 6 },
  jseAlertText: { color: '#FFC83D', fontSize: 11, fontFamily: 'SyneMono_400Regular', textAlign: 'center' },
  cryptoAlert: { marginTop: 8, backgroundColor: '#2EE8FF11', borderWidth: 1, borderColor: '#2EE8FF33', borderRadius: 6, padding: 6 },
  cryptoAlertText: { color: '#2EE8FF', fontSize: 11, fontFamily: 'SyneMono_400Regular', textAlign: 'center' },
});

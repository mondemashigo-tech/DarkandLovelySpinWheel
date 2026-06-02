import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { C } from './theme';

export function LoadingState({ message = 'Fetching signals…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.cyan} />
      <Text style={[styles.msg, { color: C.cyan }]}>{message}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
      <Text style={{ color: C.pink, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
          <Text style={{ color: C.pink, fontSize: 11, letterSpacing: 1 }}>RETRY</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function EmptyState({ message, hint }) {
  return (
    <View style={styles.center}>
      <Text style={{ color: C.dimmed, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>{message}</Text>
      {hint && <Text style={{ color: C.cyan, fontSize: 11, marginTop: 8, textAlign: 'center' }}>{hint}</Text>}
    </View>
  );
}

export function Badge({ label, color, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg || `${color}18`, borderColor: `${color}50` }]}>
      <Text style={{ color, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

export function RefreshButton({ onPress, label = 'REFRESH (bypass cache)' }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.refreshBtn}>
      <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  msg: { marginTop: 12, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  retryBtn: {
    borderWidth: 1, borderColor: C.pink, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, marginRight: 6, marginBottom: 4,
  },
  refreshBtn: {
    borderWidth: 1, borderColor: 'rgba(46,232,255,0.15)',
    borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8, marginBottom: 24,
  },
});

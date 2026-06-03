import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatCard({ label, value, color = '#E8E4FF', small = false }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color, fontSize: small ? 18 : 24 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#12122A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ffffff0D', alignItems: 'center' },
  label: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', marginBottom: 4, textAlign: 'center' },
  value: { fontFamily: 'BebasNeue_400Regular', letterSpacing: 0.5, textAlign: 'center' },
});

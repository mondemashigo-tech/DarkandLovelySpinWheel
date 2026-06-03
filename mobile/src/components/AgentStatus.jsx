import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

export default function AgentStatus({ paused, emergencyStop, lastScan }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!paused && !emergencyStop) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [paused, emergencyStop]);

  const label = emergencyStop ? 'STOPPED' : paused ? 'PAUSED' : 'SCANNING';
  const dotColor = emergencyStop ? '#FF3D8A' : paused ? '#FFC83D' : '#4DFF9F';
  const labelColor = emergencyStop ? '#FF3D8A' : paused ? '#FFC83D' : '#4DFF9F';

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: (!paused && !emergencyStop) ? pulse : 1 }]} />
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      {lastScan && (
        <Text style={styles.sub}>Last: {new Date(lastScan).toLocaleTimeString()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: 'BebasNeue_400Regular', fontSize: 18, letterSpacing: 1 },
  sub: { color: '#6B6B8A', fontSize: 11, fontFamily: 'SyneMono_400Regular', marginLeft: 8 },
});

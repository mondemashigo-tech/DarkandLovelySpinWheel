import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export default function FearGreedGauge({ score = 50, label = 'Neutral' }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color =
    clampedScore < 20 ? '#FF3D8A' :
    clampedScore < 40 ? '#FF8C00' :
    clampedScore < 60 ? '#FFC83D' :
    clampedScore < 80 ? '#2EE8FF' : '#4DFF9F';

  // Gauge spans 180 degrees (from 180 to 360 in our coordinate system)
  const fillEnd = 180 + (clampedScore / 100) * 180;
  const needle = polarToCartesian(100, 100, 65, 180 + (clampedScore / 100) * 180 - 90);

  return (
    <View style={styles.container}>
      <Svg width={200} height={120} viewBox="0 0 200 120">
        {/* Background arc */}
        <Path d={arcPath(100, 100, 75, 180, 360)} fill="none" stroke="#1A1A2E" strokeWidth={18} />
        {/* Filled arc */}
        <Path d={arcPath(100, 100, 75, 180, fillEnd)} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" />
        {/* Needle */}
        <Line x1="100" y1="100" x2={needle.x.toFixed(1)} y2={needle.y.toFixed(1)} stroke="#E8E4FF" strokeWidth={2} strokeLinecap="round" />
        <Circle cx="100" cy="100" r="5" fill="#E8E4FF" />
        {/* Score */}
        <SvgText x="100" y="82" textAnchor="middle" fill={color} fontSize="26" fontWeight="bold">{Math.round(clampedScore)}</SvgText>
      </Svg>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  label: { fontFamily: 'BebasNeue_400Regular', fontSize: 16, letterSpacing: 1, marginTop: 4 },
});

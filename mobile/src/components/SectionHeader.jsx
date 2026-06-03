import React from 'react';
import { Text, StyleSheet } from 'react-native';

export default function SectionHeader({ title, color = '#6B6B8A' }) {
  return <Text style={[styles.text, { color }]}>{title}</Text>;
}

const styles = StyleSheet.create({
  text: { fontFamily: 'BebasNeue_400Regular', fontSize: 16, letterSpacing: 2, marginBottom: 10, marginTop: 6 },
});

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, Linking, TextInput } from 'react-native';
import { useApi } from '../hooks/useApi';
import { useBudget } from '../hooks/useBudget';
import { useApiUrl } from '../context/ApiUrlContext';

function Row({ label, right, onPress }) {
  const Inner = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress}>{Inner}</TouchableOpacity>;
  return Inner;
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { apiUrl, updateApiUrl } = useApiUrl();
  const { data: status, refetch: refetchStatus } = useApi('/api/status', 30000);
  const { budget } = useBudget();
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [urlDraft, setUrlDraft] = useState(apiUrl);
  const [urlSaved, setUrlSaved] = useState(false);

  const saveUrl = useCallback(async () => {
    if (!urlDraft.startsWith('http')) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }
    await updateApiUrl(urlDraft);
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  }, [urlDraft, updateApiUrl]);

  const toggleAgent = useCallback(async () => {
    const endpoint = status?.paused ? 'resume' : 'pause';
    try {
      await fetch(`${apiUrl}/api/agent/${endpoint}`, { method: 'POST' });
      await refetchStatus();
      Alert.alert('Done', status?.paused ? 'Agent resumed.' : 'Agent paused.');
    } catch {
      Alert.alert('Error', `Could not reach server at:\n${apiUrl}`);
    }
  }, [status, refetchStatus, apiUrl]);

  const triggerScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch(`${apiUrl}/api/agent/scan`, { method: 'POST' });
      Alert.alert('Scan Triggered', 'Check the Live Feed tab in ~30 seconds for results.');
    } catch {
      Alert.alert('Error', `Could not reach server at:\n${apiUrl}\n\nIs node server/index.js running?`);
    } finally {
      setTimeout(() => setScanning(false), 3000);
    }
  }, [apiUrl]);

  const checkServer = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${apiUrl}/health`);
      const data = await res.json();
      Alert.alert('Server OK ✓', `Connected to:\n${apiUrl}\n\nStatus: ${data.status}`);
    } catch {
      Alert.alert('Server Unreachable ✗', `Could not connect to:\n${apiUrl}\n\n• Make sure node server/index.js is running on your PC\n• Check your phone and PC are on the same WiFi\n• Verify the IP in Server URL below`);
    } finally {
      setChecking(false);
    }
  }, [apiUrl]);

  const showTelegramHelp = () => {
    Alert.alert(
      'Set Up Telegram Bot',
      '1. Open Telegram → search @BotFather\n2. Send /newbot and follow prompts\n3. Copy the bot token to TELEGRAM_BOT_TOKEN in .env\n4. Start a chat with your bot\n5. Visit api.telegram.org/bot{TOKEN}/getUpdates to get your chat ID\n6. Copy chat ID to TELEGRAM_CHAT_ID in .env',
      [{ text: 'OK' }]
    );
  };

  const agentPaused = status?.paused;
  const emergencyStop = status?.emergencyStop;
  const agentLabel = emergencyStop ? 'STOPPED' : agentPaused ? 'PAUSED' : 'RUNNING';
  const agentColor = emergencyStop ? '#FF3D8A' : agentPaused ? '#FFC83D' : '#4DFF9F';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Section title="AGENT CONTROL">
        <Row label="Agent Status" right={
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: agentColor }]}>{agentLabel}</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, { borderColor: agentPaused ? '#4DFF9F44' : '#FF3D8A44', backgroundColor: agentPaused ? '#4DFF9F11' : '#FF3D8A11' }]}
              onPress={toggleAgent}
            >
              <Text style={[styles.toggleBtnText, { color: agentPaused ? '#4DFF9F' : '#FF3D8A' }]}>
                {agentPaused ? 'RESUME' : 'PAUSE'}
              </Text>
            </TouchableOpacity>
          </View>
        } />
        <Row label="Paper Trading" right={
          <Text style={[styles.chip, { color: '#FFC83D' }]}>Check .env → PAPER_TRADING</Text>
        } />
        <Row label="Weekly Budget" right={
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.bigValue, { color: '#2EE8FF' }]}>R300 / week</Text>
            {budget && (
              <Text style={styles.subValue}>
                Spent R{(budget.spent_zar / 100).toFixed(0)}  ·  Left R{(budget.remaining_zar / 100).toFixed(0)}
              </Text>
            )}
          </View>
        } />
      </Section>

      <Section title="ACTIONS">
        <Row label="Trigger Manual Scan" right={
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#2EE8FF44' }]} onPress={triggerScan} disabled={scanning}>
            <Text style={[styles.actionBtnText, { color: '#2EE8FF' }]}>{scanning ? 'SCANNING...' : 'SCAN NOW'}</Text>
          </TouchableOpacity>
        } />
        <Row label="Check Server Connection" right={
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#ffffff20' }]} onPress={checkServer} disabled={checking}>
            <Text style={[styles.actionBtnText, { color: '#6B6B8A' }]}>{checking ? 'CHECKING...' : 'CHECK'}</Text>
          </TouchableOpacity>
        } />
      </Section>

      <Section title="POSITION SIZE LIMITS">
        <View style={styles.limitsRow}>
          {[{ label: 'ETF', max: 'R120', color: '#2EE8FF' }, { label: 'Share', max: 'R90', color: '#FFC83D' }, { label: 'Crypto', max: 'R60', color: '#4DFF9F' }].map((item) => (
            <View key={item.label} style={styles.limitCard}>
              <Text style={styles.limitLabel}>{item.label}</Text>
              <Text style={[styles.limitValue, { color: item.color }]}>{item.max}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="RISK RULES">
        {[
          { rule: 'Stop-Loss', value: '−8%', color: '#FF3D8A' },
          { rule: 'Take-Profit Flag', value: '+15%', color: '#4DFF9F' },
          { rule: 'Max Open Positions', value: '6', color: '#E8E4FF' },
          { rule: 'Pre-close Blackout', value: '30min before 17:00', color: '#FFC83D' },
          { rule: 'Budget Reset', value: 'Monday 07:00 SAST', color: '#6B6B8A' },
        ].map((item) => (
          <Row key={item.rule} label={item.rule} right={
            <Text style={[styles.ruleValue, { color: item.color }]}>{item.value}</Text>
          } />
        ))}
      </Section>

      <Section title="GET API KEYS">
        {[
          { label: 'VALR API Key', url: 'https://www.valr.com', subtitle: 'Account → API Keys → Trade permission' },
          { label: 'Telegram Bot', url: null, subtitle: 'Tap for setup instructions' },
          { label: 'NewsAPI Key', url: 'https://newsapi.org', subtitle: 'Free tier — register at newsapi.org' },
          { label: 'Anthropic Key', url: 'https://console.anthropic.com', subtitle: 'console.anthropic.com → API Keys' },
        ].map((item) => (
          <Row
            key={item.label}
            label={item.label}
            onPress={() => item.url ? Linking.openURL(item.url) : showTelegramHelp()}
            right={
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.linkText}>→ Open</Text>
                <Text style={styles.subValue}>{item.subtitle}</Text>
              </View>
            }
          />
        ))}
      </Section>

      <Section title="SERVER CONNECTION">
        <View style={styles.urlBlock}>
          <Text style={styles.urlLabel}>Backend Server URL</Text>
          <Text style={styles.urlHint}>
            Run {`ipconfig`} on your PC → WiFi IPv4 address{'\n'}
            Format: http://192.168.x.x:3001
          </Text>
          <View style={styles.urlInputRow}>
            <TextInput
              style={styles.urlInput}
              value={urlDraft}
              onChangeText={setUrlDraft}
              placeholder="http://192.168.0.100:3001"
              placeholderTextColor="#6B6B8A"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.saveBtn, urlSaved && styles.saveBtnDone]}
              onPress={saveUrl}
            >
              <Text style={[styles.saveBtnText, urlSaved && { color: '#4DFF9F' }]}>
                {urlSaved ? 'SAVED ✓' : 'SAVE'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activeUrlRow}>
            <Text style={styles.activeUrlLabel}>Active: </Text>
            <Text style={styles.activeUrlValue} numberOfLines={1}>{apiUrl}</Text>
          </View>
        </View>
      </Section>

      <Text style={styles.version}>R300 Trade Bot  ·  v1.0.0  ·  Expo SDK 51</Text>
      <Text style={styles.disclaimer}>Not financial advice. Always start with PAPER_TRADING=true.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080810' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'BebasNeue_400Regular', fontSize: 16, color: '#E8E4FF', letterSpacing: 2, marginBottom: 8 },
  sectionCard: { backgroundColor: '#12122A', borderRadius: 12, borderWidth: 1, borderColor: '#ffffff0D', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#ffffff08' },
  rowLabel: { color: '#E8E4FF', fontSize: 13, fontFamily: 'SyneMono_400Regular', flex: 1 },
  rowRight: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '55%' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLabel: { fontFamily: 'BebasNeue_400Regular', fontSize: 16 },
  toggleBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  toggleBtnText: { fontFamily: 'BebasNeue_400Regular', fontSize: 13 },
  actionBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnText: { fontFamily: 'BebasNeue_400Regular', fontSize: 13 },
  bigValue: { fontFamily: 'BebasNeue_400Regular', fontSize: 18 },
  subValue: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', textAlign: 'right' },
  chip: { fontSize: 11, fontFamily: 'SyneMono_400Regular' },
  ruleValue: { fontFamily: 'BebasNeue_400Regular', fontSize: 16 },
  linkText: { color: '#2EE8FF', fontSize: 12, fontFamily: 'SyneMono_400Regular' },
  limitsRow: { flexDirection: 'row', padding: 14, gap: 8 },
  limitCard: { flex: 1, backgroundColor: '#0D0D1A', borderRadius: 8, padding: 10, alignItems: 'center' },
  limitLabel: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', marginBottom: 4 },
  limitValue: { fontFamily: 'BebasNeue_400Regular', fontSize: 22 },
  urlBlock: { padding: 14 },
  urlLabel: { color: '#E8E4FF', fontSize: 13, fontFamily: 'SyneMono_400Regular', marginBottom: 4 },
  urlHint: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', lineHeight: 16, marginBottom: 10 },
  urlInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  urlInput: {
    flex: 1,
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#2EE8FF44',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8E4FF',
    fontSize: 12,
    fontFamily: 'SyneMono_400Regular',
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: '#2EE8FF44',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  saveBtnDone: { borderColor: '#4DFF9F44' },
  saveBtnText: { fontFamily: 'BebasNeue_400Regular', fontSize: 14, color: '#2EE8FF' },
  activeUrlRow: { flexDirection: 'row', alignItems: 'center' },
  activeUrlLabel: { color: '#6B6B8A', fontSize: 10, fontFamily: 'SyneMono_400Regular' },
  activeUrlValue: { color: '#2EE8FF', fontSize: 10, fontFamily: 'SyneMono_400Regular', flex: 1 },
  version: { textAlign: 'center', color: '#6B6B8A', fontSize: 11, fontFamily: 'SyneMono_400Regular', marginTop: 8 },
  disclaimer: { textAlign: 'center', color: '#FF3D8A', fontSize: 10, fontFamily: 'SyneMono_400Regular', marginTop: 6, marginBottom: 16 },
});

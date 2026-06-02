import React, { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Picker,
} from 'react-native';
import { apiFetch } from '../api';
import { C, S } from '../components/theme';

const TICKERS = [
  'CSP500','CTOP50','ETF500','ETF5IT','ETFGLD','ETFGGB','ETFBND',
  'ETFEMA','ETFGRE','ETFPLD','CSGOVI','CSPROP','CSYSB',
  'ABG','ACL','ADH','AEG','AFE','AFT','AGL','ANG','ANH','ACS','AFH',
  '27FGMF','91DINC','91GINC','BTC','ETH',
];
const TYPES   = ['ETF', 'Share', 'Crypto'];
const ACTIONS = ['BUY', 'SELL', 'EXIT'];

const START = new Date('2026-06-02');
function curWeek() {
  return Math.max(1, Math.min(Math.floor((new Date() - START) / (7 * 86400000)) + 1, 17));
}

function TradeRow({ trade }) {
  const ac = trade.action === 'BUY' ? C.green : trade.action === 'SELL' ? C.gold : C.pink;
  const tc = trade.type === 'ETF' ? C.cyan : trade.type === 'Crypto' ? C.orange : C.green;
  return (
    <View style={styles.tradeRow}>
      <View style={[styles.actionBadge, { backgroundColor: `${ac}15`, borderColor: `${ac}40` }]}>
        <Text style={{ color: ac, fontSize: 9, fontWeight: '800' }}>{trade.action}</Text>
      </View>
      <Text style={[styles.tradeTicker, { color: tc }]}>{trade.ticker}</Text>
      <Text style={{ color: C.gold, fontSize: 12, minWidth: 60 }}>R{trade.amount?.toFixed(2)}</Text>
      <Text style={{ color: C.muted, fontSize: 10, flex: 1, textAlign: 'right' }}>{trade.date} W{trade.week}</Text>
    </View>
  );
}

function SegmentPicker({ options, value, onChange, color }) {
  return (
    <View style={styles.segment}>
      {options.map(o => (
        <TouchableOpacity
          key={o} onPress={() => onChange(o)}
          style={[styles.segOption, value === o && { backgroundColor: `${color}20`, borderColor: `${color}60` }]}
        >
          <Text style={{ color: value === o ? color : C.muted, fontSize: 11, fontWeight: value === o ? '700' : '400' }}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TickerSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.tickerBtn}>
        <Text style={{ color: value ? C.text : C.dimmed, fontSize: 13 }}>
          {value || 'Select ticker…'}
        </Text>
        <Text style={{ color: C.muted }}>▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.tickerDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {TICKERS.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { onChange(t); setOpen(false); }}
                style={[styles.tickerOption, value === t && { backgroundColor: `${C.cyan}15` }]}
              >
                <Text style={{ color: value === t ? C.cyan : C.text, fontSize: 12 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function LogScreen() {
  const [trades, setTrades] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState('ETF');
  const [action, setAction] = useState('BUY');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [week] = useState(curWeek());

  const loadTrades = async () => {
    try { setTrades(await apiFetch('/api/trades')); } catch {}
  };

  useEffect(() => { loadTrades(); }, []);

  const submit = async () => {
    if (!ticker || !amount) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/trades', {
        method: 'POST',
        body: JSON.stringify({
          ticker, type, action, amount: parseFloat(amount),
          note, week,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setTicker(''); setAmount(''); setNote('');
      loadTrades();
    } catch {}
    finally { setSubmitting(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Form */}
      <View style={[S.card, { borderColor: `${C.green}25` }]}>
        <Text style={[S.label, { color: C.green, marginBottom: 14 }]}>LOG TRADE</Text>

        <Text style={S.label}>TICKER</Text>
        <TickerSelector value={ticker} onChange={setTicker} />

        <Text style={[S.label, { marginTop: 12 }]}>TYPE</Text>
        <SegmentPicker options={TYPES} value={type} onChange={setType} color={C.cyan} />

        <Text style={[S.label, { marginTop: 12 }]}>ACTION</Text>
        <SegmentPicker options={ACTIONS} value={action} onChange={setAction} color={C.green} />

        <Text style={[S.label, { marginTop: 12 }]}>AMOUNT (ZAR)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 120"
          placeholderTextColor={C.dimmed}
        />

        <Text style={[S.label, { marginTop: 12 }]}>NOTE (optional)</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Bought at open"
          placeholderTextColor={C.dimmed}
        />

        <Text style={[S.label, { marginTop: 10 }]}>WEEK</Text>
        <Text style={{ color: C.gold, fontWeight: '800', fontSize: 18, marginBottom: 14 }}>Week {week}</Text>

        <TouchableOpacity
          onPress={submit}
          disabled={submitting || !ticker || !amount}
          style={[styles.submitBtn, success && styles.submitBtnSuccess, (!ticker || !amount) && { opacity: 0.4 }]}
        >
          <Text style={[styles.submitText, success && { color: C.bg }]}>
            {success ? '✓ LOGGED' : submitting ? 'LOGGING…' : 'LOG TRADE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* History */}
      <View style={S.card}>
        <View style={styles.histHeader}>
          <Text style={S.label}>TRADE HISTORY ({trades.length})</Text>
          <TouchableOpacity onPress={loadTrades}>
            <Text style={{ color: C.cyan, fontSize: 10, letterSpacing: 0.8 }}>REFRESH</Text>
          </TouchableOpacity>
        </View>
        {trades.length === 0
          ? <Text style={{ color: C.dimmed, fontSize: 11, textAlign: 'center', paddingVertical: 20 }}>No trades logged yet</Text>
          : trades.map(t => <TradeRow key={t.id} trade={t} />)
        }
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  input: {
    backgroundColor: 'rgba(14,14,26,0.9)', borderWidth: 1, borderColor: 'rgba(46,232,255,0.15)',
    borderRadius: 6, color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 4,
  },
  submitBtn: {
    borderWidth: 1, borderColor: C.green, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', backgroundColor: `${C.green}0F`, marginTop: 10,
  },
  submitBtnSuccess: { backgroundColor: C.green },
  submitText: { color: C.green, fontWeight: '800', fontSize: 13, letterSpacing: 1.2 },
  tradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(232,228,255,0.05)', gap: 8 },
  actionBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3, borderWidth: 1, minWidth: 36, alignItems: 'center' },
  tradeTicker: { fontWeight: '800', fontSize: 13, minWidth: 65 },
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  segment: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  segOption: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(232,228,255,0.12)', alignItems: 'center' },
  tickerBtn: {
    backgroundColor: 'rgba(14,14,26,0.9)', borderWidth: 1, borderColor: 'rgba(46,232,255,0.15)',
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  tickerDropdown: {
    borderWidth: 1, borderColor: 'rgba(46,232,255,0.15)', borderRadius: 6,
    backgroundColor: '#0E0E1A', marginBottom: 4,
  },
  tickerOption: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(232,228,255,0.05)' },
});

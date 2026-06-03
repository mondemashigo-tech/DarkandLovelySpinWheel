import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
  FlatList,
} from 'react-native';
import { usePositions } from '../hooks/usePositions';
import { API_URL } from '../config';

const BG = '#080810';
const SURFACE = '#0D0D1A';
const CARD = '#12122A';
const TEXT = '#E8E4FF';
const MUTED = '#6B6B8A';
const GREEN = '#4DFF9F';
const GOLD = '#FFC83D';
const CYAN = '#2EE8FF';
const RED = '#FF3D8A';

function formatRand(val) {
  if (val == null || val === '') return 'R—';
  const n = parseFloat(val);
  if (isNaN(n)) return 'R—';
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(val) {
  if (val == null) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function StatCard({ label, value, valueColor }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function AssetChip({ type }) {
  const chipColor =
    type === 'CRYPTO' ? CYAN :
    type === 'ETF' ? GOLD :
    type === 'SHARE' ? '#A78BFA' : MUTED;
  return (
    <View style={[styles.chip, { borderColor: chipColor }]}>
      <Text style={[styles.chipText, { color: chipColor }]}>{type || 'ASSET'}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const color =
    status === 'OPEN' ? GREEN :
    status === 'CLOSED' ? MUTED :
    status === 'STOP_LOSS' ? RED : GOLD;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{status || 'OPEN'}</Text>
    </View>
  );
}

function PositionCard({ position, onClose }) {
  const gainPct = parseFloat(position.gain_pct ?? position.gainPct ?? 0);
  const gainColor = gainPct >= 0 ? GREEN : RED;
  const isNearStop = gainPct < -6;

  const handleClose = () => {
    Alert.alert(
      'Close Position',
      `Close ${position.ticker}?\n\nCheck Telegram for the current market price before confirming.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Close',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/position/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ticker: position.ticker,
                  id: position.id,
                  note: 'Manually closed from mobile app — verify price on Telegram',
                }),
              });
              if (!res.ok) throw new Error(`Server error ${res.status}`);
              Alert.alert('Position Closed', `${position.ticker} has been queued for closure. Check Telegram for confirmation.`);
              onClose && onClose();
            } catch (e) {
              Alert.alert('Error', `Could not close position: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[
      styles.posCard,
      isNearStop && { borderColor: `${RED}55`, backgroundColor: '#1A0D12' },
    ]}>
      {/* Row 1: ticker + type chip + status */}
      <View style={styles.posRow}>
        <Text style={styles.ticker}>{position.ticker}</Text>
        <AssetChip type={position.asset_type ?? position.assetType} />
        <StatusBadge status={position.status} />
      </View>

      {/* Row 2: invested + entry price */}
      <View style={styles.posRow}>
        <View style={styles.posField}>
          <Text style={styles.posFieldLabel}>INVESTED</Text>
          <Text style={styles.posFieldValue}>{formatRand(position.amount_invested ?? position.amountInvested)}</Text>
        </View>
        <View style={styles.posField}>
          <Text style={styles.posFieldLabel}>ENTRY</Text>
          <Text style={styles.posFieldValue}>{formatRand(position.entry_price ?? position.entryPrice)}</Text>
        </View>
      </View>

      {/* Row 3: current price + gain */}
      <View style={styles.posRow}>
        <View style={styles.posField}>
          <Text style={styles.posFieldLabel}>CURRENT</Text>
          <Text style={styles.posFieldValue}>{formatRand(position.current_price ?? position.currentPrice)}</Text>
        </View>
        <View style={styles.posField}>
          <Text style={styles.posFieldLabel}>GAIN / LOSS</Text>
          <Text style={[styles.posFieldValue, { color: gainColor }]}>{formatPct(gainPct)}</Text>
        </View>
      </View>

      {/* Row 4: stop-loss */}
      <View style={[styles.posRow, { marginBottom: 10 }]}>
        <View style={styles.posField}>
          <Text style={styles.posFieldLabel}>STOP-LOSS</Text>
          <Text style={[styles.posFieldValue, { color: RED }]}>
            {formatRand(position.stop_loss ?? position.stopLoss)}
          </Text>
        </View>
        {isNearStop && (
          <View style={styles.nearStopBadge}>
            <Text style={styles.nearStopText}>⚠ NEAR STOP</Text>
          </View>
        )}
      </View>

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
        <Text style={styles.closeBtnText}>CLOSE POSITION</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PositionsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { positions, loading, error, refetch } = usePositions();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Compute summary stats
  const openPositions = positions.filter(p => (p.status ?? 'OPEN') === 'OPEN');
  const totalInvested = openPositions.reduce((sum, p) => sum + parseFloat(p.amount_invested ?? p.amountInvested ?? 0), 0);
  const totalCurrent = openPositions.reduce((sum, p) => {
    const current = parseFloat(p.current_value ?? p.currentValue ?? p.current_price ?? p.currentPrice ?? 0);
    const invested = parseFloat(p.amount_invested ?? p.amountInvested ?? 0);
    // If current_value is available, use it; otherwise approximate from current_price
    if (p.current_value ?? p.currentValue) return sum + current;
    const qty = invested / parseFloat(p.entry_price ?? p.entryPrice ?? 1);
    return sum + qty * parseFloat(p.current_price ?? p.currentPrice ?? p.entry_price ?? p.entryPrice ?? 0);
  }, 0);
  const totalGainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;
  const gainColor = totalGainPct >= 0 ? GREEN : RED;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CYAN} colors={[CYAN]} />
      }
    >
      {/* P&L summary row */}
      <View style={styles.statsRow}>
        <StatCard
          label="INVESTED"
          value={formatRand(totalInvested)}
        />
        <StatCard
          label="CURRENT"
          value={formatRand(totalCurrent)}
        />
        <StatCard
          label="GAIN"
          value={formatPct(totalGainPct)}
          valueColor={gainColor}
        />
      </View>

      {/* Section header */}
      <Text style={styles.sectionHeader}>
        OPEN POSITIONS ({openPositions.length})
      </Text>

      {/* Error state */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Could not load positions: {error}</Text>
        </View>
      )}

      {/* Empty state */}
      {!loading && !error && openPositions.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No open positions</Text>
          <Text style={styles.emptySubtitle}>
            Bot will send Telegram alerts when opportunities are found
          </Text>
        </View>
      )}

      {/* Positions list */}
      {openPositions.map((p, i) => (
        <PositionCard key={p.id ?? p.ticker ?? i} position={p} onClose={refetch} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    alignItems: 'center',
  },
  statLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 18,
    letterSpacing: 1,
  },
  sectionHeader: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 16,
    letterSpacing: 2,
    color: TEXT,
    marginBottom: 10,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: `${RED}18`,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${RED}44`,
    marginBottom: 10,
  },
  errorText: {
    color: RED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 20,
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  posCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffffff0D',
    marginBottom: 10,
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ticker: {
    color: TEXT,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 24,
    letterSpacing: 1,
    marginRight: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  posField: {
    flex: 1,
    minWidth: 100,
  },
  posFieldLabel: {
    color: MUTED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 2,
  },
  posFieldValue: {
    color: TEXT,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 13,
  },
  nearStopBadge: {
    backgroundColor: `${RED}22`,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${RED}66`,
  },
  nearStopText: {
    color: RED,
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    color: RED,
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 14,
    letterSpacing: 2,
  },
});

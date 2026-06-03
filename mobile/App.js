// R300 Trade Bot v1.0.1
import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { SyneMono_400Regular } from '@expo-google-fonts/syne-mono';
import { LinearGradient } from 'expo-linear-gradient';
import { ApiUrlProvider } from './src/context/ApiUrlContext';

import LiveFeedScreen from './src/screens/LiveFeedScreen';
import PositionsScreen from './src/screens/PositionsScreen';
import SignalsScreen from './src/screens/SignalsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

// ─── Tab icons (text-based, no icon library needed) ───────────────────────────
function TabIcon({ label, focused }) {
  const icons = {
    'Live': focused ? '◉' : '◎',
    'Positions': focused ? '▣' : '▢',
    'Signals': focused ? '◆' : '◇',
    'History': focused ? '▦' : '▤',
    'Settings': focused ? '✦' : '✧',
  };
  return (
    <Text style={{ fontSize: 18, color: focused ? '#2EE8FF' : '#6B6B8A' }}>
      {icons[label] || '●'}
    </Text>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <LinearGradient colors={['#080810', '#0D0D1A']} style={styles.loading}>
      <Text style={styles.loadingTitle}>R300</Text>
      <Text style={styles.loadingSubtitle}>TRADE BOT</Text>
      <Text style={styles.loadingMeta}>Loading fonts...</Text>
    </LinearGradient>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    SyneMono_400Regular,
  });

  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <ApiUrlProvider>
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#080810" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
            tabBarActiveTintColor: '#2EE8FF',
            tabBarInactiveTintColor: '#6B6B8A',
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabLabel,
            header: () => <AppHeader />,
          })}
        >
          <Tab.Screen name="Live" component={LiveFeedScreen} />
          <Tab.Screen name="Positions" component={PositionsScreen} />
          <Tab.Screen name="Signals" component={SignalsScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </ApiUrlProvider>
  );
}

// ─── Shared app header ────────────────────────────────────────────────────────
function AppHeader() {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>R300 TRADE BOT</Text>
        <Text style={styles.headerSub}>South African Autonomous Trading Agent</Text>
      </View>
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    </View>
  );
}

// ─── React Navigation dark theme ─────────────────────────────────────────────
const navTheme = {
  dark: true,
  colors: {
    primary: '#2EE8FF',
    background: '#080810',
    card: '#0D0D1A',
    text: '#E8E4FF',
    border: '#ffffff0A',
    notification: '#FF3D8A',
  },
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 72,
    color: '#2EE8FF',
    letterSpacing: 4,
  },
  loadingSubtitle: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 28,
    color: '#E8E4FF',
    letterSpacing: 6,
    marginTop: -8,
  },
  loadingMeta: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 12,
    color: '#6B6B8A',
    marginTop: 24,
  },
  header: {
    backgroundColor: '#0D0D1A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff0A',
  },
  headerTitle: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 24,
    color: '#2EE8FF',
    letterSpacing: 2,
  },
  headerSub: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
    color: '#6B6B8A',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4DFF9F',
  },
  liveText: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 11,
    color: '#6B6B8A',
  },
  tabBar: {
    backgroundColor: '#0D0D1A',
    borderTopColor: '#ffffff0A',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
  },
  tabLabel: {
    fontFamily: 'SyneMono_400Regular',
    fontSize: 10,
  },
});

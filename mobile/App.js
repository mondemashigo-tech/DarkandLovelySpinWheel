import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import TodayScreen    from './src/screens/TodayScreen';
import WeekScreen     from './src/screens/WeekScreen';
import ExitsScreen    from './src/screens/ExitsScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import LogScreen      from './src/screens/LogScreen';
import { C }          from './src/components/theme';

const Tab = createBottomTabNavigator();

const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, card: '#0A0A14', border: 'rgba(46,232,255,0.12)', text: C.text },
};

function HeaderTitle({ title, week }) {
  return (
    <View style={styles.headerTitle}>
      <View style={styles.pulseWrapper}>
        <View style={styles.pulseDot} />
      </View>
      <Text style={styles.appName}>{title}</Text>
      {week && <Text style={styles.weekBadge}>W{week}</Text>}
    </View>
  );
}

const START = new Date('2026-06-02');
function curWeek() {
  return Math.max(1, Math.min(Math.floor((new Date() - START) / (7 * 86400000)) + 1, 17));
}

export default function App() {
  const week = curWeek();

  return (
    <NavigationContainer theme={NAV_THEME}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle:      { backgroundColor: '#08080F', borderBottomWidth: 1, borderBottomColor: 'rgba(46,232,255,0.1)' },
          headerTitleAlign: 'left',
          headerTitle: () => <HeaderTitle title="R300 TRADE SIGNAL" week={week} />,
          tabBarStyle: {
            backgroundColor: '#08080F',
            borderTopColor: 'rgba(46,232,255,0.1)',
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor:   C.cyan,
          tabBarInactiveTintColor: 'rgba(232,228,255,0.3)',
          tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.5 },
          tabBarIcon: ({ color, size }) => {
            const icons = {
              Today:     'today-outline',
              'This Week': 'calendar-outline',
              Exits:     'trending-down-outline',
              Portfolio: 'pie-chart-outline',
              Log:       'create-outline',
            };
            return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size - 2} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Today"     component={TodayScreen} />
        <Tab.Screen name="This Week" component={WeekScreen} />
        <Tab.Screen name="Exits"     component={ExitsScreen} />
        <Tab.Screen name="Portfolio" component={PortfolioScreen} />
        <Tab.Screen name="Log"       component={LogScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseWrapper: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulseDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  appName:    { color: C.text, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  weekBadge:  { backgroundColor: `${C.gold}20`, borderWidth: 1, borderColor: `${C.gold}40`,
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
                color: C.gold, fontSize: 11, fontWeight: '700', marginLeft: 4 },
});

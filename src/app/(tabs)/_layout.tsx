import React from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Envelope, Crown, Friends, Flame, Profile } from '../../components/Icons';
import { colors } from '../../theme';

const icons: Record<string, (active: boolean) => React.ReactNode> = {
  index: (a) => <Envelope size={30} color={a ? colors.blue : '#7E919F'} />,
  ranks: () => <Crown size={30} />,
  friends: () => <Friends size={30} />,
  streak: () => <Flame size={30} />,
  you: () => <Profile size={30} />,
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const active = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => navigation.navigate(route.name)}
            style={[styles.tab, active && styles.tabActive]}
          >
            {icons[route.name]?.(active)}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="streak" options={{ title: 'Streak' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 2,
    borderTopColor: '#fff',
    shadowColor: '#00508C',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  tab: { width: 58, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#DDF4FF', borderWidth: 2, borderColor: '#84D8FF' },
});

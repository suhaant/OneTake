import React from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Envelope, Crown, Friends, Flame, Profile } from '../../components/Icons';
import { Gloss } from '../../components/Glass';
import { colors, gradients } from '../../theme';

const icons: Record<string, (active: boolean) => React.ReactNode> = {
  index: (a) => <Envelope size={30} color={a ? '#fff' : colors.blue} />,
  ranks: () => <Crown size={30} />,
  friends: () => <Friends size={30} />,
  streak: () => <Flame size={30} />,
  you: () => <Profile size={30} />,
};

/** Floating glass dock, the active tab lit as an aqua gel orb. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={styles.dock}>
      <View style={styles.bar}>
        <LinearGradient colors={[...gradients.chrome]} locations={[0, 0.4, 0.85, 1]} style={StyleSheet.absoluteFill} />
        <Gloss height="48%" radius={32} />
        {state.routes.map((route: { key: string; name: string }, i: number) => {
          const active = state.index === i;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tab}
            >
              {active && (
                <View style={styles.orb}>
                  <LinearGradient colors={[...gradients.aqua]} style={StyleSheet.absoluteFill} />
                  <Gloss height="50%" radius={26} />
                </View>
              )}
              {/* positioned so it paints above the orb on web too */}
              <View style={{ zIndex: 1 }}>{icons[route.name]?.(active)}</View>
            </Pressable>
          );
        })}
      </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="ranks" options={{ title: 'Ranks' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="streak" options={{ title: 'Progress' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  dock: {
    borderRadius: 32,
    shadowColor: '#0A4E8A',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 68,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  tab: { width: 58, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  orb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 3,
    width: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#0A6DAE',
    overflow: 'hidden',
  },
});

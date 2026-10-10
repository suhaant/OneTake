import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Hind_400Regular, Hind_500Medium, Hind_600SemiBold, Hind_700Bold } from '@expo-google-fonts/hind';
import { Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { AppProvider } from '../store';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded] = useFonts({
    Hind_400Regular,
    Hind_500Medium,
    Hind_600SemiBold,
    Hind_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#9FDFFF' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="prompt" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="thinking" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="results" options={{ animation: 'fade' }} />
        <Stack.Screen name="share" options={{ presentation: 'modal' }} />
      </Stack>
    </AppProvider>
  );
}

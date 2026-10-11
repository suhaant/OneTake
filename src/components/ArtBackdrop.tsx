import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type Art = 'island' | 'sky' | 'bubbles' | 'water' | 'meadow';

/**
 * Full-bleed stills rendered by Gemini for the app's Frutiger Aero scenes (scripts/gen-art.mjs).
 * Each keeps the middle of the frame quiet so cards and text sit on top without a heavy scrim.
 */
const ART: Record<Art, number> = {
  island: require('../../assets/art/island.jpg'),
  sky: require('../../assets/art/sky.jpg'),
  bubbles: require('../../assets/art/bubbles.jpg'),
  water: require('../../assets/art/water.jpg'),
  meadow: require('../../assets/art/meadow.jpg'),
};

export default function ArtBackdrop({ art }: { art: Art }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={ART[art]} resizeMode="cover" style={StyleSheet.absoluteFill} />
      {/* a whisper of depth at the very top so the status bar and stat pills read */}
      <LinearGradient colors={['rgba(10,78,138,0.14)', 'rgba(10,78,138,0)']} locations={[0, 0.22]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

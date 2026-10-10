import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle } from 'react-native-svg';
import { sky } from '../theme';

type Props = {
  /** show the grass hills at the bottom */
  hills?: boolean;
  /** extra bubbles positions as fractions of the screen */
  bubbles?: { x: number; y: number; r: number }[];
  /** where the gradient ends, lets tall screens stay bright longer */
  locations?: readonly [number, number, number, number];
};

const defaultBubbles = [
  { x: 0.84, y: 0.3, r: 34 },
  { x: 0.1, y: 0.56, r: 20 },
];

export default function AeroBackground({
  hills = true,
  bubbles = defaultBubbles,
  locations = [0, 0.38, 0.78, 1],
}: Props) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...sky]} locations={[...locations]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor="#fff" stopOpacity={0.45} />
            <Stop offset="0.7" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bubble" cx="30%" cy="28%" r="70%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.95} />
            <Stop offset="0.3" stopColor="#fff" stopOpacity={0.35} />
            <Stop offset="0.7" stopColor="#AAE6FF" stopOpacity={0.15} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0.55} />
          </RadialGradient>
          <RadialGradient id="hillA" cx="50%" cy="20%" r="80%">
            <Stop offset="0" stopColor="#D8FF7A" />
            <Stop offset="0.35" stopColor="#8FD93A" />
            <Stop offset="1" stopColor="#4BAA1E" />
          </RadialGradient>
          <RadialGradient id="hillB" cx="40%" cy="20%" r="80%">
            <Stop offset="0" stopColor="#C9F766" />
            <Stop offset="0.4" stopColor="#74C62C" />
            <Stop offset="1" stopColor="#3E961A" />
          </RadialGradient>
        </Defs>
        <Circle cx={width * 0.2} cy={40} r={170} fill="url(#glow)" />
        {bubbles.map((b, i) => (
          <Circle
            key={i}
            cx={width * b.x}
            cy={height * b.y}
            r={b.r}
            fill="url(#bubble)"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1}
          />
        ))}
        {hills && (
          <>
            <Ellipse cx={width * 0.3} cy={height + 70} rx={width * 0.68} ry={190} fill="url(#hillA)" />
            <Ellipse cx={width * 1.05} cy={height + 90} rx={width * 0.6} ry={170} fill="url(#hillB)" />
          </>
        )}
      </Svg>
    </View>
  );
}

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { colors, fonts } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ScoreRing({ score, size = 220, stroke = 14 }: { score: number; size?: number; stroke?: number }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(score / 100, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [score, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));
  const inner = r - stroke * 0.3;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#E9FF8A" />
            <Stop offset="0.5" stopColor="#5FE3FF" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </LinearGradient>
          <RadialGradient id="glass" cx="40%" cy="28%" r="85%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.98} />
            <Stop offset="0.6" stopColor="#EAF9FF" stopOpacity={0.8} />
            <Stop offset="1" stopColor="#BDEBFF" stopOpacity={0.75} />
          </RadialGradient>
          <LinearGradient id="ringGlow" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.75} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.4)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r + stroke * 0.6} stroke="rgba(255,255,255,0.35)" strokeWidth={1} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <Circle cx={size / 2} cy={size / 2} r={inner} fill="url(#glass)" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
        <Ellipse cx={size * 0.42} cy={size * 0.27} rx={size * 0.2} ry={size * 0.07} fill="#fff" opacity={0.8} />
        <Ellipse cx={size * 0.5} cy={size * 0.74} rx={size * 0.22} ry={size * 0.05} fill="url(#ringGlow)" opacity={0.7} />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.num, { fontSize: size * 0.38 }]}>{score}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.bold, color: colors.navy, letterSpacing: -3, includeFontPadding: false },
});

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

type Props = {
  /** px from the bottom of the screen to the tallest blades */
  height?: number;
};

/** Painted meadow rows, far to near: shorter and paler at the back, taller and deeper at the front. */
const ROWS = [
  { y: 0.52, count: 70, h: [26, 46], w: 5, lean: 10, colors: ['#D9F58A', '#8ED53E'], period: 4200, amp: 5, delay: 600 },
  { y: 0.64, count: 60, h: [38, 66], w: 6.5, lean: 14, colors: ['#BDEB63', '#62BE27'], period: 3600, amp: 7, delay: 300 },
  { y: 0.78, count: 50, h: [56, 92], w: 8, lean: 18, colors: ['#9EDB45', '#3FA51C'], period: 3100, amp: 9, delay: 0 },
  { y: 0.94, count: 42, h: [78, 126], w: 10, lean: 24, colors: ['#7CCB34', '#2E8A14'], period: 2700, amp: 12, delay: 900 },
] as const;

/** Deterministic noise so the field looks the same every visit. */
const noise = (n: number, salt: number) => {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** One tapered blade: a slim leaf from the root to a curved tip. */
function blade(x: number, base: number, h: number, w: number, lean: number): string {
  const tipX = x + lean;
  const tipY = base - h;
  return `M${x - w / 2} ${base} C ${x - w / 4} ${base - h * 0.45}, ${x + lean * 0.55} ${base - h * 0.8}, ${tipX} ${tipY} C ${x + lean * 0.6 + w * 0.3} ${base - h * 0.78}, ${x + w / 2 + lean * 0.12} ${base - h * 0.4}, ${x + w / 2} ${base} Z`;
}

/** One row of blades swaying together, its root pinned to the ground. */
function Row({ row, width, height, index }: { row: (typeof ROWS)[number]; width: number; height: number; index: number }) {
  const sway = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    // A breath of wind: lean right, settle, lean left a little less, settle, forever.
    sway.value = withDelay(
      row.delay,
      withRepeat(
        withSequence(
          withTiming(row.amp, { duration: row.period, easing: ease }),
          withTiming(-row.amp * 0.55, { duration: row.period * 1.15, easing: ease }),
        ),
        -1,
        true,
      ),
    );
  }, [sway, row]);
  const style = useAnimatedStyle(() => ({ transform: [{ skewX: `${sway.value}deg` }, { translateX: sway.value * 0.6 }] }));

  const base = height * row.y;
  const blades = useMemo(() => {
    const out: { d: string; fill: string; opacity: number }[] = [];
    const span = width + 80;
    for (let i = 0; i < row.count; i++) {
      const x = -40 + (i / row.count) * span + (noise(i, index) - 0.5) * (span / row.count);
      const h = row.h[0] + noise(i, index + 10) * (row.h[1] - row.h[0]);
      const lean = (noise(i, index + 20) - 0.3) * row.lean * 2;
      const w = row.w * (0.7 + noise(i, index + 30) * 0.6);
      const mix = noise(i, index + 40);
      out.push({ d: blade(x, base + 2, h, w, lean), fill: mix > 0.5 ? row.colors[0] : row.colors[1], opacity: 0.85 + mix * 0.15 });
    }
    return out;
  }, [row, width, base, index]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `50% ${row.y * 100}%` }, style]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {blades.map((b, i) => (
          <Path key={i} d={b.d} fill={b.fill} opacity={b.opacity} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/**
 * A meadow at the foot of the screen, painted in the app's Frutiger Aero greens: a sunlit hill,
 * then rows of blades that sway in the wind, the nearest ones tallest and deepest in colour.
 */
export default function Grass({ height = 280 }: Props) {
  const { width } = useWindowDimensions();
  const h = height;
  const w = width;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E3FA9A" />
            <Stop offset="0.3" stopColor="#9BDB44" />
            <Stop offset="0.7" stopColor="#56B526" />
            <Stop offset="1" stopColor="#2B7F12" />
          </LinearGradient>
          <RadialGradient id="meadowSun" cx="30%" cy="30%" r="60%">
            <Stop offset="0" stopColor="#FFFFC8" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFC8" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="meadowShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E6A0C" stopOpacity={0} />
            <Stop offset="1" stopColor="#1E6A0C" stopOpacity={0.45} />
          </LinearGradient>
        </Defs>
        {/* the hill: a soft ridge, higher on the left like the sun side of a slope */}
        <Path d={`M0 ${h * 0.5} C ${w * 0.25} ${h * 0.36}, ${w * 0.6} ${h * 0.44}, ${w} ${h * 0.56} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadow)" />
        <Path d={`M0 ${h * 0.5} C ${w * 0.25} ${h * 0.36}, ${w * 0.6} ${h * 0.44}, ${w} ${h * 0.56} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadowSun)" />
        {/* a worn path and a shadow band, like the brush strokes across the reference meadow */}
        <Path d={`M${-w * 0.1} ${h * 0.72} C ${w * 0.3} ${h * 0.66}, ${w * 0.6} ${h * 0.78}, ${w * 1.1} ${h * 0.7}`} fill="none" stroke="#7FB83A" strokeOpacity={0.55} strokeWidth={14} strokeLinecap="round" />
        <Path d={`M0 ${h * 0.8} L ${w} ${h * 0.8} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadowShade)" />
      </Svg>
      {ROWS.map((row, i) => (
        <Row key={i} row={row} width={w} height={h} index={i} />
      ))}
    </View>
  );
}

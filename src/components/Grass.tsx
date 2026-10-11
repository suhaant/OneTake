import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

type Props = {
  /** px from the bottom of the screen to the tallest blades */
  height?: number;
  /** a still lake behind the meadow, with ripples, like the reference island */
  water?: boolean;
  /** leaves drifting across on the wind */
  leaves?: boolean;
};

/** Painted meadow rows, far to near: shorter and paler at the back, taller and deeper at the front. */
const ROWS = [
  { y: 0.52, count: 70, h: [26, 46], w: 5, lean: 10, colors: ['#D9F58A', '#8ED53E'], period: 4200, amp: 5, delay: 600, dew: 0 },
  { y: 0.64, count: 60, h: [38, 66], w: 6.5, lean: 14, colors: ['#BDEB63', '#62BE27'], period: 3600, amp: 7, delay: 300, dew: 0 },
  { y: 0.78, count: 50, h: [56, 92], w: 8, lean: 18, colors: ['#9EDB45', '#3FA51C'], period: 3100, amp: 9, delay: 0, dew: 0.22 },
  { y: 0.94, count: 42, h: [78, 126], w: 10, lean: 24, colors: ['#7CCB34', '#2E8A14'], period: 2700, amp: 12, delay: 900, dew: 0.35 },
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

/** The light catching the blade's spine: a thin stroke up its centre line, fading toward the tip. */
function spine(x: number, base: number, h: number, lean: number): string {
  return `M${x} ${base - h * 0.08} C ${x + lean * 0.1} ${base - h * 0.4}, ${x + lean * 0.5} ${base - h * 0.7}, ${x + lean * 0.9} ${base - h * 0.92}`;
}

type Drop = { cx: number; cy: number; r: number; glint: number };

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
  const { blades, drops } = useMemo(() => {
    const out: { d: string; s: string; fill: string; opacity: number; w: number }[] = [];
    const dew: Drop[] = [];
    const span = width + 80;
    for (let i = 0; i < row.count; i++) {
      const x = -40 + (i / row.count) * span + (noise(i, index) - 0.5) * (span / row.count);
      const h = row.h[0] + noise(i, index + 10) * (row.h[1] - row.h[0]);
      const lean = (noise(i, index + 20) - 0.3) * row.lean * 2;
      const w = row.w * (0.7 + noise(i, index + 30) * 0.6);
      const mix = noise(i, index + 40);
      out.push({ d: blade(x, base + 2, h, w, lean), s: spine(x, base + 2, h, lean), fill: mix > 0.5 ? row.colors[0] : row.colors[1], opacity: 0.85 + mix * 0.15, w });
      // Dew sits where the blade starts to bend, a little off its spine.
      if (noise(i, index + 50) < row.dew) {
        const at = 0.45 + noise(i, index + 60) * 0.3;
        dew.push({ cx: x + lean * at * 0.8 + (noise(i, index + 70) - 0.5) * w * 0.6, cy: base - h * at, r: 2.2 + noise(i, index + 80) * 2.4, glint: noise(i, index + 90) });
      }
    }
    return { blades: out, drops: dew };
  }, [row, width, base, index]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `50% ${row.y * 100}%` }, style]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`dew${index}`} cx="35%" cy="30%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.45" stopColor="#E4FBFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#8FD8FF" stopOpacity={0.35} />
          </RadialGradient>
        </Defs>
        {blades.map((b, i) => (
          <React.Fragment key={i}>
            <Path d={b.d} fill={b.fill} opacity={b.opacity} />
            <Path d={b.s} fill="none" stroke="#F4FFC2" strokeOpacity={0.55} strokeWidth={Math.max(1, b.w * 0.22)} strokeLinecap="round" />
          </React.Fragment>
        ))}
        {drops.map((d, i) => (
          <React.Fragment key={`d${i}`}>
            <Ellipse cx={d.cx} cy={d.cy + d.r * 0.9} rx={d.r * 1.1} ry={d.r * 0.5} fill="#1E6A0C" opacity={0.18} />
            <Circle cx={d.cx} cy={d.cy} r={d.r} fill={`url(#dew${index})`} stroke="#fff" strokeOpacity={0.8} strokeWidth={0.8} />
            <Circle cx={d.cx - d.r * 0.35} cy={d.cy - d.r * 0.4} r={d.r * 0.3} fill="#fff" />
          </React.Fragment>
        ))}
      </Svg>
      {drops.filter((d) => d.glint > 0.6).map((d, i) => (
        <Glint key={`g${i}`} x={d.cx} y={d.cy} delay={d.glint * 4000} />
      ))}
    </Animated.View>
  );
}

/** A dew drop catching the sun: a four-point sparkle that blinks every few seconds. */
function Glint({ x, y, delay }: { x: number; y: number; delay: number }) {
  const a = useSharedValue(0);
  useEffect(() => {
    a.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 500 }), withTiming(0, { duration: 3400 + delay * 0.5 })), -1));
  }, [a, delay]);
  const style = useAnimatedStyle(() => ({ opacity: a.value, transform: [{ scale: 0.6 + a.value * 0.6 }, { rotate: `${a.value * 40}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - 7, top: y - 7, width: 14, height: 14 }, style]}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Path d="M7 0 L8.2 5.8 L14 7 L8.2 8.2 L7 14 L5.8 8.2 L0 7 L5.8 5.8 Z" fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

/** A small leaf carried across the screen on a gust, tumbling as it goes. */
export function DriftingLeaf({ width, height, seed }: { width: number; height: number; seed: number }) {
  const p = useSharedValue(0);
  const dur = 9000 + noise(seed, 1) * 6000;
  const y0 = height * (0.1 + noise(seed, 2) * 0.45);
  const amp = 18 + noise(seed, 3) * 26;
  useEffect(() => {
    p.value = withDelay(noise(seed, 4) * 8000, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) }), -1));
  }, [p, dur, seed]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1,
      transform: [
        { translateX: -40 + t * (width + 80) },
        { translateY: y0 + Math.sin(t * Math.PI * 3) * amp + t * 30 },
        { rotate: `${t * 720 + seed * 40}deg` },
      ],
    };
  });
  const size = 12 + noise(seed, 5) * 8;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path d="M2 18 C 2 8, 10 2, 18 2 C 18 10, 12 18, 2 18 Z" fill="#8ED53E" stroke="#4FAE1E" strokeWidth={1} />
        <Path d="M3 17 L15 5" stroke="#E6FF9A" strokeWidth={1} strokeOpacity={0.8} />
      </Svg>
    </Animated.View>
  );
}

/** Wave lines sliding across the lake. The pattern repeats every quarter width, so the slide loops seamlessly. */
function Waves({ width: w, height: h }: { width: number; height: number }) {
  const x = useSharedValue(0);
  const period = w * 0.5;
  useEffect(() => {
    x.value = withRepeat(withTiming(-period, { duration: 9000, easing: Easing.linear }), -1);
  }, [x, period]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={w * 2} height={h}>
        {[0.22, 0.3, 0.38, 0.47].map((fy, i) => (
          <Path key={i} d={`M${-20 + i * 30} ${h * fy} q ${w * 0.12} -4 ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0 t ${w * 0.25} 0`} fill="none" stroke="#fff" strokeOpacity={0.35 - i * 0.05} strokeWidth={1.2} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** A ring spreading on the lake, fading as it grows. */
function Ripple({ x, y, rx, delay }: { x: number; y: number; rx: number; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 5200, easing: Easing.out(Easing.quad) }), -1));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({ opacity: (1 - p.value) * 0.7, transform: [{ scaleX: 0.3 + p.value * 1 }, { scaleY: 0.3 + p.value * 1 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - rx, top: y - rx * 0.28, width: rx * 2, height: rx * 0.56, borderRadius: rx, borderWidth: 1.2, borderColor: '#fff' }, style]} />
  );
}

/**
 * A meadow at the foot of the screen, painted in the app's Frutiger Aero greens: a sunlit hill,
 * then rows of glossy, dewy blades that sway in the wind, the nearest ones tallest and deepest in
 * colour. Optionally a still lake behind it and leaves on the breeze.
 */
export default function Grass({ height = 280, water = false, leaves = true }: Props) {
  const { width } = useWindowDimensions();
  const h = height;
  const w = width;
  const ripples = useMemo(() => [0.18, 0.5, 0.82, 0.34, 0.68].map((fx, i) => ({ x: w * fx, y: h * (0.3 + noise(i, 7) * 0.14), rx: 24 + noise(i, 8) * 40, delay: i * 1100 })), [w, h]);
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
          <LinearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#DFF7FF" />
            <Stop offset="0.35" stopColor="#6FD8FF" />
            <Stop offset="1" stopColor="#1693D6" />
          </LinearGradient>
          <LinearGradient id="lakeShine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {water && (
          <>
            {/* the lake: horizon at the top of the band, sun path down the middle, soft wave lines */}
            <Path d={`M0 ${h * 0.14} L ${w} ${h * 0.14} L ${w} ${h * 0.62} L 0 ${h * 0.62} Z`} fill="url(#lake)" />
            <Path d={`M${w * 0.3} ${h * 0.14} L ${w * 0.7} ${h * 0.14} L ${w * 0.85} ${h * 0.6} L ${w * 0.15} ${h * 0.6} Z`} fill="url(#lakeShine)" opacity={0.6} />
          </>
        )}
        {/* the hill: a soft ridge, higher on the left like the sun side of a slope */}
        <Path d={`M0 ${h * 0.5} C ${w * 0.25} ${h * 0.36}, ${w * 0.6} ${h * 0.44}, ${w} ${h * 0.56} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadow)" />
        <Path d={`M0 ${h * 0.5} C ${w * 0.25} ${h * 0.36}, ${w * 0.6} ${h * 0.44}, ${w} ${h * 0.56} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadowSun)" />
        {/* a worn path and a shadow band, like the brush strokes across the reference meadow */}
        <Path d={`M${-w * 0.1} ${h * 0.72} C ${w * 0.3} ${h * 0.66}, ${w * 0.6} ${h * 0.78}, ${w * 1.1} ${h * 0.7}`} fill="none" stroke="#7FB83A" strokeOpacity={0.55} strokeWidth={14} strokeLinecap="round" />
        <Path d={`M0 ${h * 0.8} L ${w} ${h * 0.8} L ${w} ${h} L 0 ${h} Z`} fill="url(#meadowShade)" />
      </Svg>
      {water && <Waves width={w} height={h} />}
      {water && ripples.map((r, i) => <Ripple key={i} {...r} />)}
      {ROWS.map((row, i) => (
        <Row key={i} row={row} width={w} height={h} index={i} />
      ))}
      {leaves && [0, 1, 2, 3].map((s) => <DriftingLeaf key={s} width={w} height={h} seed={s} />)}
    </View>
  );
}

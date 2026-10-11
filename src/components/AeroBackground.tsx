import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Ellipse, Circle, Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { sky } from '../theme';
import Bubbles from './Bubbles';
import { DriftingLeaf } from './Grass';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Bubble = { x: number; y: number; r: number };

type Props = {
  /** show the glossy grass hills at the bottom */
  hills?: boolean;
  /** show the stream winding between the hills (needs hills) */
  water?: boolean;
  /** large dew droplets bobbing in place, positions as fractions of the screen */
  bubbles?: Bubble[];
  /** soap bubbles drifting up the screen; 0 turns them off */
  drift?: number;
  /** cumulus clouds crossing the sky */
  clouds?: boolean;
  /** leaves on the wind */
  leaves?: boolean;
  /** where the gradient stops land, lets tall screens stay bright longer */
  locations?: readonly [number, number, number, number];
};

const defaultBubbles: Bubble[] = [
  { x: 0.86, y: 0.26, r: 36 },
  { x: 0.08, y: 0.52, r: 22 },
  { x: 0.72, y: 0.6, r: 14 },
];

/** Bokeh discs: soft, out-of-focus light caught by the lens. */
const bokeh = [
  { x: 0.18, y: 0.2, r: 70, o: 0.16 },
  { x: 0.62, y: 0.12, r: 48, o: 0.2 },
  { x: 0.9, y: 0.46, r: 90, o: 0.12 },
  { x: 0.34, y: 0.42, r: 34, o: 0.18 },
  { x: 0.52, y: 0.3, r: 22, o: 0.26 },
];

/** Cumulus at two depths: the far ones smaller, paler and slower. */
const CLOUDS = [
  { y: 0.07, scale: 1, speed: 95000, start: 0.1, far: false },
  { y: 0.16, scale: 0.65, speed: 140000, start: 0.55, far: true },
  { y: 0.24, scale: 0.85, speed: 110000, start: 0.8, far: false },
  { y: 0.31, scale: 0.5, speed: 170000, start: 0.3, far: true },
];

export default function AeroBackground({ hills = true, water = true, bubbles = defaultBubbles, drift = 5, clouds = true, leaves = false, locations = [0, 0.3, 0.68, 1] }: Props) {
  const { width, height } = useWindowDimensions();
  const h = height;
  const w = width;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...sky]} locations={[...locations]} style={StyleSheet.absoluteFill} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFBE6" stopOpacity={1} />
            <Stop offset="0.18" stopColor="#FFF4C2" stopOpacity={0.9} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="bokeh" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.5} />
            <Stop offset="0.8" stopColor="#fff" stopOpacity={0.6} />
            <Stop offset="0.86" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="hillA" cx="42%" cy="18%" r="85%">
            <Stop offset="0" stopColor="#E9FF9C" />
            <Stop offset="0.28" stopColor="#A5E64A" />
            <Stop offset="0.7" stopColor="#52B523" />
            <Stop offset="1" stopColor="#2E8A14" />
          </RadialGradient>
          <RadialGradient id="hillB" cx="45%" cy="15%" r="85%">
            <Stop offset="0" stopColor="#D5FA7E" />
            <Stop offset="0.35" stopColor="#7FD235" />
            <Stop offset="1" stopColor="#2F8C16" />
          </RadialGradient>
          <RadialGradient id="hillC" cx="50%" cy="10%" r="90%">
            <Stop offset="0" stopColor="#B6F06A" />
            <Stop offset="0.5" stopColor="#5DBB2A" />
            <Stop offset="1" stopColor="#246F0F" />
          </RadialGradient>
          <SvgLinear id="sheen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </SvgLinear>
          <SvgLinear id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#CFF7FF" />
            <Stop offset="0.45" stopColor="#4FD2FF" />
            <Stop offset="1" stopColor="#0E8FD0" />
          </SvgLinear>
        </Defs>

        <Circle cx={w * 0.14} cy={h * 0.06} r={210} fill="url(#sun)" />
        <Circle cx={w * 0.4} cy={h * 0.27} r={26} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
        <Circle cx={w * 0.52} cy={h * 0.37} r={9} fill="#CFFFF0" fillOpacity={0.55} />
        <Circle cx={w * 0.66} cy={h * 0.48} r={44} fill="none" stroke="#FFE9A8" strokeOpacity={0.3} strokeWidth={3} />

        {bokeh.map((b, i) => (
          <Circle key={`k${i}`} cx={w * b.x} cy={h * b.y} r={b.r} fill="url(#bokeh)" opacity={b.o} />
        ))}

        {hills && (
          <G>
            <Ellipse cx={w * 0.78} cy={h + 120} rx={w * 0.85} ry={300} fill="url(#hillC)" />
            <Ellipse cx={w * 0.7} cy={h - 150} rx={w * 0.4} ry={40} fill="url(#sheen)" opacity={0.35} />
            {water && (
              <>
                <Path
                  d={`M${w * 1.05} ${h - 215} C ${w * 0.7} ${h - 205}, ${w * 0.55} ${h - 120}, ${w * 0.2} ${h - 125} S ${-w * 0.1} ${h - 40}, ${-w * 0.2} ${h - 30} L ${-w * 0.2} ${h + 40} L ${w * 1.1} ${h + 40} Z`}
                  fill="url(#water)"
                />
                <Flow d={`M${w * 1.02} ${h - 200} C ${w * 0.72} ${h - 190}, ${w * 0.56} ${h - 108}, ${w * 0.22} ${h - 112}`} width={3} opacity={0.75} speed={2600} />
                <Flow d={`M${w * 0.9} ${h - 180} C ${w * 0.75} ${h - 165}, ${w * 0.6} ${h - 110}, ${w * 0.4} ${h - 98}`} width={1.5} opacity={0.45} speed={3400} />
              </>
            )}
            <Ellipse cx={w * 0.22} cy={h + 60} rx={w * 0.72} ry={190} fill="url(#hillA)" />
            <Ellipse cx={w * 0.2} cy={h - 110} rx={w * 0.4} ry={32} fill="url(#sheen)" />
            <Ellipse cx={w * 1.02} cy={h + 90} rx={w * 0.58} ry={165} fill="url(#hillB)" />
            <Ellipse cx={w * 0.98} cy={h - 56} rx={w * 0.3} ry={24} fill="url(#sheen)" opacity={0.8} />
            {[0.06, 0.11, 0.3, 0.36, 0.58, 0.63, 0.88].map((x, i) => (
              <Path
                key={`g${i}`}
                d={`M${w * x} ${h - 20 - (i % 3) * 6} q ${6 + (i % 2) * 5} -34 ${18 + (i % 3) * 6} -56`}
                fill="none"
                stroke="#E6FF9A"
                strokeOpacity={0.7}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
          </G>
        )}
      </Svg>

      {clouds && CLOUDS.map((c, i) => <Cloud key={i} {...c} width={w} height={h} seed={i} />)}
      <Rays width={w} height={h} />

      {bubbles.map((b, i) => (
        <Dew key={i} x={w * b.x} y={h * b.y} r={b.r} delay={i * 700} />
      ))}
      {drift > 0 && <Bubbles count={drift} />}
      {leaves && [0, 1, 2].map((s) => <DriftingLeaf key={s} width={w} height={h * 0.6} seed={s + 10} />)}
    </View>
  );
}

/** Sun rays that breathe: a slow swell in brightness and a drift of a degree or two about the sun. */
function Rays({ width: w, height: h }: { width: number; height: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 + p.value * 0.45, transform: [{ rotate: `${-1.5 + p.value * 3}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: `${w * 0.14}px ${h * 0.06}px` }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <SvgLinear id="ray" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </SvgLinear>
        </Defs>
        <Path d={`M${w * 0.14} ${h * 0.06} L${w * 0.9} ${h * 0.72} L${w * 1.1} ${h * 0.62} Z`} fill="url(#ray)" />
        <Path d={`M${w * 0.14} ${h * 0.06} L${w * 0.7} ${h * 0.9} L${w * 0.86} ${h * 0.86} Z`} fill="url(#ray)" opacity={0.6} />
        <Path d={`M${w * 0.14} ${h * 0.06} L${w * 0.45} ${h * 0.95} L${w * 0.55} ${h * 0.95} Z`} fill="url(#ray)" opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}

/** A cumulus cloud built from soft discs, crossing the sky at its depth's pace and looping round. */
function Cloud({ y, scale, speed, start, far, width: w, seed }: { y: number; scale: number; speed: number; start: number; far: boolean; width: number; height: number; seed: number }) {
  const p = useSharedValue(start);
  useEffect(() => {
    p.value = withSequence(withTiming(1, { duration: speed * (1 - start), easing: Easing.linear }), withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: speed, easing: Easing.linear })), -1));
  }, [p, speed, start]);
  const cw = 180 * scale;
  const ch = 70 * scale;
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -cw + p.value * (w + cw * 2) }] }));
  const puffs = useMemo(
    () =>
      [
        { cx: 0.25, cy: 0.7, r: 0.26 },
        { cx: 0.45, cy: 0.5, r: 0.36 },
        { cx: 0.68, cy: 0.62, r: 0.3 },
        { cx: 0.85, cy: 0.76, r: 0.2 },
        { cx: 0.12, cy: 0.82, r: 0.17 },
      ].map((d, i) => ({ ...d, cx: d.cx + (((seed * 7 + i * 3) % 5) - 2) * 0.01 })),
    [seed],
  );
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: y * 812 * (far ? 1 : 1), width: cw, height: ch, opacity: far ? 0.55 : 0.9 }, style]}>
      <Svg width={cw} height={ch} viewBox="0 0 180 70">
        <Defs>
          <RadialGradient id={`puff${seed}`} cx="40%" cy="35%" r="65%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.7" stopColor="#F2FAFF" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#CFE9FA" stopOpacity={0.85} />
          </RadialGradient>
        </Defs>
        {puffs.map((d, i) => (
          <Circle key={i} cx={d.cx * 180} cy={d.cy * 70} r={d.r * 70} fill={`url(#puff${seed})`} />
        ))}
        <Ellipse cx={90} cy={62} rx={78} ry={9} fill="#fff" />
      </Svg>
    </Animated.View>
  );
}

/** A highlight running down the stream: dashes sliding along the path. */
function Flow({ d, width, opacity, speed }: { d: string; width: number; opacity: number; speed: number }) {
  const off = useSharedValue(0);
  useEffect(() => {
    off.value = withRepeat(withTiming(-100, { duration: speed, easing: Easing.linear }), -1);
  }, [off, speed]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  return <AnimatedPath d={d} fill="none" stroke="#fff" strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" strokeDasharray="28 72" animatedProps={props} />;
}

/** A floating water droplet: refracted sky, a bright specular and a soft rim. */
function Dew({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) {
  const ty = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    ty.value = withDelay(
      0,
      withRepeat(withSequence(withTiming(-10, { duration: 2600 + delay, easing: ease }), withTiming(0, { duration: 2600 + delay, easing: ease })), -1),
    );
  }, [ty, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const d = r * 2;
  return (
    <Animated.View style={[{ position: 'absolute', left: x - r, top: y - r, width: d, height: d }, style]}>
      <Svg width={d} height={d} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="dewBody" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.05} />
            <Stop offset="0.7" stopColor="#B9EEFF" stopOpacity={0.12} />
            <Stop offset="0.86" stopColor="#FFD6F4" stopOpacity={0.3} />
            <Stop offset="0.93" stopColor="#B4FFE6" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0.9} />
          </RadialGradient>
          <RadialGradient id="dewSpec" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <SvgLinear id="dewBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="1" stopColor="#D9FFB0" stopOpacity={0.6} />
          </SvgLinear>
        </Defs>
        <Circle cx={50} cy={50} r={49} fill="url(#dewBody)" />
        <Circle cx={50} cy={50} r={38} fill="url(#dewBottom)" />
        <Ellipse cx={36} cy={30} rx={16} ry={10} fill="url(#dewSpec)" />
        <Circle cx={66} cy={66} r={5} fill="#fff" opacity={0.6} />
      </Svg>
    </Animated.View>
  );
}

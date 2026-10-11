import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Ellipse, Circle, Path, G } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { sky } from '../theme';

type Bubble = { x: number; y: number; r: number };

type Props = {
  /** show the glossy grass hills at the bottom */
  hills?: boolean;
  /** show the stream winding between the hills (needs hills) */
  water?: boolean;
  /** floating dew bubbles, positions as fractions of the screen */
  bubbles?: Bubble[];
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

export default function AeroBackground({ hills = true, water = true, bubbles = defaultBubbles, locations = [0, 0.3, 0.68, 1] }: Props) {
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
          <RadialGradient id="cloud" cx="50%" cy="60%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.75} />
            <Stop offset="0.6" stopColor="#fff" stopOpacity={0.35} />
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
          <SvgLinear id="ray" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </SvgLinear>
        </Defs>

        {/* sun, top-left, with a couple of lens rings drifting down-right */}
        <Circle cx={w * 0.14} cy={h * 0.06} r={210} fill="url(#sun)" />
        <Path d={`M${w * 0.14} ${h * 0.06} L${w * 0.9} ${h * 0.72} L${w * 1.1} ${h * 0.62} Z`} fill="url(#ray)" />
        <Path d={`M${w * 0.14} ${h * 0.06} L${w * 0.7} ${h * 0.9} L${w * 0.86} ${h * 0.86} Z`} fill="url(#ray)" opacity={0.6} />
        <Circle cx={w * 0.4} cy={h * 0.27} r={26} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
        <Circle cx={w * 0.52} cy={h * 0.37} r={9} fill="#CFFFF0" fillOpacity={0.55} />
        <Circle cx={w * 0.66} cy={h * 0.48} r={44} fill="none" stroke="#FFE9A8" strokeOpacity={0.3} strokeWidth={3} />

        {/* cloud wisps near the horizon */}
        <Ellipse cx={w * 0.8} cy={h * 0.2} rx={w * 0.34} ry={28} fill="url(#cloud)" />
        <Ellipse cx={w * 0.25} cy={h * 0.33} rx={w * 0.3} ry={20} fill="url(#cloud)" />

        {bokeh.map((b, i) => (
          <Circle key={`k${i}`} cx={w * b.x} cy={h * b.y} r={b.r} fill="url(#bokeh)" opacity={b.o} />
        ))}

        {hills && (
          <G>
            {/* far hill */}
            <Ellipse cx={w * 0.78} cy={h + 120} rx={w * 0.85} ry={300} fill="url(#hillC)" />
            <Ellipse cx={w * 0.7} cy={h - 150} rx={w * 0.4} ry={40} fill="url(#sheen)" opacity={0.35} />
            {/* stream */}
            {water && (
              <>
                <Path
                  d={`M${w * 1.05} ${h - 215} C ${w * 0.7} ${h - 205}, ${w * 0.55} ${h - 120}, ${w * 0.2} ${h - 125} S ${-w * 0.1} ${h - 40}, ${-w * 0.2} ${h - 30} L ${-w * 0.2} ${h + 40} L ${w * 1.1} ${h + 40} Z`}
                  fill="url(#water)"
                />
                <Path
                  d={`M${w * 1.02} ${h - 200} C ${w * 0.72} ${h - 190}, ${w * 0.56} ${h - 108}, ${w * 0.22} ${h - 112}`}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity={0.75}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <Path
                  d={`M${w * 0.9} ${h - 180} C ${w * 0.75} ${h - 165}, ${w * 0.6} ${h - 110}, ${w * 0.4} ${h - 98}`}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              </>
            )}
            {/* near hills */}
            <Ellipse cx={w * 0.22} cy={h + 60} rx={w * 0.72} ry={190} fill="url(#hillA)" />
            <Ellipse cx={w * 0.2} cy={h - 110} rx={w * 0.4} ry={32} fill="url(#sheen)" />
            <Ellipse cx={w * 1.02} cy={h + 90} rx={w * 0.58} ry={165} fill="url(#hillB)" />
            <Ellipse cx={w * 0.98} cy={h - 56} rx={w * 0.3} ry={24} fill="url(#sheen)" opacity={0.8} />
            {/* a few blades of grass catching the light */}
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

      {bubbles.map((b, i) => (
        <Dew key={i} x={w * b.x} y={h * b.y} r={b.r} delay={i * 700} />
      ))}
    </View>
  );
}

/** A floating water droplet: refracted sky, a bright specular and a soft rim. */
function Dew({ x, y, r, delay }: { x: number; y: number; r: number; delay: number }) {
  const ty = useSharedValue(0);
  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);
    ty.value = withRepeat(
      withSequence(withTiming(-10, { duration: 2600 + delay, easing: ease }), withTiming(0, { duration: 2600 + delay, easing: ease })),
      -1,
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
            <Stop offset="0.92" stopColor="#fff" stopOpacity={0.5} />
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

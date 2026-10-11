import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

const noise = (n: number, salt: number) => {
  const x = Math.sin(n * 91.7 + salt * 47.3) * 43758.5453;
  return x - Math.floor(x);
};

/** One soap bubble: clear body, iridescent rim, a bright specular top-left and a faint one bottom-right. */
function Bubble({ seed, width, height }: { seed: number; width: number; height: number }) {
  const p = useSharedValue(0);
  const size = 22 + noise(seed, 1) * 46;
  const x0 = width * (0.06 + noise(seed, 2) * 0.88);
  const drift = (noise(seed, 3) - 0.5) * 90;
  const dur = 14000 + noise(seed, 4) * 10000;
  useEffect(() => {
    p.value = withDelay(noise(seed, 5) * dur, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1));
  }, [p, dur, seed]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1,
      transform: [
        { translateX: x0 + Math.sin(t * Math.PI * 4 + seed) * 14 + drift * t },
        { translateY: height * 0.78 - t * height * 0.9 },
        { scale: 0.85 + Math.sin(t * Math.PI * 6) * 0.04 },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -size / 2, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`bb${seed}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.02} />
            <Stop offset="0.72" stopColor="#CDF4FF" stopOpacity={0.08} />
            <Stop offset="0.88" stopColor="#FFD6F4" stopOpacity={0.35} />
            <Stop offset="0.95" stopColor="#B4FFE6" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0.9} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#bb${seed})`} />
        <Path d="M22 36 A 30 30 0 0 1 36 22" fill="none" stroke="#fff" strokeOpacity={0.95} strokeWidth={5} strokeLinecap="round" />
        <Ellipse cx={66} cy={70} rx={9} ry={5} fill="#fff" opacity={0.45} transform="rotate(-35 66 70)" />
      </Svg>
    </Animated.View>
  );
}

/** Soap bubbles drifting up the screen, the Frutiger Aero signature. Cheap: a handful, transform-only. */
export default function Bubbles({ count = 6 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Bubble key={i} seed={i + 1} width={width} height={height} />
      ))}
    </View>
  );
}

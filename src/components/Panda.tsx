import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export type PandaPose = 'idle' | 'encourage' | 'thinking' | 'celebrate' | 'console';

type Props = {
  pose?: PandaPose;
  /** rendered width in px; height follows the 220×266 artboard */
  size?: number;
  /** head only (for bubbles and headers) */
  headOnly?: boolean;
  /** show the envelope in his paws (home screen) */
  envelope?: boolean;
  animated?: boolean;
};

const INK = '#1C1C1C';
const PAD = '#F5955A';
const BLUSH = '#F7A8B8';
const PHONE = '#5BB8E8';
const PHONE_LIGHT = '#8FD3F5';

function Foot({ cx }: { cx: number }) {
  return (
    <>
      <Ellipse cx={cx} cy={236} rx={26} ry={20} fill={INK} />
      <Ellipse cx={cx} cy={240} rx={12} ry={9} fill={PAD} />
      <Circle cx={cx - 12} cy={227} r={4} fill={PAD} />
      <Circle cx={cx} cy={223} r={4} fill={PAD} />
      <Circle cx={cx + 12} cy={227} r={4} fill={PAD} />
    </>
  );
}

function Paw({ cx, cy, r = 14 }: { cx: number; cy: number; r?: number }) {
  const s = r / 14;
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} fill={INK} />
      <Ellipse cx={cx} cy={cy + 3 * s} rx={7 * s} ry={5 * s} fill={PAD} />
      <Circle cx={cx - 7 * s} cy={cy - 6 * s} r={2.5 * s} fill={PAD} />
      <Circle cx={cx} cy={cy - 9 * s} r={2.5 * s} fill={PAD} />
      <Circle cx={cx + 7 * s} cy={cy - 6 * s} r={2.5 * s} fill={PAD} />
    </>
  );
}

function Head({ pose }: { pose: PandaPose }) {
  const happy = pose === 'celebrate';
  const sad = pose === 'console';
  const think = pose === 'thinking';
  const dy = sad ? 2 : 0;
  return (
    <G transform={sad ? 'rotate(6 110 150)' : undefined}>
      <Circle cx={50} cy={44} r={24} fill={INK} />
      <Circle cx={170} cy={44} r={24} fill={INK} />
      <Path d="M38 100 Q38 24 110 24 Q182 24 182 100" fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" />
      <Path d="M38 100 Q38 24 110 24 Q182 24 182 100" fill="none" stroke="#4A4A4A" strokeWidth={4} strokeLinecap="round" />
      <Ellipse cx={110} cy={100} rx={70} ry={64} fill="#fff" stroke={INK} strokeWidth={3.5} />
      <Rect x={24} y={82} width={24} height={44} rx={9} fill={PHONE} stroke={INK} strokeWidth={3.5} />
      <Rect x={30} y={90} width={8} height={28} rx={4} fill={PHONE_LIGHT} />
      <Rect x={172} y={82} width={24} height={44} rx={9} fill={PHONE} stroke={INK} strokeWidth={3.5} />
      <Rect x={178} y={90} width={8} height={28} rx={4} fill={PHONE_LIGHT} />
      <Ellipse cx={84} cy={102} rx={22} ry={27} fill={INK} transform="rotate(-14 84 102)" />
      <Ellipse cx={136} cy={102} rx={22} ry={27} fill={INK} transform="rotate(14 136 102)" />
      {happy ? (
        <>
          <Path d="M74 104 Q86 92 98 104" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
          <Path d="M122 104 Q134 92 146 104" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={86} cy={102 + dy} r={10} fill="#fff" />
          <Circle cx={134} cy={102 + dy} r={10} fill="#fff" />
          <Circle cx={87 + (think ? 1 : 0)} cy={103 + dy - (think ? 4 : 0)} r={6.5} fill={INK} />
          <Circle cx={133 + (think ? 3 : 0)} cy={103 + dy - (think ? 4 : 0)} r={6.5} fill={INK} />
          <Circle cx={84 + (think ? 1 : 0)} cy={99 + dy - (think ? 4 : 0)} r={2.6} fill="#fff" />
          <Circle cx={130 + (think ? 3 : 0)} cy={99 + dy - (think ? 4 : 0)} r={2.6} fill="#fff" />
        </>
      )}
      {sad && (
        <>
          <Path d="M72 78 Q84 72 96 78" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <Path d="M124 78 Q136 72 148 78" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      <Ellipse cx={60} cy={128} rx={11} ry={6} fill={BLUSH} />
      <Ellipse cx={160} cy={128} rx={11} ry={6} fill={BLUSH} />
      <Path d="M104 121 Q110 118 116 121 Q113 128 110 129 Q107 128 104 121 Z" fill={INK} />
      {think ? (
        <Path d="M103 138 L117 138" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : sad ? (
        <Path d="M103 139 Q110 135 117 139" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : happy ? (
        <>
          <Path d="M98 133 Q110 154 122 133 Z" fill={INK} />
          <Path d="M104 141 Q110 149 116 141 Z" fill="#F08A9B" />
        </>
      ) : (
        <>
          <Path d="M102 135 Q110 146 118 135 Z" fill={INK} />
          <Path d="M106 138 Q110 143 114 138 Z" fill="#F08A9B" />
        </>
      )}
    </G>
  );
}

function Envelope() {
  return (
    <G transform="rotate(-4 110 206)">
      <Rect x={72} y={180} width={76} height={50} rx={7} fill="#fff" stroke={INK} strokeWidth={3} />
      <Path d="M74 185 L110 211 L146 185" fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={110} cy={208} r={8} fill={PHONE} stroke={INK} strokeWidth={2.5} />
    </G>
  );
}

export default function Panda({ pose = 'idle', size = 180, headOnly = false, envelope = false, animated = true }: Props) {
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const sc = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(ty);
    cancelAnimation(rot);
    cancelAnimation(sc);
    ty.value = 0;
    rot.value = 0;
    sc.value = 1;
    if (!animated) return;
    const ease = Easing.inOut(Easing.ease);
    switch (pose) {
      case 'idle':
      case 'console':
        ty.value = withRepeat(withSequence(withTiming(-6, { duration: 1600, easing: ease }), withTiming(0, { duration: 1600, easing: ease })), -1);
        break;
      case 'encourage':
        rot.value = withRepeat(withSequence(withTiming(4, { duration: 900, easing: ease }), withTiming(0, { duration: 900, easing: ease })), -1);
        break;
      case 'thinking':
        rot.value = withRepeat(withSequence(withTiming(-6, { duration: 1500, easing: ease }), withTiming(0, { duration: 1500, easing: ease })), -1);
        break;
      case 'celebrate':
        ty.value = withRepeat(
          withSequence(withTiming(-18, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 420, easing: Easing.bounce }), withTiming(0, { duration: 500 })),
          -1,
        );
        sc.value = withRepeat(withSequence(withTiming(1.04, { duration: 380 }), withTiming(0.97, { duration: 420 }), withTiming(1, { duration: 500 })), -1);
        break;
    }
  }, [pose, animated, ty, rot, sc]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }],
  }));

  const vb = headOnly ? '16 12 188 156' : '0 0 220 266';
  const h = headOnly ? size * (156 / 188) : size * (266 / 220);

  const armsUp = pose === 'celebrate';
  const thumbs = pose === 'encourage';
  const chin = pose === 'thinking';
  const reach = pose === 'console';

  return (
    <Animated.View style={[{ width: size, height: h, transformOrigin: 'bottom' }, style]}>
      <Svg width={size} height={h} viewBox={vb}>
        {!headOnly && (
          <>
            <Ellipse cx={110} cy={258} rx={78} ry={8} fill="rgba(0,40,80,0.18)" />
            <Foot cx={70} />
            <Foot cx={150} />
            <Ellipse cx={110} cy={198} rx={60} ry={52} fill="#fff" stroke={INK} strokeWidth={3.5} />
            <Ellipse cx={110} cy={210} rx={38} ry={34} fill="#EEF0F2" />
            {/* left arm */}
            {armsUp ? (
              <>
                <Ellipse cx={46} cy={168} rx={15} ry={34} fill={INK} transform="rotate(40 46 168)" />
                <Paw cx={28} cy={142} />
              </>
            ) : (
              <Ellipse cx={58} cy={196} rx={15} ry={32} fill={INK} transform="rotate(22 58 196)" />
            )}
            {/* right arm */}
            {armsUp ? (
              <>
                <Ellipse cx={174} cy={168} rx={15} ry={34} fill={INK} transform="rotate(-40 174 168)" />
                <Paw cx={192} cy={142} />
              </>
            ) : thumbs ? (
              <>
                <Ellipse cx={168} cy={188} rx={15} ry={32} fill={INK} transform="rotate(-45 168 188)" />
                <Circle cx={188} cy={164} r={13} fill={INK} />
                <Rect x={184} y={138} width={9} height={22} rx={4.5} fill={INK} />
                <Ellipse cx={188} cy={167} rx={6} ry={4} fill={PAD} />
              </>
            ) : reach ? (
              <>
                <Ellipse cx={172} cy={202} rx={15} ry={32} fill={INK} transform="rotate(-78 172 202)" />
                <Circle cx={202} cy={196} r={13} fill={INK} />
                <Ellipse cx={202} cy={199} rx={6} ry={4} fill={PAD} />
              </>
            ) : chin ? null : (
              <Ellipse cx={162} cy={196} rx={15} ry={32} fill={INK} transform="rotate(-22 162 196)" />
            )}
          </>
        )}
        <Head pose={pose} />
        {!headOnly && chin && (
          <>
            <Ellipse cx={166} cy={168} rx={15} ry={34} fill={INK} transform="rotate(-60 166 168)" />
            <Circle cx={138} cy={142} r={13} fill={INK} />
            <Ellipse cx={138} cy={145} rx={6} ry={4} fill={PAD} />
          </>
        )}
        {!headOnly && envelope && (
          <>
            <Envelope />
            <Circle cx={78} cy={224} r={12} fill={INK} />
            <Circle cx={142} cy={224} r={12} fill={INK} />
            <Ellipse cx={78} cy={227} rx={6} ry={4} fill={PAD} />
            <Ellipse cx={142} cy={227} rx={6} ry={4} fill={PAD} />
          </>
        )}
        {!headOnly && !envelope && !armsUp && (
          <Path d="M186 126 Q198 180 186 232" fill="none" stroke={INK} strokeWidth={2.5} />
        )}
      </Svg>
      {pose === 'thinking' && <ThinkingDots />}
    </Animated.View>
  );
}

function ThinkingDots() {
  const d0 = useSharedValue(0.25);
  const d1 = useSharedValue(0.25);
  const d2 = useSharedValue(0.25);
  useEffect(() => {
    [d0, d1, d2].forEach((d, i) => {
      d.value = withRepeat(
        withSequence(withTiming(0.25, { duration: 200 * i }), withTiming(1, { duration: 350 }), withTiming(0.25, { duration: 600 })),
        -1,
      );
    });
  }, [d0, d1, d2]);
  const s0 = useAnimatedStyle(() => ({ opacity: d0.value }));
  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const dot = { backgroundColor: '#fff', borderWidth: 2, borderColor: INK, borderRadius: 99 };
  return (
    <View style={{ position: 'absolute', right: -14, top: -6 }}>
      <Animated.View style={[dot, { width: 10, height: 10, marginLeft: 0, marginTop: 30 }, s0]} />
      <Animated.View style={[dot, { width: 14, height: 14, marginLeft: 12, marginTop: -40 }, s1]} />
      <Animated.View style={[dot, { width: 18, height: 18, marginLeft: 28, marginTop: -34 }, s2]} />
    </View>
  );
}

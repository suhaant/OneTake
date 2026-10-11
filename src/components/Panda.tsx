import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, G, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  makeMutable,
  type SharedValue,
} from 'react-native-reanimated';
import type { Gesture } from '../voice';

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
  /** 0 shut .. 1 open; when given, the mouth follows it (see Coach in ../voice) */
  mouth?: SharedValue<number>;
  /** pulses at every word; the body leans into it */
  beat?: SharedValue<number>;
  /** what the arms do; defaults to the pose's own gesture */
  gesture?: Gesture;
};

const INK = '#1C1C1C';
const PAD = '#F5955A';
const BLUSH = '#F7A8B8';
const PHONE = '#2FB4F5';
const PHONE_EDGE = '#0A6DAE';
const PHONE_GLOW = '#5FE3FF';
const IRIS = '#2FA8F0';

/** Gradients for the gel look; one copy per Svg so each layer can reach them. */
function GelDefs() {
  return (
    <Defs>
      <LinearGradient id="gelCup" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#BFF4FF" />
        <Stop offset="0.45" stopColor="#3FC4F8" />
        <Stop offset="1" stopColor="#0E8FD6" />
      </LinearGradient>
      <RadialGradient id="gelGlow" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={PHONE_GLOW} stopOpacity={0.6} />
        <Stop offset="1" stopColor={PHONE_GLOW} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="gelWhite" cx="38%" cy="30%" r="75%">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.7" stopColor="#F4FAFF" />
        <Stop offset="1" stopColor="#D6E9F5" />
      </RadialGradient>
      <RadialGradient id="gelIris" cx="40%" cy="35%" r="65%">
        <Stop offset="0" stopColor="#9FE4FF" />
        <Stop offset="0.6" stopColor={IRIS} />
        <Stop offset="1" stopColor="#0B5FA8" />
      </RadialGradient>
    </Defs>
  );
}
const TONGUE = '#F08A9B';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const ZERO = makeMutable(0);

/** Shoulder pivots; an arm hangs 52 px below its pivot at rotation 0. */
const SHOULDER = { left: { x: 62, y: 170 }, right: { x: 158, y: 170 } } as const;
/** Arm rotations (degrees) per gesture: the left arm raises with positive angles, the right with negative. */
const ARMS: Record<Gesture | 'reach', { left: number; right: number }> = {
  none: { left: 18, right: -18 },
  wave: { left: 18, right: -150 },
  point: { left: 18, right: -92 },
  count: { left: 18, right: -160 },
  cheer: { left: 150, right: -150 },
  shrug: { left: 62, right: -62 },
  thumbs: { left: 18, right: -118 },
  reach: { left: 18, right: -72 },
};

function defaultGesture(pose: PandaPose): Gesture | 'reach' | 'chin' {
  switch (pose) {
    case 'celebrate':
      return 'cheer';
    case 'encourage':
      return 'thumbs';
    case 'console':
      return 'reach';
    case 'thinking':
      return 'chin';
    default:
      return 'none';
  }
}

function Foot({ cx }: { cx: number }) {
  return (
    <>
      <Ellipse cx={cx} cy={236} rx={26} ry={20} fill={INK} />
      <Ellipse cx={cx - 9} cy={226} rx={8} ry={4} fill="#fff" opacity={0.3} />
      <Ellipse cx={cx} cy={240} rx={12} ry={9} fill={PAD} />
      <Ellipse cx={cx - 3} cy={237} rx={4} ry={2.5} fill="#fff" opacity={0.5} />
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

/**
 * One arm, drawn hanging straight down from its shoulder in its own layer and rotated about the
 * shoulder with a view transform (react-native-svg resolves transforms in JS, so they cannot be
 * driven from the UI thread the way `d` and `ry` can).
 */
function Arm({ side, rotation, thumb, size, height }: { side: 'left' | 'right'; rotation: SharedValue<number>; thumb: boolean; size: number; height: number }) {
  const { x, y } = SHOULDER[side];
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${(x / 220) * 100}% ${(y / 266) * 100}%` }, style]}>
      <Svg width={size} height={height} viewBox="0 0 220 266">
        <Ellipse cx={x} cy={y + 26} rx={15} ry={30} fill={INK} />
        <Ellipse cx={x - 5} cy={y + 12} rx={4} ry={10} fill="#fff" opacity={0.28} />
        <Paw cx={x} cy={y + 52} />
        {thumb && <Rect x={x + 10} y={y + 42} width={9} height={22} rx={4.5} fill={INK} transform={`rotate(-100 ${x + 14} ${y + 53})`} />}
      </Svg>
    </Animated.View>
  );
}

/** The mouth follows the voice: a smile when shut, opening wider on vowels, with the tongue showing. */
function TalkingMouth({ mouth, pose }: { mouth: SharedValue<number>; pose: PandaPose }) {
  const sad = pose === 'console';
  const lips = useAnimatedProps(() => {
    const m = mouth.value;
    const w = 8 + 6 * m;
    const h = (sad ? 5 : 9) + 20 * m;
    const top = sad && m < 0.15 ? 139 : 134;
    const lift = sad ? -4 * (1 - m) : 0;
    return { d: `M${110 - w} ${top} Q110 ${top + lift} ${110 + w} ${top} Q110 ${top + h} ${110 - w} ${top} Z` };
  });
  const tongue = useAnimatedProps(() => {
    const m = mouth.value;
    const w = 3 + 4 * m;
    const h = 2 + 10 * m;
    return { d: `M${110 - w} ${146 + 4 * m} Q110 ${146 + 4 * m + h} ${110 + w} ${146 + 4 * m} Z`, opacity: Math.min(1, m * 1.6) };
  });
  return (
    <>
      <AnimatedPath animatedProps={lips} fill={INK} />
      <AnimatedPath animatedProps={tongue} fill={TONGUE} />
    </>
  );
}

function Head({ pose, mouth, blink }: { pose: PandaPose; mouth?: SharedValue<number>; blink: SharedValue<number> }) {
  const happy = pose === 'celebrate';
  const sad = pose === 'console';
  const think = pose === 'thinking';
  const dy = sad ? 2 : 0;
  const lidL = useAnimatedProps(() => ({ ry: 11.5 * blink.value }));
  const lidR = useAnimatedProps(() => ({ ry: 11.5 * blink.value }));
  return (
    <G transform={sad ? 'rotate(6 110 150)' : undefined}>
      <GelDefs />
      <Circle cx={50} cy={44} r={24} fill={INK} />
      <Circle cx={170} cy={44} r={24} fill={INK} />
      <Ellipse cx={42} cy={34} rx={9} ry={5} fill="#fff" opacity={0.35} transform="rotate(-30 42 34)" />
      <Ellipse cx={162} cy={34} rx={9} ry={5} fill="#fff" opacity={0.35} transform="rotate(-30 162 34)" />
      {/* headband: a glow, a translucent blue tube, a bright line of light along its top */}
      <Path d="M38 100 Q38 24 110 24 Q182 24 182 100" fill="none" stroke={PHONE_GLOW} strokeOpacity={0.35} strokeWidth={20} strokeLinecap="round" />
      <Path d="M38 100 Q38 24 110 24 Q182 24 182 100" fill="none" stroke={PHONE_EDGE} strokeWidth={13} strokeLinecap="round" />
      <Path d="M38 100 Q38 24 110 24 Q182 24 182 100" fill="none" stroke={PHONE} strokeWidth={9} strokeLinecap="round" />
      <Path d="M44 96 Q44 30 110 30 Q176 30 176 96" fill="none" stroke="#DFF9FF" strokeOpacity={0.9} strokeWidth={2.5} strokeLinecap="round" />
      <Ellipse cx={110} cy={100} rx={70} ry={64} fill="url(#gelWhite)" stroke={INK} strokeWidth={3.5} />
      <Ellipse cx={82} cy={58} rx={26} ry={11} fill="#fff" opacity={0.75} transform="rotate(-18 82 58)" />
      {/* earcups: glow behind, gel body, a window of light */}
      <Ellipse cx={36} cy={104} rx={22} ry={32} fill="url(#gelGlow)" />
      <Ellipse cx={184} cy={104} rx={22} ry={32} fill="url(#gelGlow)" />
      <Rect x={22} y={80} width={28} height={48} rx={11} fill="url(#gelCup)" stroke={PHONE_EDGE} strokeWidth={2.5} />
      <Rect x={28} y={87} width={9} height={30} rx={4.5} fill="#E8FBFF" opacity={0.85} />
      <Rect x={170} y={80} width={28} height={48} rx={11} fill="url(#gelCup)" stroke={PHONE_EDGE} strokeWidth={2.5} />
      <Rect x={176} y={87} width={9} height={30} rx={4.5} fill="#E8FBFF" opacity={0.85} />
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
          <Circle cx={87 + (think ? 1 : 0)} cy={103 + dy - (think ? 4 : 0)} r={8} fill="url(#gelIris)" />
          <Circle cx={133 + (think ? 3 : 0)} cy={103 + dy - (think ? 4 : 0)} r={8} fill="url(#gelIris)" />
          <Circle cx={87 + (think ? 1 : 0)} cy={103 + dy - (think ? 4 : 0)} r={4.8} fill={INK} />
          <Circle cx={133 + (think ? 3 : 0)} cy={103 + dy - (think ? 4 : 0)} r={4.8} fill={INK} />
          <Circle cx={84 + (think ? 1 : 0)} cy={99 + dy - (think ? 4 : 0)} r={2.6} fill="#fff" />
          <Circle cx={130 + (think ? 3 : 0)} cy={99 + dy - (think ? 4 : 0)} r={2.6} fill="#fff" />
          {/* eyelids, the colour of the patches, close over the whites when he blinks */}
          <AnimatedEllipse cx={86} cy={102 + dy} rx={11.5} animatedProps={lidL} fill={INK} />
          <AnimatedEllipse cx={134} cy={102 + dy} rx={11.5} animatedProps={lidR} fill={INK} />
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
      {mouth ? (
        <TalkingMouth mouth={mouth} pose={pose} />
      ) : think ? (
        <Path d="M103 138 L117 138" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : sad ? (
        <Path d="M103 139 Q110 135 117 139" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : happy ? (
        <>
          <Path d="M98 133 Q110 154 122 133 Z" fill={INK} />
          <Path d="M104 141 Q110 149 116 141 Z" fill={TONGUE} />
        </>
      ) : (
        <>
          <Path d="M102 135 Q110 146 118 135 Z" fill={INK} />
          <Path d="M106 138 Q110 143 114 138 Z" fill={TONGUE} />
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

export default function Panda({ pose = 'idle', size = 180, headOnly = false, envelope = false, animated = true, mouth, beat, gesture }: Props) {
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const sc = useSharedValue(1);
  const blink = useSharedValue(0);
  const armL = useSharedValue(ARMS.none.left);
  const armR = useSharedValue(ARMS.none.right);
  const beatValue = beat ?? ZERO;
  const mouthValue = mouth ?? ZERO;

  const arms: Gesture | 'reach' | 'chin' = gesture ?? defaultGesture(pose);
  const chin = arms === 'chin';
  const thumb = arms === 'thumbs';

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
    if (arms === 'shrug') rot.value = withSequence(withTiming(-5, { duration: 300 }), withTiming(0, { duration: 500 }));
  }, [pose, arms, animated, ty, rot, sc]);

  // Arms: ease to the gesture, then keep it alive (a wave waves, a count bounces, a point nods).
  useEffect(() => {
    cancelAnimation(armL);
    cancelAnimation(armR);
    const target = arms === 'chin' ? ARMS.none : ARMS[arms];
    const ease = Easing.out(Easing.back(1.4));
    armL.value = withTiming(target.left, { duration: 420, easing: ease });
    const settle = withTiming(target.right, { duration: 420, easing: ease });
    const sway = Easing.inOut(Easing.ease);
    switch (animated ? arms : 'none') {
      case 'wave':
        armR.value = withSequence(settle, withRepeat(withSequence(withTiming(target.right + 22, { duration: 260, easing: sway }), withTiming(target.right - 8, { duration: 260, easing: sway })), -1));
        break;
      case 'point':
        armR.value = withSequence(settle, withRepeat(withSequence(withTiming(target.right + 7, { duration: 700, easing: sway }), withTiming(target.right, { duration: 700, easing: sway })), -1));
        break;
      case 'count':
        armR.value = withSequence(settle, withRepeat(withSequence(withTiming(target.right + 14, { duration: 450, easing: sway }), withTiming(target.right, { duration: 450, easing: sway })), -1));
        break;
      case 'cheer':
        armR.value = withSequence(settle, withRepeat(withSequence(withTiming(target.right + 10, { duration: 400, easing: sway }), withTiming(target.right, { duration: 400, easing: sway })), -1));
        armL.value = withSequence(withTiming(target.left, { duration: 420, easing: ease }), withRepeat(withSequence(withTiming(target.left - 10, { duration: 400, easing: sway }), withTiming(target.left, { duration: 400, easing: sway })), -1));
        break;
      default:
        armR.value = settle;
    }
  }, [arms, animated, armL, armR]);

  // He blinks every few seconds, a little sooner when excited.
  useEffect(() => {
    cancelAnimation(blink);
    blink.value = 0;
    if (!animated) return;
    const gap = pose === 'celebrate' ? 2200 : 3400;
    blink.value = withRepeat(withSequence(withDelay(gap + Math.random() * 1500, withTiming(1, { duration: 70 })), withTiming(0, { duration: 110 })), -1);
  }, [pose, animated, blink]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: ty.value - mouthValue.value * 2 - beatValue.value * 3 },
      { rotate: `${rot.value + beatValue.value * (arms === 'count' ? 0 : 1.5)}deg` },
      { scale: sc.value },
      { scaleY: 1 - beatValue.value * 0.035 },
    ],
  }));

  const vb = headOnly ? '16 12 188 156' : '0 0 220 266';
  const h = headOnly ? size * (156 / 188) : size * (266 / 220);

  return (
    <Animated.View style={[{ width: size, height: h, transformOrigin: 'bottom' }, style]}>
      {!headOnly && (
        <>
          <Svg width={size} height={h} viewBox={vb} style={StyleSheet.absoluteFill}>
            <Ellipse cx={110} cy={258} rx={78} ry={8} fill="rgba(0,40,80,0.18)" />
            <Foot cx={70} />
            <Foot cx={150} />
            <GelDefs />
            <Ellipse cx={110} cy={198} rx={60} ry={52} fill="url(#gelWhite)" stroke={INK} strokeWidth={3.5} />
            <Ellipse cx={110} cy={210} rx={38} ry={34} fill="#EEF3F7" />
            <Ellipse cx={88} cy={168} rx={22} ry={9} fill="#fff" opacity={0.8} transform="rotate(-20 88 168)" />
          </Svg>
          <Arm side="left" rotation={armL} thumb={false} size={size} height={h} />
          {!chin && <Arm side="right" rotation={armR} thumb={thumb} size={size} height={h} />}
        </>
      )}
      <Svg width={size} height={h} viewBox={vb}>
        <Head pose={pose} mouth={mouth} blink={blink} />
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
        {!headOnly && !envelope && arms === 'none' && <Path d="M186 126 Q198 180 186 232" fill="none" stroke={INK} strokeWidth={2.5} />}
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

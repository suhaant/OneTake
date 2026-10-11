import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

type P = { size?: number; color?: string };

const stroke = (color = '#fff') => ({
  fill: 'none',
  stroke: color,
  strokeWidth: 2.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const Envelope = ({ size = 24, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={3} y={5} width={18} height={14} rx={2.5} {...stroke(color)} />
    <Path d="M3 7.5l9 6 9-6" {...stroke(color)} />
  </Svg>
);

export const Flame = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c0-3 1-6 2-9z"
      fill="#FF8A1F"
      stroke="#E05A00"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path d="M12 11c.6 2 2 2.5 2 4.3a2 2 0 0 1-4 0c0-1 .6-1.6.6-1.6s.4.8.9.8c0-1 .2-2.5.5-3.5z" fill="#FFE27A" />
  </Svg>
);

export const Gem = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2l7 4v12l-7 4-7-4V6z" fill="#3CC3F5" stroke="#0C6FB3" strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M12 2l7 4-7 4-7-4z" fill="#9BE8FF" />
  </Svg>
);

export const Crown = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#FFD23F" stroke="#D59A00" strokeWidth={1.5} strokeLinejoin="round" />
    <Rect x={5} y={17} width={14} height={3} fill="#FFB800" />
  </Svg>
);

export const Check = ({ size = 24, color = '#B56F00' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 12.5l4.5 4.5L19 7" {...stroke(color)} strokeWidth={3.4} />
  </Svg>
);

export const Lock = ({ size = 24, color = '#7E919F' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={5} y={11} width={14} height={10} rx={2} {...stroke(color)} />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" {...stroke(color)} />
  </Svg>
);

export const Friends = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={9} cy={8} r={3.5} fill="#B388FF" stroke="#7E57C2" strokeWidth={1.5} />
    <Path d="M2.5 20a6.5 6.5 0 0 1 13 0z" fill="#B388FF" stroke="#7E57C2" strokeWidth={1.5} strokeLinejoin="round" />
    <Circle cx={17} cy={9} r={3} fill="#80DEEA" stroke="#0097A7" strokeWidth={1.5} />
    <Path d="M15.5 14.5a5.5 5.5 0 0 1 6 5.5h-6z" fill="#80DEEA" stroke="#0097A7" strokeWidth={1.5} strokeLinejoin="round" />
  </Svg>
);

export const Profile = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={8} r={4} fill="#4FC3F7" stroke="#0C6FB3" strokeWidth={1.5} />
    <Path d="M4 21a8 8 0 0 1 16 0z" fill="#4FC3F7" stroke="#0C6FB3" strokeWidth={1.5} strokeLinejoin="round" />
  </Svg>
);

export const Back = ({ size = 22, color = '#1273B5' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M15 5l-7 7 7 7" {...stroke(color)} strokeWidth={2.4} />
  </Svg>
);

export const Close = ({ size = 20, color = '#1273B5' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 6l12 12M18 6L6 18" {...stroke(color)} strokeWidth={2.4} />
  </Svg>
);

export const Share = ({ size = 22, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" {...stroke(color)} />
    <Path d="M12 15V3M7 8l5-5 5 5" {...stroke(color)} />
  </Svg>
);

export const List = ({ size = 24, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...stroke(color)} strokeWidth={2.4} />
  </Svg>
);

export const Sound = ({ size = 22, color = '#1273B5', muted = false }: P & { muted?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill={color} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    {muted ? (
      <Path d="M16 9.5l5 5M21 9.5l-5 5" {...stroke(color)} />
    ) : (
      <>
        <Path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" {...stroke(color)} />
        <Path d="M18 7a7 7 0 0 1 0 10" {...stroke(color)} />
      </>
    )}
  </Svg>
);

export const colors = {
  navy: '#0B3D5C',
  text2: '#3B6786',
  muted: '#6F8CA3',
  hair: '#D6EAF5',
  blue: '#1273B5',
  blueMid: '#1E9EE6',
  blueLight: '#5BD2FF',
  blueDeep: '#0A5F99',
  aqua: '#5FE3FF',
  aquaDeep: '#0FA8DE',
  green: '#58CC02',
  greenLight: '#C6FF7A',
  greenDark: '#3E9A0A',
  greenText: '#2E7D11',
  lime: '#D8FF66',
  leaf: '#3FA51C',
  yellow: '#FFD23F',
  yellowDark: '#C98F00',
  orange: '#E8731A',
  white: '#FFFFFF',
  sheet: '#F2F9FE',
  pandaBlue: '#5BB8E8',
  pandaPad: '#F5955A',
  pandaBlush: '#F7A8B8',
  ink: '#1C1C1C',
};

/** Vista-wallpaper sky: deep cobalt at the zenith, bright near the horizon. */
export const sky = ['#1C7FD6', '#43B5F4', '#9CE6FF', '#E7FBFF'] as const;

/** Gradient faces shared by the glossy surfaces. */
export const gradients = {
  glass: ['rgba(255,255,255,0.92)', 'rgba(235,250,255,0.78)', 'rgba(205,240,255,0.72)'] as const,
  glassDeep: ['rgba(255,255,255,0.55)', 'rgba(190,236,255,0.45)', 'rgba(140,220,255,0.5)'] as const,
  aqua: ['#9FF1FF', '#3CCBF7', '#0E9BDC'] as const,
  lime: ['#E6FF8A', '#8BE534', '#45B41C'] as const,
  sun: ['#FFF6B0', '#FFD84A', '#F3A400'] as const,
  chrome: ['#FFFFFF', '#E6F3FA', '#C8DEEA', '#F2F9FD'] as const,
};

export const fonts = {
  regular: 'Hind_400Regular',
  medium: 'Hind_500Medium',
  semi: 'Hind_600SemiBold',
  bold: 'Hind_700Bold',
  display: 'Nunito_900Black',
  displayBold: 'Nunito_800ExtraBold',
};

export const radius = { card: 26, pill: 999 };

export const glassShadow = {
  shadowColor: '#0A4E8A',
  shadowOpacity: 0.22,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
};

/** Soft coloured halo under glowing buttons. */
export const glow = (color: string, opacity = 0.45) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
});

/** White text floating over the sky. */
export const skyText = {
  color: '#FFFFFF',
  textShadowColor: 'rgba(0,70,130,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 8,
};

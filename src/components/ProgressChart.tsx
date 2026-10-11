import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';

export type Point = { t: number; v: number; label: string };

const H = 190;
const PAD = { l: 30, r: 14, t: 18, b: 26 };

/** Least-squares line through the points, so a noisy week still shows which way it is heading. */
function trend(points: Point[]): { a: number; b: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const xs = points.map((_, i) => i);
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = points.reduce((s, p) => s + p.v, 0) / n;
  const num = points.reduce((s, p, i) => s + (xs[i] - mx) * (p.v - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1;
  const b = num / den;
  return { a: my - b * mx, b };
}

/** Glossy Aero line chart of scores over time: aqua area, white-rimmed dots, a dashed trend line. */
export default function ProgressChart({ points, width }: { points: Point[]; width: number }) {
  const w = width;
  const innerW = w - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const vals = points.map((p) => p.v);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 8) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 8) / 10) * 10);
  const x = (i: number) => PAD.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)} ${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)} ${(PAD.t + innerH).toFixed(1)} Z`;
  const tr = trend(points);
  const best = vals.indexOf(Math.max(...vals));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  // at most 5 x labels so they never collide
  const step = Math.max(1, Math.ceil(points.length / 5));

  return (
    <View>
      <Svg width={w} height={H}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5FE3FF" stopOpacity={0.55} />
            <Stop offset="0.6" stopColor="#3CCBF7" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#3CCBF7" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#0E9BDC" />
            <Stop offset="1" stopColor="#45B41C" />
          </LinearGradient>
        </Defs>
        {ticks.map((t) => (
          <React.Fragment key={t}>
            <Line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(11,61,92,0.1)" strokeWidth={1} />
            <SvgText x={PAD.l - 8} y={y(t) + 4} fontSize={11} fontFamily={fonts.semi} fill={colors.muted} textAnchor="end">
              {t}
            </SvgText>
          </React.Fragment>
        ))}
        {points.length > 1 && <Path d={area} fill="url(#area)" />}
        {tr && points.length > 2 && (
          <Line x1={x(0)} y1={y(tr.a)} x2={x(points.length - 1)} y2={y(tr.a + tr.b * (points.length - 1))} stroke="#3FA51C" strokeWidth={2} strokeDasharray="5 6" strokeOpacity={0.8} />
        )}
        {points.length > 1 && <Path d={d} fill="none" stroke="url(#stroke)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <React.Fragment key={p.t}>
            <Circle cx={x(i)} cy={y(p.v)} r={i === best ? 7 : 5} fill={i === best ? '#FFD93D' : '#fff'} stroke={i === best ? '#C98F00' : colors.blue} strokeWidth={2} />
            <Circle cx={x(i) - 1.5} cy={y(p.v) - 1.5} r={1.6} fill="#fff" opacity={0.9} />
            {i % step === 0 || i === points.length - 1 ? (
              <SvgText x={x(i)} y={H - 8} fontSize={11} fontFamily={fonts.semi} fill={colors.muted} textAnchor="middle">
                {p.label}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.blue }]} />
          <Text style={styles.legendText}>Score per take</Text>
        </View>
        {tr && points.length > 2 && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: '#3FA51C', width: 16, height: 2 }]} />
            <Text style={styles.legendText}>Trend</Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: '#FFD93D', borderColor: '#C98F00', borderWidth: 1 }]} />
          <Text style={styles.legendText}>Best</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
});

import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { colors } from '@/constants/theme';

// Rysujemy w stałym układzie 1600x900; `slice` przycina go do proporcji ekranu.
const W = 1600;
const H = 900;
const RAY_ORIGIN = { x: W / 2, y: 260 };
const RAY_COUNT = 18;

function starPath(cx: number, cy: number, outer: number, inner: number) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M${points.join('L')}Z`;
}

function sparklePath(cx: number, cy: number, r: number) {
  const k = r * 0.22;
  return `M${cx},${cy - r} Q${cx + k},${cy - k} ${cx + r},${cy} Q${cx + k},${cy + k} ${cx},${cy + r} Q${cx - k},${cy + k} ${cx - r},${cy} Q${cx - k},${cy - k} ${cx},${cy - r}Z`;
}

function rayPaths() {
  const length = 2000;
  const step = (Math.PI * 2) / RAY_COUNT;
  const half = step / 4;
  const paths: string[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = step * i;
    const { x, y } = RAY_ORIGIN;
    const x1 = x + length * Math.cos(a - half);
    const y1 = y + length * Math.sin(a - half);
    const x2 = x + length * Math.cos(a + half);
    const y2 = y + length * Math.sin(a + half);
    paths.push(`M${x},${y}L${x1},${y1}L${x2},${y2}Z`);
  }
  return paths;
}

const RAYS = rayPaths();

const STARS = [
  { x: 150, y: 140, r: 34, rot: -12 },
  { x: 1440, y: 190, r: 26, rot: 15 },
  { x: 260, y: 700, r: 22, rot: 8 },
  { x: 1340, y: 720, r: 38, rot: -20 },
  { x: 1180, y: 90, r: 16, rot: 0 },
];

const SPARKLES = [
  { x: 380, y: 120, r: 14 },
  { x: 1520, y: 420, r: 18 },
  { x: 90, y: 450, r: 16 },
  { x: 1080, y: 820, r: 12 },
  { x: 520, y: 830, r: 15 },
  { x: 1250, y: 330, r: 10 },
];

const QUESTION_MARKS = [
  { x: 330, y: 400, size: 120, rot: -18 },
  { x: 1290, y: 540, size: 140, rot: 14 },
  { x: 1500, y: 860, size: 90, rot: -8 },
  { x: 70, y: 860, size: 100, rot: 12 },
];

const DOTS = [
  { x: 470, y: 260, r: 5 },
  { x: 1120, y: 230, r: 6 },
  { x: 200, y: 300, r: 4 },
  { x: 1420, y: 600, r: 5 },
  { x: 640, y: 720, r: 4 },
  { x: 960, y: 760, r: 6 },
];

export function CartoonBackground() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <RadialGradient id="bg" cx="50%" cy="30%" rx="75%" ry="85%">
          <Stop offset="0" stopColor={colors.navyLight} />
          <Stop offset="0.55" stopColor={colors.navy} />
          <Stop offset="1" stopColor={colors.navyDeep} />
        </RadialGradient>
        <RadialGradient id="spot" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={colors.sky} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.sky} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="0" y="0" width={W} height={H} fill="url(#bg)" />

      {/* Promienie jak w studiu teleturnieju */}
      <G fill={colors.white} opacity={0.05}>
        {RAYS.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>

      {/* Poświata za tytułem */}
      <Ellipse cx={RAY_ORIGIN.x} cy={RAY_ORIGIN.y} rx="520" ry="300" fill="url(#spot)" />

      {/* Scena na dole */}
      <Ellipse cx={W / 2} cy={H + 120} rx="900" ry="260" fill={colors.navyDeep} opacity={0.7} />
      <Ellipse
        cx={W / 2}
        cy={H + 120}
        rx="900"
        ry="260"
        fill="none"
        stroke={colors.sky}
        strokeOpacity={0.25}
        strokeWidth={6}
        strokeDasharray="4 22"
        strokeLinecap="round"
      />

      {QUESTION_MARKS.map((q, i) => (
        <SvgText
          key={i}
          x={q.x}
          y={q.y}
          fontSize={q.size}
          fontWeight="900"
          fill={colors.sky}
          fillOpacity={0.12}
          stroke={colors.sky}
          strokeOpacity={0.22}
          strokeWidth={4}
          textAnchor="middle"
          rotation={q.rot}
          origin={`${q.x}, ${q.y}`}
        >
          ?
        </SvgText>
      ))}

      {DOTS.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colors.sky} opacity={0.4} />
      ))}

      {SPARKLES.map((s, i) => (
        <Path key={i} d={sparklePath(s.x, s.y, s.r)} fill={colors.white} opacity={0.75} />
      ))}

      {STARS.map((s, i) => (
        <G key={i} rotation={s.rot} origin={`${s.x}, ${s.y}`}>
          {/* cień przesunięty w dół — efekt naklejki */}
          <Path d={starPath(s.x + 4, s.y + 6, s.r, s.r * 0.48)} fill={colors.outline} opacity={0.6} />
          <Path
            d={starPath(s.x, s.y, s.r, s.r * 0.48)}
            fill={colors.starYellow}
            stroke={colors.outline}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <Circle cx={s.x - s.r * 0.18} cy={s.y - s.r * 0.15} r={s.r * 0.12} fill={colors.white} opacity={0.8} />
        </G>
      ))}
    </Svg>
  );
}

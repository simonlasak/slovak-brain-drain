import React, { useMemo, useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { useLocale } from '../../lib/locale';

/**
 * Annual arrivals of Slovak CITIZENS, by destination, 2008 to 2023.
 *
 * A FLOW, AND ON A DIFFERENT DEFINITION FROM EVERY OTHER FIGURE IN THIS SECTION.
 * The map counts Slovak-born people present; this counts Slovak citizens recorded
 * arriving. They must never be added, netted, or drawn on one axis.
 *
 * WHY THE SERIES STARTS IN 2008, which is the whole reason this chart took as long
 * to justify as to draw. Three things are wrong with the earlier years:
 *
 * 1. The reporting panel grows. Five countries report in 1995, 29 by 2021, so a
 *    summed series rises partly because countries join it. Restricted to
 *    destinations reporting in EVERY year of the window, the panel is 4 countries
 *    from 1995, 17 from 2000, and 22 from 2008, and the 2008 panel still covers
 *    97.3 percent of what all reporting countries recorded in 2019, against 93.3
 *    for the 2000 panel. Starting later buys both comparability and coverage.
 *
 * 2. Czechia's series is not migration before 2008. It runs 972 arrivals in 2000,
 *    12,967 in 2002, 23,735 in 2003, then settles at 5,000 to 7,000 from 2009. The
 *    held stock data refutes the spike arithmetically: over 2001 to 2004 the Czech
 *    register recorded 54,067 Slovak arrivals while the Slovak-citizen stock there
 *    rose from 23,381 to 33,148, a gain of 9,767. Arrivals cannot exceed the stock
 *    change by 44,300 in four years. The Eurostat stock series has its own break in
 *    the same place, falling 42,908 to 23,381 between 2000 and 2001. Something
 *    changed in what Czechia counted; this project does not have the document that
 *    says what, so the years are excluded rather than explained.
 *
 * 3. Switzerland steps from about 180 arrivals a year to 1,209 in 2008 and stays
 *    above 1,800, which is a level shift at exactly the window boundary.
 *
 * WHAT IS STRUCTURALLY MISSING, and it is not small: the United Kingdom appears in
 * this source for one year only (2013) and Ireland for none, while the UK is the
 * second-largest destination in the 2020 stock at 72,209 and Ireland the eighth at
 * 13,573. No flow chart built on this source can describe the two destinations that
 * absorbed most post-accession movement. That is a property of the source, not a
 * gap this chart can close, and the caption says so.
 *
 * COLOUR is assigned in fixed order by 2008-2023 volume (Germany, Czechia,
 * Austria), never cycled, and identity is carried by a legend plus an end label on
 * every line, never by hue alone.
 */

export interface ArrivalsSeries {
  code: string;
  name: string;
  points: { year: number; value: number }[];
}

export interface ArrivalsLabels {
  yAxis: string;
  tableToggle: string;
  tableYear: string;
}

interface Props {
  series: ArrivalsSeries[];
  labels: ArrivalsLabels;
}

/**
 * Locked design tokens, in fixed assignment order.
 *
 * These are `--accent-primary`, `--accent-secondary` and `--accent-tertiary-hover`
 * from 05-design.md. The palette validator passes the lightness band, the
 * colour-vision separation (worst all-pairs dE 12.8 protan, 17.9 normal, both well
 * above the dE 8 target) and, for two of three, contrast; it fails the chroma floor
 * on Tatra blue at 0.083 against 0.10, and warns that the gold is 2.92:1 against
 * cream rather than 3:1. Both are properties of the locked brand palette rather
 * than of this chart, so the required relief is built in instead: a legend, a
 * direct end label on every series, and a table view. `#B83A1F, #00699A, #A87F2C`
 * passes every check and is the swap to make if the design doc is ever reopened.
 */
const SERIES_COLORS = [
  'var(--accent-primary)',
  'var(--accent-secondary)',
  'var(--accent-tertiary-hover)',
];

function Chart({ series, labels, width, locale }: Props & { width: number; locale: string }) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  /**
   * Responsive margins. Below 560px the end labels are dropped and the right margin
   * collapses: at 358px a 104px label gutter plus a 54px axis gutter left only 200px
   * of plot, which is less than half the frame, and the year ticks collided. The
   * legend already carries identity, so the end labels are the redundant half of the
   * pair and they are what goes.
   */
  const compact = width < 560;
  const margin = compact
    ? { top: 10, right: 14, bottom: 34, left: 40 }
    : { top: 10, right: 104, bottom: 34, left: 54 };
  const height = compact
    ? Math.max(200, Math.round(width * 0.62))
    : Math.max(240, Math.min(360, Math.round(width * 0.42)));
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const years = useMemo(
    () => Array.from(new Set(series.flatMap(s => s.points.map(p => p.year)))).sort((a, b) => a - b),
    [series],
  );

  if (innerW <= 0 || !years.length) return null;

  const maxV = Math.max(...series.flatMap(s => s.points.map(p => p.value)), 1);
  const xScale = scaleLinear({ domain: [years[0], years[years.length - 1]], range: [0, innerW] });
  // Zero-based, because these are counts and a truncated baseline would exaggerate
  // the movement between them.
  const yScale = scaleLinear({ domain: [0, maxV * 1.08], range: [innerH, 0], nice: true });

  const fmt = (v: number) => Math.round(v).toLocaleString(locale);

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * innerW;
    const y0 = xScale.invert(x);
    let best = years[0];
    for (const y of years) if (Math.abs(y - y0) < Math.abs(best - y0)) best = y;
    setHoverYear(best);
  }

  const hovered = hoverYear
    ? series.map(s => ({ s, p: s.points.find(p => p.year === hoverYear) })).filter(x => x.p)
    : [];

  return (
    <svg width={width} height={height} role="img"
      aria-label="Annual recorded arrivals of Slovak citizens by destination, 2008 to 2023">
      <Group left={margin.left} top={margin.top}>
        {/* Grid drawn from the scale's own ticks rather than pulling in @visx/grid
            for four lines. Recessive, and behind every mark. */}
        {yScale.ticks(4).map(t => (
          <line key={t} x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)}
            stroke="var(--border-subtle)" strokeOpacity={0.7} />
        ))}

        {/* Crosshair sits under the marks so it never covers a line. */}
        {hoverYear !== null && (
          <line x1={xScale(hoverYear)} x2={xScale(hoverYear)} y1={0} y2={innerH}
            stroke="var(--text-tertiary)" strokeWidth={1} strokeDasharray="3 3" />
        )}

        {series.map((s, i) => (
          <LinePath
            key={s.code}
            data={s.points}
            x={p => xScale(p.year)}
            y={p => yScale(p.value)}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Markers only on the hovered year, never on every point. */}
        {hovered.map(({ s, p }) => {
          const i = series.indexOf(s);
          return (
            <circle key={s.code} cx={xScale(p!.year)} cy={yScale(p!.value)} r={4}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              stroke="var(--bg-page)" strokeWidth={2} />
          );
        })}

        {/* Direct end labels. A coloured dot carries identity; the words stay in
            text ink, per the rule that text never wears the series colour. */}
        {!compact && series.map((s, i) => {
          const last = s.points[s.points.length - 1];
          if (!last) return null;
          return (
            <g key={s.code} transform={`translate(${innerW + 10},${yScale(last.value)})`}>
              <circle cx={0} cy={0} r={3.5} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              <text x={9} y={0} dominantBaseline="middle" fontSize={11}
                fontFamily="var(--font-sans)" fill="var(--text-secondary)">
                {s.name}
              </text>
              <text x={9} y={13} dominantBaseline="middle" fontSize={10}
                fontFamily="var(--font-mono)" fill="var(--text-tertiary)">
                {fmt(last.value)}
              </text>
            </g>
          );
        })}

        {/* Axis label. The ticks read "5k", "10k", which needs a unit somewhere;
            horizontal at the top of the axis rather than rotated, because a rotated
            label costs more left margin than the words are worth. */}
        <text x={0} y={-1} textAnchor="start" fontSize={10}
          fontFamily="var(--font-sans)" fill="var(--text-tertiary)">
          {labels.yAxis}
        </text>

        <AxisLeft
          scale={yScale}
          numTicks={4}
          tickFormat={v => `${(Number(v) / 1000).toFixed(0)}k`}
          tickLabelProps={() => ({
            fontSize: 10, fontFamily: 'var(--font-mono)',
            fill: 'var(--text-tertiary)', textAnchor: 'end' as const, dx: -4, dy: 3,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
        <AxisBottom
          scale={xScale}
          top={innerH}
          numTicks={compact ? 4 : Math.min(8, years.length)}
          tickFormat={v => String(Math.round(Number(v)))}
          tickLabelProps={() => ({
            fontSize: 10, fontFamily: 'var(--font-mono)',
            fill: 'var(--text-tertiary)', textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />

        <rect x={0} y={0} width={innerW} height={innerH} fill="transparent"
          onMouseMove={handleMove} onMouseLeave={() => setHoverYear(null)} />
      </Group>

      {/* Tooltip. Placed in SVG rather than HTML so it cannot escape the figure,
          and flipped to the left of the crosshair once it would overflow. */}
      {hoverYear !== null && hovered.length > 0 && (() => {
        const cx = margin.left + xScale(hoverYear);
        const boxW = 132;
        const boxH = 20 + hovered.length * 15;
        const flip = cx + 12 + boxW > width;
        const bx = flip ? cx - 12 - boxW : cx + 12;
        return (
          <g transform={`translate(${bx},${margin.top + 6})`} pointerEvents="none">
            <rect width={boxW} height={boxH} rx={4} fill="var(--bg-surface)"
              stroke="var(--border-subtle)" />
            <text x={9} y={14} fontSize={11} fontFamily="var(--font-mono)"
              fill="var(--text-secondary)">{hoverYear}</text>
            {hovered.map(({ s, p }, k) => (
              <g key={s.code} transform={`translate(9,${26 + k * 15})`}>
                <circle cx={3} cy={-3} r={3.5}
                  fill={SERIES_COLORS[series.indexOf(s) % SERIES_COLORS.length]} />
                <text x={12} y={0} fontSize={11} fontFamily="var(--font-sans)"
                  fill="var(--text-secondary)">{s.name}</text>
                <text x={boxW - 18} y={0} textAnchor="end" fontSize={10.5}
                  fontFamily="var(--font-mono)" fill="var(--text-primary)">{fmt(p!.value)}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

export function DiasporaArrivalsChart({ series, labels }: Props) {
  const locale = useLocale();
  const years = Array.from(new Set(series.flatMap(s => s.points.map(p => p.year))))
    .sort((a, b) => a - b);
  const fmt = (v: number) => Math.round(v).toLocaleString(locale);

  return (
    <div className="arrivals-chart">
      {/* Legend is always present for more than one series, so identity never rests
          on colour alone. */}
      <ul className="arrivals-legend">
        {series.map((s, i) => (
          <li key={s.code}>
            <span className="arrivals-swatch"
              style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            {s.name}
          </li>
        ))}
      </ul>

      <ParentSize>
        {({ width }) => (
          <Chart series={series} labels={labels} width={width} locale={locale} />
        )}
      </ParentSize>

      {/* The table is the relief the contrast warning obliges, and it is also the
          only way to read an exact value without a pointer. */}
      <details className="arrivals-table">
        <summary>{labels.tableToggle}</summary>
        <div className="arrivals-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{labels.tableYear}</th>
                {series.map(s => <th key={s.code} scope="col">{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {years.map(y => (
                <tr key={y}>
                  <th scope="row">{y}</th>
                  {series.map(s => {
                    const p = s.points.find(q => q.year === y);
                    return <td key={s.code}>{p ? fmt(p.value) : '-'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

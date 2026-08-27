import React, { useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { useLocale } from '../../lib/locale';

interface Row {
  code: string;
  name: string;
  value: number;
  /** Percent change 1990 to 2020; null when there is no 1990 baseline. */
  growth: number | null;
}

type Mode = 'absolute' | 'growth';

/**
 * Horizontal bars for the top diaspora destinations. Two modes over the same
 * countries: absolute 2020 stock, and percent change since 1990. Growth is a
 * separate mode rather than a separate chart because the comparison the prose
 * makes is between the two orderings of the same list.
 */
function Chart({ data, width, mode, locale, animated }: {
  data: Row[];
  width: number;
  mode: Mode;
  locale: string;
  animated: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const rowH = 26;
  const margin = { top: 8, right: 76, bottom: 32, left: 104 };
  const innerW = width - margin.left - margin.right;
  const innerH = data.length * rowH;
  if (innerW <= 0) return null;

  const yScale = scaleBand({
    domain: data.map(d => d.code),
    range: [0, innerH],
    padding: 0.28,
  });

  const values = data.map(d => (mode === 'absolute' ? d.value : (d.growth ?? 0)));
  const maxV = Math.max(...values, 1);
  // Across the twelve destinations actually drawn, growth spans +50.8% (Canada)
  // to +8,853.6% (Spain), a factor of 174, so a linear axis renders the smaller
  // bars as hairlines. Log keeps every bar readable.
  //
  // The earlier comment here said 62% to 62,883% and named Norway. Both ends were
  // read off the full table rather than off this chart's slice: TOP_N is 12,
  // ranked by 2020 stock, and Norway is thirteenth, so it is not drawn at all.
  // Any range stated about a chart has to be computed from what the chart shows.
  const useLog = mode === 'growth';
  const xScale = useLog
    ? scaleLinear({ domain: [0, Math.log10(maxV + 1)], range: [0, innerW] })
    : scaleLinear({ domain: [0, maxV * 1.02], range: [0, innerW] });
  const barLen = (v: number) => (useLog ? xScale(Math.log10(Math.max(v, 0) + 1)) : xScale(v));

  const fmt = (v: number) =>
    mode === 'absolute'
      ? Math.round(v).toLocaleString(locale)
      : `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString(locale)}%`;

  return (
    <svg
      width={width}
      height={innerH + margin.top + margin.bottom}
      role="img"
      aria-label={
        mode === 'absolute'
          ? 'Slovak-born population by destination country, 2020'
          : 'Percent change in Slovak-born population by country, 1990 to 2020'
      }
    >
      <Group left={margin.left} top={margin.top}>
        {data.map((d, i) => {
          const v = mode === 'absolute' ? d.value : d.growth;
          const y = yScale(d.code) ?? 0;
          const isHot = hovered === d.code;
          // Bars grow from the axis in reading order, one row every 60ms, the same
          // cadence §1's wage bars use. Both modes of this chart mount separately, so
          // each gets its own run of the stagger rather than sharing one clock.
          const delay = i * 60;
          if (v === null) {
            return (
              <text
                key={d.code}
                x={0}
                y={y + yScale.bandwidth() / 2}
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="var(--font-sans)"
                fill="var(--text-tertiary)"
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease ${delay + 400}ms` : 'none' }}
              >
                no 1990 baseline
              </text>
            );
          }
          const finalW = Math.max(1, barLen(v));
          return (
            <g
              key={d.code}
              onMouseEnter={() => setHovered(d.code)}
              onMouseLeave={() => setHovered(null)}
            >
              <text
                x={-10}
                y={y + yScale.bandwidth() / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-sans)"
                fill={isHot ? 'var(--text-primary)' : 'var(--text-secondary)'}
              >
                {d.name}
              </text>
              <rect
                x={0}
                y={y}
                width={animated ? finalW : 0}
                height={yScale.bandwidth()}
                rx={2}
                fill={mode === 'absolute' ? 'var(--accent-secondary)' : 'var(--accent-primary)'}
                opacity={isHot ? 1 : 0.82}
                style={{
                  transition: animated
                    ? `width 0.5s cubic-bezier(0.2, 0, 0, 1) ${delay}ms`
                    : 'none',
                }}
              />
              {/* The value label is anchored to the FINAL bar length, not the animating
                  one, so it does not travel across the plot. It fades in once its bar
                  has arrived. */}
              <text
                x={finalW + 6}
                y={y + yScale.bandwidth() / 2}
                dominantBaseline="middle"
                fontSize={10.5}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease ${delay + 400}ms` : 'none' }}
              >
                {fmt(v)}
              </text>
            </g>
          );
        })}
        <AxisBottom
          scale={xScale}
          top={innerH}
          numTicks={4}
          tickFormat={v =>
            useLog
              ? `${Math.round(Math.pow(10, Number(v)) - 1).toLocaleString(locale)}%`
              : `${(Number(v) / 1000).toFixed(0)}k`
          }
          tickLabelProps={() => ({
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fill: 'var(--text-tertiary)',
            textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
      </Group>
    </svg>
  );
}

// `animated` defaults to true so that any caller which does not wrap this in
// AnimateOnScroll still gets the finished chart rather than an empty frame.
export function DiasporaRankedChart({ data, mode, animated = true }: { data: Row[]; mode: Mode; animated?: boolean }) {
  const locale = useLocale();
  return (
    <div style={{ width: '100%' }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} mode={mode} locale={locale} animated={animated} />}
      </ParentSize>
    </div>
  );
}

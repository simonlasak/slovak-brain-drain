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
function Chart({ data, width, mode, locale }: {
  data: Row[];
  width: number;
  mode: Mode;
  locale: string;
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
  // Growth spans 62% to 62,883%, so a linear axis renders everything except
  // Norway as a hairline. Log keeps every bar readable.
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
        {data.map(d => {
          const v = mode === 'absolute' ? d.value : d.growth;
          const y = yScale(d.code) ?? 0;
          const isHot = hovered === d.code;
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
              >
                no 1990 baseline
              </text>
            );
          }
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
                width={Math.max(1, barLen(v))}
                height={yScale.bandwidth()}
                rx={2}
                fill={mode === 'absolute' ? 'var(--accent-secondary)' : 'var(--accent-primary)'}
                opacity={isHot ? 1 : 0.82}
              />
              <text
                x={Math.max(1, barLen(v)) + 6}
                y={y + yScale.bandwidth() / 2}
                dominantBaseline="middle"
                fontSize={10.5}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
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

export function DiasporaRankedChart({ data, mode }: { data: Row[]; mode: Mode }) {
  const locale = useLocale();
  return (
    <div style={{ width: '100%' }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} mode={mode} locale={locale} />}
      </ParentSize>
    </div>
  );
}

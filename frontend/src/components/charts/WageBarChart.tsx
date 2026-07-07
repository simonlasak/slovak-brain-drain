import React, { useEffect, useState } from 'react';
import { scaleLinear, scaleBand } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { query, registerParquet } from '../../lib/db';

interface Row {
  geo_name: string;
  wage_eur: number;
}

interface TooltipData {
  x: number;
  y: number;
  geo_name: string;
  wage_eur: number;
}

const NATIONAL_AVG = 1524;

function colorFor(value: number): string {
  return value >= NATIONAL_AVG ? 'var(--accent-secondary)' : 'var(--accent-primary)';
}

function shortName(name: string): string {
  return name.replace('Region of ', '');
}

function Chart({ data, width, height, animated }: { data: Row[]; width: number; height: number; animated: boolean }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const margin = { top: 24, right: 56, bottom: 40, left: 160 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (innerW <= 0 || innerH <= 0) return null;

  const maxVal = Math.max(...data.map(d => d.wage_eur));
  const xScale = scaleLinear({ domain: [0, maxVal * 1.05], range: [0, innerW] });
  const yScale = scaleBand({
    domain: data.map(d => d.geo_name),
    range: [0, innerH],
    padding: 0.25,
  });

  const refX = xScale(NATIONAL_AVG);
  const barH = yScale.bandwidth();

  return (
    <svg width={width} height={height} role="img" aria-label="Bar chart of average monthly wage by Slovak region">
      <Group left={margin.left} top={margin.top}>
        {data.map((d, i) => {
          const y = yScale(d.geo_name) || 0;
          const finalW = xScale(d.wage_eur);
          const w = animated ? finalW : 0;
          const delay = i * 60;
          const isHovered = tooltip?.geo_name === d.geo_name;

          return (
            <g key={d.geo_name}>
              <text
                x={-12}
                y={y + barH / 2}
                fontSize={12}
                fontFamily="var(--font-sans)"
                fontWeight={500}
                fill="var(--text-primary)"
                dominantBaseline="middle"
                textAnchor="end"
              >
                {shortName(d.geo_name)}
              </text>
              <rect
                x={0}
                y={y}
                width={w}
                height={barH}
                fill={colorFor(d.wage_eur)}
                opacity={isHovered ? 1 : 0.9}
                rx={2}
                style={{
                  transition: animated
                    ? `width 0.5s cubic-bezier(0.2, 0, 0, 1) ${delay}ms`
                    : 'none',
                  cursor: 'default',
                }}
                onMouseEnter={() =>
                  setTooltip({
                    x: finalW / 2,
                    y: y + barH / 2,
                    geo_name: d.geo_name,
                    wage_eur: d.wage_eur,
                  })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={finalW + 8}
                y={y + barH / 2}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
                dominantBaseline="middle"
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease ${delay + 400}ms` : 'none' }}
              >
                {d.wage_eur.toLocaleString('en')}
              </text>
            </g>
          );
        })}

        <line
          x1={refX}
          x2={refX}
          y1={-6}
          y2={innerH + 6}
          stroke="var(--accent-tertiary)"
          strokeWidth={1.25}
          strokeDasharray="4,3"
        />
        <text
          x={refX - 6}
          y={-10}
          fontSize={11}
          fontFamily="var(--font-sans)"
          fontWeight={500}
          fill="var(--text-secondary)"
          textAnchor="end"
        >
          National average 1,524 EUR
        </text>

        {tooltip && (() => {
          const text = `${shortName(tooltip.geo_name)}: ${tooltip.wage_eur.toLocaleString('en')} EUR / month`;
          const charPx = 6.6;
          const padX = 12;
          const w = Math.ceil(text.length * charPx) + padX * 2;
          const half = w / 2;
          const cx = Math.min(Math.max(tooltip.x, half + 4), Math.max(innerW - half - 4, half + 4));
          return (
            <g pointerEvents="none">
              <rect
                x={cx - half}
                y={tooltip.y - 36}
                width={w}
                height={26}
                rx={4}
                fill="var(--bg-inverse)"
              />
              <text
                x={cx}
                y={tooltip.y - 19}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-inverse)"
              >
                {text}
              </text>
            </g>
          );
        })()}

        <AxisBottom
          scale={xScale}
          top={innerH}
          numTicks={5}
          tickFormat={v => `${Number(v).toLocaleString('en')}`}
          tickLabelProps={() => ({
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fill: 'var(--text-secondary)',
            textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
      </Group>
    </svg>
  );
}

export function WageBarChart({ animated = true }: { animated?: boolean }) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      await registerParquet('s1.parquet', '/data/section1_internal.parquet');
      const rows = (await query(`
        SELECT geo_name, value AS wage_eur
        FROM 's1.parquet'
        WHERE metric = 'avg_wage_eur'
          AND geo_level = 'kraj'
          AND year = 2024
        ORDER BY value DESC
      `)) as Row[];
      setData(rows);
    }
    load();
  }, []);

  if (data.length === 0) return null;

  const height = 24 + 40 + data.length * 36;

  return (
    <div style={{ width: '100%', height }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} height={height} animated={animated} />}
      </ParentSize>
    </div>
  );
}

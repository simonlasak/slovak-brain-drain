import React, { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { query, registerParquet } from '../../lib/db';

interface Row {
  geo_name: string;
  pct_change: number;
}

interface Placed extends Row {
  cx: number;
  cy: number;
}

interface TooltipData {
  cx: number;
  cy: number;
  geo_name: string;
  pct_change: number;
}

const DOT_RADIUS = 5;
const LABELLED_RIGHT = new Set([
  'District of Senec',
  'District of Pezinok',
]);
// Stacked top-to-bottom in the left annotation column.
const LABELLED_LEFT_ORDER = [
  'District of Snina',
  'District of Medzilaborce',
];
const LABELLED_LEFT = new Set(LABELLED_LEFT_ORDER);
const LABELLED = new Set([...LABELLED_RIGHT, ...LABELLED_LEFT]);

function colorFor(value: number): string {
  return value >= 0 ? 'var(--accent-secondary)' : 'var(--accent-primary)';
}

function shortName(name: string): string {
  return name.replace('District of ', '');
}

function placeDots(data: Row[], xScale: (n: number) => number, centerY: number, bandH: number): Placed[] {
  const sorted = [...data].sort((a, b) => a.pct_change - b.pct_change);
  const placed: Placed[] = [];
  const minGap = DOT_RADIUS * 2 + 1;
  const halfBand = bandH / 2 - DOT_RADIUS;

  for (const d of sorted) {
    const cx = xScale(d.pct_change);
    let chosen = centerY;
    let bestDist = Infinity;
    for (let step = 0; step <= halfBand; step += DOT_RADIUS) {
      const candidates = step === 0 ? [centerY] : [centerY - step, centerY + step];
      for (const cy of candidates) {
        const collides = placed.some(
          p => Math.abs(p.cx - cx) < minGap && Math.abs(p.cy - cy) < minGap
        );
        if (!collides) {
          chosen = cy;
          bestDist = step;
          break;
        }
      }
      if (bestDist !== Infinity) break;
    }
    placed.push({ ...d, cx, cy: chosen });
  }

  return placed.sort((a, b) => b.pct_change - a.pct_change);
}

function Chart({ data, width, height, animated }: { data: Row[]; width: number; height: number; animated: boolean }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const margin = { top: 32, right: 36, bottom: 44, left: 140 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const safeW = Math.max(innerW, 1);
  const safeH = Math.max(innerH, 1);

  const minVal = Math.min(...data.map(d => d.pct_change));
  const maxVal = Math.max(...data.map(d => d.pct_change));
  const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
  const xMin = -Math.ceil(absMax / 10) * 10;
  const xMax = Math.ceil(absMax / 10) * 10;

  const xScale = scaleLinear({ domain: [xMin, xMax], range: [0, safeW] });
  const centerY = safeH / 2;
  const zeroX = xScale(0);

  const placed = useMemo(
    () => placeDots(data, xScale, centerY, safeH * 0.85),
    [data, safeW, safeH]
  );

  if (innerW <= 0 || innerH <= 0) return null;

  return (
    <svg width={width} height={height} role="img" aria-label="Horizontal dot plot of population change by district 2004 to 2025">
      <Group left={margin.left} top={margin.top}>
        <line
          x1={zeroX}
          x2={zeroX}
          y1={0}
          y2={innerH}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
        <text
          x={zeroX + 6}
          y={12}
          fontSize={11}
          fontFamily="var(--font-sans)"
          fontWeight={500}
          fill="var(--text-secondary)"
        >
          0%
        </text>

        {placed.map((d, i) => {
          const isLabelled = LABELLED.has(d.geo_name);
          const isRightLabel = LABELLED_RIGHT.has(d.geo_name);
          const isHovered = tooltip?.geo_name === d.geo_name;
          const startCx = animated ? d.cx : zeroX;
          const delay = i * 8;

          return (
            <g key={d.geo_name}>
              <circle
                cx={animated ? d.cx : startCx}
                cy={d.cy}
                r={isHovered ? DOT_RADIUS + 2 : DOT_RADIUS}
                fill={colorFor(d.pct_change)}
                stroke={isLabelled ? 'var(--text-primary)' : 'none'}
                strokeWidth={isLabelled ? 1 : 0}
                opacity={animated ? (isHovered ? 1 : 0.9) : 0}
                style={{
                  transition: animated
                    ? `cx 0.4s cubic-bezier(0.2, 0, 0, 1) ${delay}ms, opacity 0.4s ease ${delay}ms, r 0.15s ease`
                    : 'r 0.15s ease',
                  cursor: 'default',
                }}
                onMouseEnter={() =>
                  setTooltip({ cx: d.cx, cy: d.cy, geo_name: d.geo_name, pct_change: d.pct_change })
                }
                onMouseLeave={() => setTooltip(null)}
              />
              {isRightLabel && (
                <text
                  x={d.cx}
                  y={d.cy - DOT_RADIUS - 8}
                  fontSize={12}
                  fontFamily="var(--font-sans)"
                  fontWeight={500}
                  fill="var(--text-primary)"
                  textAnchor="middle"
                  opacity={animated ? 1 : 0}
                  style={{ transition: animated ? `opacity 0.4s ease ${delay + 200}ms` : 'none' }}
                >
                  {shortName(d.geo_name)}
                </text>
              )}
            </g>
          );
        })}

        {/* Left-margin annotations with leader lines */}
        {LABELLED_LEFT_ORDER.map((name, idx) => {
          const target = placed.find(p => p.geo_name === name);
          if (!target) return null;
          const labelY = innerH * (idx === 0 ? 0.28 : 0.72);
          const labelX = -margin.left + 12;
          const textEndX = labelX + 90;
          return (
            <g key={`leader-${name}`} pointerEvents="none">
              <text
                x={labelX}
                y={labelY}
                fontSize={12}
                fontFamily="var(--font-sans)"
                fontWeight={500}
                fill="var(--text-primary)"
                dominantBaseline="middle"
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease 700ms` : 'none' }}
              >
                {shortName(name)}
              </text>
              <line
                x1={textEndX}
                y1={labelY}
                x2={target.cx - DOT_RADIUS - 2}
                y2={target.cy}
                stroke="var(--text-tertiary)"
                strokeWidth={0.5}
                opacity={animated ? 0.4 : 0}
                style={{ transition: animated ? `opacity 0.4s ease 700ms` : 'none' }}
              />
            </g>
          );
        })}

        {tooltip && (() => {
          const sign = tooltip.pct_change >= 0 ? '+' : '';
          const text = `${shortName(tooltip.geo_name)}: ${sign}${tooltip.pct_change.toFixed(1)}% since 2004`;
          const charPx = 6.6;
          const padX = 12;
          const w = Math.ceil(text.length * charPx) + padX * 2;
          const half = w / 2;
          const cx = Math.min(Math.max(tooltip.cx, half), Math.max(innerW - half, half));
          return (
            <g pointerEvents="none">
              <rect
                x={cx - half}
                y={tooltip.cy + DOT_RADIUS + 8}
                width={w}
                height={26}
                rx={4}
                fill="var(--bg-inverse)"
              />
              <text
                x={cx}
                y={tooltip.cy + DOT_RADIUS + 25}
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
          numTicks={7}
          tickFormat={v => `${Number(v) >= 0 ? '+' : ''}${v}%`}
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

export function RankedChangeChart({ animated = true }: { animated?: boolean }) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      await registerParquet('s1.parquet', '/data/section1_internal.parquet');
      const rows = (await query(`
        WITH pop AS (
          SELECT geo_name, geo_code, year, value
          FROM 's1.parquet'
          WHERE metric = 'population'
            AND geo_level = 'okres'
            AND year IN (2004, 2025)
            AND sex = 'all'
            AND age_bracket = 'all'
            AND education = 'all'
        )
        SELECT a.geo_name AS geo_name,
          a.geo_code AS geo_code,
          ROUND(100.0 * (b.value - a.value) / a.value, 1) AS pct_change
        FROM pop a
        JOIN pop b ON a.geo_code = b.geo_code
        WHERE a.year = 2004 AND b.year = 2025
        ORDER BY pct_change DESC
      `)) as { geo_name: string; geo_code: string; pct_change: number }[];

      const filtered = rows.filter(r => r.geo_code !== 'SK_CAP');
      setData(filtered.map(r => ({ geo_name: r.geo_name, pct_change: r.pct_change })));
    }
    load();
  }, []);

  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} height={300} animated={animated} />}
      </ParentSize>
    </div>
  );
}

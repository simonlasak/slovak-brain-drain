import React, { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { loadSeries } from '../../lib/chartData';

interface Row {
  geo_name: string;
  retention_pct: number;
}

interface Placed extends Row {
  cx: number;
  cy: number;
}

interface TooltipData {
  cx: number;
  cy: number;
  geo_name: string;
  retention_pct: number;
}

const DOT_RADIUS = 5;
// Half-width of the band around the median that is drawn in gold as "typical".
// Applied to the computed median rather than to a hardcoded centre.
const TYPICAL_BAND = 1;

// Median of the values actually plotted, so the reference line and its label
// cannot drift from the dots. This was a hardcoded 89 printed as "National
// median 89%" while the dots came from the parquet, the same defect as the wage
// chart's reference line.
function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
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

function colorFor(value: number, median: number): string {
  if (Math.abs(value - median) <= TYPICAL_BAND) return 'var(--accent-tertiary)';
  if (value > median) return 'var(--accent-secondary)';
  return 'var(--accent-primary)';
}

function shortName(name: string): string {
  return name.replace('District of ', '');
}

function placeDots(data: Row[], xScale: (n: number) => number, centerY: number, bandH: number): Placed[] {
  const sorted = [...data].sort((a, b) => a.retention_pct - b.retention_pct);
  const placed: Placed[] = [];
  const minGap = DOT_RADIUS * 2 + 1;
  const halfBand = bandH / 2 - DOT_RADIUS;

  for (const d of sorted) {
    const cx = xScale(d.retention_pct);
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

  return placed.sort((a, b) => b.retention_pct - a.retention_pct);
}

function Chart({ data, width, height, animated }: { data: Row[]; width: number; height: number; animated: boolean }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const margin = { top: 32, right: 36, bottom: 44, left: 140 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const safeW = Math.max(innerW, 1);
  const safeH = Math.max(innerH, 1);

  const median = medianOf(data.map(d => d.retention_pct));
  const minVal = Math.min(...data.map(d => d.retention_pct));
  const maxVal = Math.max(...data.map(d => d.retention_pct));
  const xMin = Math.floor(Math.min(minVal, 70) / 10) * 10;
  const xMax = Math.ceil(Math.max(maxVal, 240) / 10) * 10;

  const xScale = scaleLinear({ domain: [xMin, xMax], range: [0, safeW] });
  const centerY = safeH / 2;

  const placed = useMemo(
    () => placeDots(data, xScale, centerY, safeH * 0.85),
    [data, safeW, safeH]
  );

  if (innerW <= 0 || innerH <= 0) return null;

  const refX = xScale(median);

  return (
    <svg width={width} height={height} role="img" aria-label="Horizontal dot plot of cohort retention by district">
      <Group left={margin.left} top={margin.top}>
        <line
          x1={refX}
          x2={refX}
          y1={0}
          y2={innerH}
          stroke="var(--accent-tertiary)"
          strokeWidth={1.25}
          strokeDasharray="4,3"
        />
        <text
          x={refX + 6}
          y={12}
          fontSize={11}
          fontFamily="var(--font-sans)"
          fontWeight={500}
          fill="var(--text-secondary)"
        >
          National median {median.toFixed(1)}%
        </text>

        {placed.map((d, i) => {
          const isLabelled = LABELLED.has(d.geo_name);
          const isRightLabel = LABELLED_RIGHT.has(d.geo_name);
          const isHovered = tooltip?.geo_name === d.geo_name;
          const cxStart = animated ? d.cx : -DOT_RADIUS * 2;
          const delay = i * 8;

          return (
            <g key={d.geo_name}>
              <circle
                cx={animated ? d.cx : cxStart}
                cy={d.cy}
                r={isHovered ? DOT_RADIUS + 2 : DOT_RADIUS}
                fill={colorFor(d.retention_pct, median)}
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
                  setTooltip({ cx: d.cx, cy: d.cy, geo_name: d.geo_name, retention_pct: d.retention_pct })
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
          // Stack labels in the left annotation column at fixed y fractions
          // so they never overlap each other regardless of dot positions.
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
          const text = `${shortName(tooltip.geo_name)}: ${tooltip.retention_pct.toFixed(1)}% retention`;
          // JetBrains Mono is fully monospace, ~6.6px per char at fontSize 11.
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
          numTicks={9}
          tickFormat={v => `${v}%`}
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

export function CohortRetentionChart({ animated = true }: { animated?: boolean }) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await loadSeries<{ geo_name: string; geo_code: string; retention_pct: number }>(
        's1_cohort_retention_okres',
      );

      // geo_level = 'okres' already excludes the SK_CAP aggregate, which now
      // carries geo_level = 'okres_aggregate'. No row-level filter needed.
      setData(rows.map(r => ({ geo_name: r.geo_name, retention_pct: r.retention_pct })));
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

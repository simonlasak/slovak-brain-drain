import React, { useEffect, useRef, useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { query, registerParquet } from '../../lib/db';

interface Row {
  year: number;
  geo_code: string;
  value: number;
  index?: number;
}

const COLORS: Record<string, string> = {
  SK01: 'var(--accent-primary)',
  SK02: 'var(--accent-secondary)',
  SK03: 'var(--text-secondary)',
  SK04: 'var(--accent-tertiary)',
};

const NAMES: Record<string, string> = {
  SK01: 'Bratislava',
  SK02: 'West',
  SK03: 'Central',
  SK04: 'East',
};

const REGIONS = ['SK01', 'SK02', 'SK03', 'SK04'];

function AnimatedLine({ data, x, y, color, animated, delay }: {
  data: any[];
  x: (d: any) => number;
  y: (d: any) => number;
  color: string;
  animated: boolean;
  delay: number;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (ref.current) {
      const length = ref.current.getTotalLength();
      ref.current.style.setProperty('--dash-length', String(length));
      ref.current.style.strokeDasharray = String(length);
      if (!animated) {
        ref.current.style.strokeDashoffset = '0';
      }
    }
  }, [data, animated]);

  return (
    <LinePath
      innerRef={ref}
      data={data}
      x={x}
      y={y}
      stroke={color}
      strokeWidth={2.25}
      className={animated ? 'region-line-animated' : ''}
      style={animated ? {
        animation: `regionDrawLine 1100ms cubic-bezier(0, 0, 0.2, 1) ${delay}ms forwards`,
        strokeDashoffset: 'var(--dash-length)',
      } : undefined}
    />
  );
}

function Chart({ data, width, height, animated }: { data: Row[]; width: number; height: number; animated: boolean }) {
  const margin = { top: 24, right: 150, bottom: 40, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (innerW <= 0 || innerH <= 0) return null;

  const xScale = scaleLinear({ domain: [2004, 2025], range: [0, innerW] });
  const yScale = scaleLinear({ domain: [80, 140], range: [innerH, 0] });

  // Resolve label vertical collisions: minimum 16px gap between labels.
  const LABEL_GAP = 16;
  const lastValues = REGIONS.map(r => {
    const rData = data.filter(d => d.geo_code === r).sort((a, b) => a.year - b.year);
    const last = rData[rData.length - 1];
    return { region: r, idx: last?.index ?? 100 };
  });

  // Sort by anchor y (top of plot first), then push down any overlaps.
  const sortedAnchors = [...lastValues]
    .map(v => ({ ...v, anchorY: yScale(v.idx) }))
    .sort((a, b) => a.anchorY - b.anchorY);

  const adjusted: Record<string, number> = {};
  let prevY = -Infinity;
  for (const a of sortedAnchors) {
    let y = a.anchorY;
    if (y - prevY < LABEL_GAP) y = prevY + LABEL_GAP;
    adjusted[a.region] = y;
    prevY = y;
  }
  // Reserve a row near the bottom for the "2004 = 100" baseline label,
  // pushed clear of the lowest region label.
  const baselineAnchor = yScale(100);
  let baselineLabelY = baselineAnchor;
  for (const r of REGIONS) {
    if (Math.abs(adjusted[r] - baselineLabelY) < LABEL_GAP) {
      baselineLabelY = Math.max(adjusted[r] + LABEL_GAP, baselineLabelY);
    }
  }

  return (
    <svg width={width} height={height} role="img" aria-label="Population trend by Slovak region, indexed to 2004 = 100">
      <style>{`
        @keyframes regionDrawLine {
          from { stroke-dashoffset: var(--dash-length); }
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .region-line-animated { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
      <Group left={margin.left} top={margin.top}>
        <line
          x1={0}
          x2={innerW}
          y1={yScale(100)}
          y2={yScale(100)}
          stroke="var(--border-subtle)"
          strokeDasharray="6,4"
          strokeWidth={1}
        />
        {/* Baseline label, pushed clear of region labels via leader if needed */}
        {Math.abs(baselineLabelY - baselineAnchor) > 1 && (
          <line
            x1={innerW}
            x2={innerW + 8}
            y1={baselineAnchor}
            y2={baselineLabelY}
            stroke="var(--text-tertiary)"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
        <text
          x={innerW + 12}
          y={baselineLabelY}
          fill="var(--text-tertiary)"
          fontSize={10}
          fontFamily="var(--font-mono)"
          dominantBaseline="middle"
        >
          2004 = 100
        </text>

        {REGIONS.map((r, idx) => {
          const rData = data.filter(d => d.geo_code === r).sort((a, b) => a.year - b.year);
          if (rData.length === 0) return null;
          const last = rData[rData.length - 1];
          const color = COLORS[r];
          const anchorY = yScale(last.index || 100);
          const labelY = adjusted[r];
          const offset = Math.abs(labelY - anchorY) > 1;

          return (
            <g key={r}>
              <AnimatedLine
                data={rData}
                x={(d: any) => xScale(d.year)}
                y={(d: any) => yScale(d.index)}
                color={color}
                animated={animated}
                delay={idx * 150}
              />
              {last && offset && (
                <line
                  x1={innerW}
                  x2={innerW + 8}
                  y1={anchorY}
                  y2={labelY}
                  stroke={color}
                  strokeWidth={1}
                  opacity={animated ? 0.6 : 0}
                  style={{ transition: animated ? `opacity 0.4s ease ${idx * 150 + 900}ms` : 'none' }}
                />
              )}
              {last && (
                <text
                  x={innerW + 12}
                  y={labelY}
                  fill={color}
                  fontSize={11}
                  fontFamily="var(--font-sans)"
                  fontWeight={500}
                  dominantBaseline="middle"
                  opacity={animated ? 1 : 0}
                  style={{ transition: animated ? `opacity 0.4s ease ${idx * 150 + 900}ms` : 'none' }}
                >
                  {NAMES[r]} ({Math.round(last.index || 100)})
                </text>
              )}
            </g>
          );
        })}

        <AxisBottom
          scale={xScale}
          top={innerH}
          numTicks={6}
          tickFormat={v => String(v)}
          tickLabelProps={() => ({
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fill: 'var(--text-secondary)',
            textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
        <AxisLeft
          scale={yScale}
          numTicks={7}
          tickFormat={v => String(v)}
          tickLabelProps={() => ({
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fill: 'var(--text-secondary)',
            textAnchor: 'end' as const,
            dx: -4,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
      </Group>
    </svg>
  );
}

export function RegionTrendChart({ animated = true }: { animated?: boolean }) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      await registerParquet('s1.parquet', '/data/section1_internal.parquet');
      const rows = (await query(`
        SELECT year, geo_code, value
        FROM 's1.parquet'
        WHERE metric = 'population'
          AND geo_level = 'oblast'
          AND geo_code IN ('SK01','SK02','SK03','SK04')
          AND age_bracket = 'all'
          AND education = 'all'
          AND sex = 'all'
        ORDER BY year
      `)) as unknown as Row[];

      const baselines: Record<string, number> = {};
      for (const r of REGIONS) {
        const row2004 = rows.find(d => d.geo_code === r && d.year === 2004);
        if (row2004) baselines[r] = row2004.value;
      }

      const indexed = rows.map(d => ({
        ...d,
        index: baselines[d.geo_code] ? (d.value / baselines[d.geo_code]) * 100 : 100,
      }));
      setData(indexed);
    }
    load();
  }, []);

  if (data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} height={360} animated={animated} />}
      </ParentSize>
    </div>
  );
}

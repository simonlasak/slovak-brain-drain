import React, { useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';

interface StudentRow {
  year: number;
  level: string;
  value: number;
}

const LEVEL_COLORS: Record<string, string> = {
  ED6: 'var(--accent-primary-light)',
  ED7: 'var(--accent-primary)',
  ED8: 'var(--bg-inverse)',
};

const LEVEL_LABELS: Record<string, string> = {
  ED6: 'Bachelor',
  ED7: 'Master',
  ED8: 'Doctoral',
};

const LEVEL_ORDER = ['ED6', 'ED7', 'ED8'];

interface BarTooltip {
  x: number;
  y: number;
  level: string;
  value: number;
  year: number;
}

function AnimatedBar({ x, yFinal, width, heightFinal, innerH, fill, animated, delay, onHover, onLeave, hovered }: {
  x: number;
  yFinal: number;
  width: number;
  heightFinal: number;
  innerH: number;
  fill: string;
  animated: boolean;
  delay: number;
  onHover: () => void;
  onLeave: () => void;
  hovered: boolean;
}) {
  const y = animated ? yFinal : innerH;
  const h = animated ? heightFinal : 0;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={h}
      fill={fill}
      rx={2}
      opacity={hovered ? 1 : 0.85}
      stroke={hovered ? 'var(--text-primary)' : 'none'}
      strokeWidth={hovered ? 1.5 : 0}
      style={{
        transition: animated ? `y 0.6s ease-out ${delay}ms, height 0.6s ease-out ${delay}ms` : 'none',
        cursor: 'default',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    />
  );
}

function Chart({ data, width, height, animated }: { data: StudentRow[]; width: number; height: number; animated: boolean }) {
  const [tooltip, setTooltip] = useState<BarTooltip | null>(null);
  const margin = { top: 24, right: 24, bottom: 44, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (innerW <= 0 || innerH <= 0) return null;

  const years = [...new Set(data.map(r => r.year))].sort((a, b) => a - b);

  const stackedByYear: Record<number, Record<string, number>> = {};
  for (const row of data) {
    if (!stackedByYear[row.year]) stackedByYear[row.year] = {};
    stackedByYear[row.year][row.level] = row.value;
  }

  const maxStack = Math.max(
    ...years.map(y => {
      const vals = stackedByYear[y] || {};
      return LEVEL_ORDER.reduce((sum, l) => sum + (vals[l] || 0), 0);
    })
  );

  const xScale = scaleBand({ domain: years.map(String), range: [0, innerW], padding: 0.2 });
  const yScale = scaleLinear({ domain: [0, maxStack * 1.08], range: [innerH, 0] });

  const barWidth = xScale.bandwidth();
  let barIndex = 0;

  return (
    <svg width={width} height={height} role="img" aria-label="Stacked bar chart of Slovak students by degree level">
      <Group left={margin.left} top={margin.top}>
        {years.map(year => {
          const vals = stackedByYear[year] || {};
          let cumY = 0;
          return (
            <g key={year}>
              {LEVEL_ORDER.map(level => {
                const val = vals[level] || 0;
                const barH = innerH - yScale(val);
                const yPos = yScale(cumY + val);
                cumY += val;
                const delay = barIndex * 30;
                barIndex++;

                const isHovered = tooltip?.year === year && tooltip?.level === level;
                return (
                  <AnimatedBar
                    key={level}
                    x={xScale(String(year)) || 0}
                    yFinal={yPos}
                    width={barWidth}
                    heightFinal={barH}
                    innerH={innerH}
                    fill={LEVEL_COLORS[level]}
                    animated={animated}
                    delay={delay}
                    hovered={isHovered}
                    onHover={() => setTooltip({ x: (xScale(String(year)) || 0) + barWidth / 2, y: yPos, level, value: val, year })}
                    onLeave={() => setTooltip(null)}
                  />
                );
              })}
            </g>
          );
        })}

        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 50}
              y={tooltip.y - 32}
              width={100}
              height={24}
              rx={4}
              fill="rgba(42, 24, 16, 0.88)"
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 16}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-mono)"
              fill="#FBF7F0"
            >
              {LEVEL_LABELS[tooltip.level]}: {tooltip.value >= 1000 ? `${(tooltip.value / 1000).toFixed(1)}k` : tooltip.value.toLocaleString('en')}
            </text>
          </g>
        )}

        <AxisBottom
          scale={xScale}
          top={innerH}
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
          tickFormat={v => `${(Number(v) / 1000).toFixed(0)}k`}
          numTicks={5}
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

      <Group left={margin.left} top={height - 16}>
        {LEVEL_ORDER.map((level, i) => (
          <g key={level} transform={`translate(${i * 100}, 0)`}>
            <rect width={12} height={12} fill={LEVEL_COLORS[level]} rx={2} />
            <text x={16} y={10} fontSize={11} fontFamily="var(--font-sans)" fill="var(--text-secondary)">
              {LEVEL_LABELS[level]}
            </text>
          </g>
        ))}
      </Group>
    </svg>
  );
}

export function StudentBreakdownChart({ data, animated = true }: { data: StudentRow[]; animated?: boolean }) {
  return (
    <div style={{ width: '100%', height: 340 }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} height={340} animated={animated} />}
      </ParentSize>
    </div>
  );
}

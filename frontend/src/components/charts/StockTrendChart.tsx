import React, { useRef, useEffect, useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath, Line } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';

interface StockRow {
  year: number;
  pathway: string;
  value: number;
  computed?: boolean;
}

const PATHWAY_COLORS: Record<string, string> = {
  labour: 'var(--accent-secondary)',
  all: 'var(--accent-tertiary)',
  student: 'var(--accent-primary)',
};

// Fallbacks only. The section passes localised labels via `seriesLabels`.
const PATHWAY_LABELS: Record<string, string> = {
  labour: 'Labour (economically active)',
  all: 'Residence registered',
  student: 'Students enrolled',
};

const PATHWAY_ORDER = ['labour', 'all', 'student'];

interface TooltipData {
  x: number;
  y: number;
  pathway: string;
  year: number;
  value: number;
}

function Chart({ data, width, height, animated, labels }: { data: StockRow[]; width: number; height: number; animated: boolean; labels: Record<string, string> }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const margin = { top: 24, right: 160, bottom: 44, left: 64 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  if (innerW <= 0 || innerH <= 0) return null;

  const years = [...new Set(data.map(r => r.year))].sort((a, b) => a - b);
  const maxVal = Math.max(...data.map(r => r.value));

  const xScale = scaleLinear({ domain: [years[0], years[years.length - 1]], range: [0, innerW] });
  const yScale = scaleLinear({ domain: [0, maxVal * 1.08], range: [innerH, 0] });

  const covid2021X = xScale(2021);

  return (
    <svg width={width} height={height} role="img" aria-label="Stock trend line chart of Slovaks in Czechia">
      <style>{`
        @keyframes drawLine {
          from { stroke-dashoffset: var(--dash-length); }
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .stock-line-animated { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
      <Group left={margin.left} top={margin.top}>
        <Line
          from={{ x: covid2021X, y: 0 }}
          to={{ x: covid2021X, y: innerH }}
          stroke="var(--border-subtle)"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
        <text
          x={covid2021X + 4}
          y={12}
          fontSize={10}
          fontFamily="var(--font-sans)"
          fill="var(--text-tertiary)"
        >
          COVID return signal
        </text>

        {PATHWAY_ORDER.map((pathway, idx) => {
          const pData = data
            .filter(r => r.pathway === pathway)
            .sort((a, b) => a.year - b.year);
          if (pData.length === 0) return null;

          const color = PATHWAY_COLORS[pathway] || 'var(--text-tertiary)';
          const lastPoint = pData[pData.length - 1];

          return (
            <g key={pathway}>
              <AnimatedLinePath
                data={pData}
                x={d => xScale(d.year)}
                y={d => yScale(d.value)}
                color={color}
                animated={animated}
                delay={idx * 200}
              />
              {pData.map(d => (
                <polygon
                  key={`${pathway}-${d.year}`}
                  points={diamondPoints(xScale(d.year), yScale(d.value), tooltip?.year === d.year && tooltip?.pathway === pathway ? 6 : 4)}
                  fill={d.computed ? 'var(--bg-page)' : color}
                  stroke={d.computed ? color : 'none'}
                  strokeWidth={d.computed ? 1.5 : 0}
                  opacity={animated ? 1 : 0}
                  style={{ transition: 'opacity 0.4s ease', transitionDelay: `${idx * 200 + 800}ms`, cursor: 'default' }}
                  onMouseEnter={() => setTooltip({ x: xScale(d.year), y: yScale(d.value), pathway, year: d.year, value: d.value })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
              <text
                x={innerW + 8}
                y={yScale(lastPoint.value)}
                fill={color}
                fontSize={11}
                fontFamily="var(--font-sans)"
                fontWeight={500}
                dominantBaseline="middle"
                opacity={animated ? 1 : 0}
                style={{ transition: 'opacity 0.4s ease', transitionDelay: `${idx * 200 + 1000}ms` }}
              >
                {labels[pathway] || PATHWAY_LABELS[pathway] || pathway}
              </text>
            </g>
          );
        })}

        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 45}
              y={tooltip.y - 32}
              width={90}
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
              {tooltip.value >= 1000 ? `${(tooltip.value / 1000).toFixed(1)}k` : tooltip.value.toLocaleString('en')}
            </text>
          </g>
        )}

        <AxisBottom
          scale={xScale}
          top={innerH}
          tickFormat={v => String(v)}
          numTicks={7}
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
    </svg>
  );
}

function AnimatedLinePath({ data, x, y, color, animated, delay }: {
  data: any[];
  x: (d: any) => number;
  y: (d: any) => number;
  color: string;
  animated: boolean;
  delay: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.setProperty('--dash-length', String(length));
      pathRef.current.style.strokeDasharray = String(length);
      if (!animated) {
        pathRef.current.style.strokeDashoffset = String(length);
      }
    }
  }, [data]);

  return (
    <LinePath
      innerRef={pathRef}
      data={data}
      x={x}
      y={y}
      stroke={color}
      strokeWidth={2}
      className={animated ? 'stock-line-animated' : ''}
      style={animated ? {
        animation: `drawLine 1200ms ease-out ${delay}ms forwards`,
        strokeDashoffset: 'var(--dash-length)',
      } : {
        strokeDashoffset: 'var(--dash-length)',
      }}
    />
  );
}

function diamondPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

export function StockTrendChart({ data, animated = true, seriesLabels }: {
  data: StockRow[];
  animated?: boolean;
  seriesLabels?: Record<string, string>;
}) {
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ParentSize>
        {({ width }) => <Chart data={data} width={width} height={360} animated={animated} labels={seriesLabels || PATHWAY_LABELS} />}
      </ParentSize>
    </div>
  );
}

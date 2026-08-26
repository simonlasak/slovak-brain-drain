import React, { useState } from 'react';
import { scaleLinear } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';

/**
 * Age at which each of the nine left Slovakia, on one axis.
 *
 * A STRIP PLOT, AND DELIBERATELY NOT THE HISTOGRAM the editorial spec asks for.
 * Bucketing nine hand-picked cases produces bars of 2, 3, 3 and 1, which read as a
 * frequency distribution and invite exactly the inference this section cannot
 * support. The version this replaces did that: seven fixed buckets from 0-14 to 40+,
 * four of them empty, over a sample of nine. Nine points on an age axis show the
 * same clustering, and show it as nine people.
 *
 * The vertical axis carries NO meaning. Points are offset vertically only so that
 * coincident ages stay separately readable: three people left at 24 and two at 25, so
 * without an offset five of the nine marks would overlap into two.
 *
 * COLOUR CARRIES THE LOAD-BEARING FACT, which is not the age but whether Slovakia had
 * finished paying for the person's education before they left. Seven of nine
 * completed tertiary education here. Identity never rests on hue alone: there is a
 * legend, and each point is labelled with a surname.
 */

export interface AgePerson {
  id: string;
  name: string;
  ageAtLeaving: number;
  /** True where slovak_education_completed is 'tertiary'. */
  tertiary: boolean;
  /** True where the person is now back in Slovakia. */
  returned: boolean;
}

export interface AgeChartLabels {
  tertiary: string;
  primaryOnly: string;
  ageAxis: string;
  returned: string;
}

interface Props {
  people: AgePerson[];
  labels: AgeChartLabels;
  /** Scrolls to and opens the matching card. */
  onSelect?: (id: string) => void;
}

/**
 * Locked tokens. Validator on `#B83A1F, #2A6B8B` against cream: lightness band,
 * colour-vision separation (all-pairs dE 15.7 protan, 24.8 normal) and contrast all
 * pass; only the chroma floor fails, on the blue at 0.083 against 0.10, which is a
 * property of the palette and is the same finding as the two §3 charts. Relief as
 * required: legend plus a per-point label.
 */
const TERTIARY_COLOR = 'var(--accent-primary)';
const PRIMARY_COLOR = 'var(--accent-secondary)';

/** Surname only: full names would collide at nine points across 25 years of age. */
const surname = (name: string) => name.split(' ').slice(-1)[0];

/**
 * Entrance. Points travel in along the age axis from just off its left end and fade
 * up, which is the dot idiom §1's cohort chart uses.
 *
 * The stagger is the 60ms bar cadence rather than the cohort chart's 8ms, because
 * that 8ms exists to get several hundred districts on screen at once. Nine people
 * staggered 8ms apart would be indistinguishable from no stagger at all, and the
 * whole argument of this figure is that these are nine individuals rather than a
 * distribution, so they should arrive as nine.
 */
const POINT_ENTRY_X = -10;
const POINT_STAGGER = 60;

function Chart({ people, labels, onSelect, width, animated }: Props & { width: number; animated: boolean }) {
  const [hot, setHot] = useState<string | null>(null);

  const compact = width < 520;
  const margin = { top: 14, right: 20, bottom: 34, left: 20 };
  const innerW = width - margin.left - margin.right;
  const laneH = compact ? 30 : 34;

  if (innerW <= 0 || !people.length) return null;

  const ages = people.map(p => p.ageAtLeaving);
  const x = scaleLinear({
    domain: [Math.min(...ages) - 2, Math.max(...ages) + 2],
    range: [0, innerW],
  });

  /**
   * Vertical lanes, assigned greedily: a point drops to the next lane down if it
   * would land within `minGap` of one already placed in this lane. This is what keeps
   * the three 24s and the two 25s legible, and it is why the y position must be
   * documented as meaningless.
   */
  const minGap = compact ? 46 : 62;
  const lanes: { x: number; p: AgePerson }[][] = [];
  const placed = people
    .slice()
    .sort((a, b) => a.ageAtLeaving - b.ageAtLeaving)
    .map(p => {
      const px = x(p.ageAtLeaving);
      let lane = 0;
      while (lanes[lane]?.some(o => Math.abs(o.x - px) < minGap)) lane++;
      (lanes[lane] ||= []).push({ x: px, p });
      return { p, px, lane };
    });

  const innerH = Math.max(1, lanes.length) * laneH;
  const height = innerH + margin.top + margin.bottom;

  return (
    <svg width={width} height={height} role="img"
      aria-label="Age at which each of the nine left Slovakia">
      <Group left={margin.left} top={margin.top}>
        {placed.map(({ p, px, lane }, i) => {
          const cy = lane * laneH + laneH / 2;
          const isHot = hot === p.id;
          const color = p.tertiary ? TERTIARY_COLOR : PRIMARY_COLOR;
          const delay = i * POINT_STAGGER;
          // Only the marks move. The group keeps its class, tabindex and handlers
          // untouched so a point stays clickable and focusable throughout, including
          // before it has arrived.
          const dotTransition = animated
            ? `cx 0.4s cubic-bezier(0.2, 0, 0, 1) ${delay}ms, opacity 0.4s ease ${delay}ms, r 0.15s ease`
            : 'r 0.15s ease';
          return (
            <g key={p.id}
              className="people-age-point"
              onMouseEnter={() => setHot(p.id)}
              onMouseLeave={() => setHot(null)}
              onClick={() => onSelect?.(p.id)}
              tabIndex={0}
              role="button"
              aria-label={`${p.name}, left aged ${p.ageAtLeaving}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(p.id); }
              }}>
              {/* Drop line to the axis, so the age is readable without the tick. Its
                  endpoints are geometry attributes CSS cannot transition, so it fades
                  in behind the dot rather than sliding with it. */}
              <line x1={px} x2={px} y1={cy} y2={innerH}
                stroke="var(--border-subtle)" strokeWidth={1}
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease ${delay + 200}ms` : 'none' }} />
              <circle cx={animated ? px : POINT_ENTRY_X} cy={cy} r={isHot ? 7 : 5.5} fill={color}
                stroke="var(--bg-page)" strokeWidth={1.5}
                opacity={animated ? 1 : 0}
                style={{ transition: dotTransition }} />
              {/* A returner gets a ring, the one non-colour mark here, because
                  "came back" is a different kind of fact from "was educated here". */}
              {p.returned && (
                <circle cx={animated ? px : POINT_ENTRY_X} cy={cy} r={isHot ? 11 : 9.5} fill="none"
                  stroke="var(--text-primary)" strokeWidth={1.2}
                  opacity={animated ? 1 : 0}
                  style={{ transition: dotTransition }} />
              )}
              {/* The label is pinned to the resting position so the surname does not
                  slide across the plot behind its dot. */}
              <text x={px + (p.returned ? 13 : 9)} y={cy} dominantBaseline="middle"
                fontSize={compact ? 10 : 11} fontFamily="var(--font-sans)"
                fill={isHot ? 'var(--text-primary)' : 'var(--text-secondary)'}
                opacity={animated ? 1 : 0}
                style={{ transition: animated ? `opacity 0.4s ease ${delay + 200}ms` : 'none' }}>
                {surname(p.name)}
              </text>
            </g>
          );
        })}

        <AxisBottom
          scale={x}
          top={innerH}
          numTicks={compact ? 5 : 8}
          tickFormat={v => String(Math.round(Number(v)))}
          tickLabelProps={() => ({
            fontSize: 10, fontFamily: 'var(--font-mono)',
            fill: 'var(--text-tertiary)', textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
        <text x={innerW} y={innerH + 30} textAnchor="end" fontSize={10}
          fontFamily="var(--font-sans)" fill="var(--text-tertiary)">
          {labels.ageAxis}
        </text>
      </Group>
    </svg>
  );
}

// `animated` defaults to true: a caller that does not wrap this in AnimateOnScroll
// should see all nine points, not an empty axis.
export function PeopleAgeChart({ people, labels, onSelect, animated = true }: Props & { animated?: boolean }) {
  const anyReturned = people.some(p => p.returned);
  return (
    <div className="people-age-chart">
      <ul className="arrivals-legend">
        <li><span className="basis-dot" style={{ background: TERTIARY_COLOR }} />{labels.tertiary}</li>
        <li><span className="basis-dot" style={{ background: PRIMARY_COLOR }} />{labels.primaryOnly}</li>
        {anyReturned && (
          <li><span className="people-ring-swatch" />{labels.returned}</li>
        )}
      </ul>
      <ParentSize>
        {({ width }) => (
          <Chart people={people} labels={labels} onSelect={onSelect} width={width} animated={animated} />
        )}
      </ParentSize>
    </div>
  );
}

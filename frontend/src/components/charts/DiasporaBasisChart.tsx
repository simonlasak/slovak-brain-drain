import React, { useState } from 'react';
import { scaleLog } from '@visx/scale';
import { AxisBottom } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { useLocale } from '../../lib/locale';

/**
 * The same people, counted twice: Slovak-BORN residents against Slovak CITIZENS,
 * 2020, for the 25 destinations that report both.
 *
 * This is the chart sub2's heading has been promising and the section did not have.
 * Its old caption was sitting under the 1990-2020 growth chart by accident, which is
 * how the gap was found.
 *
 * WHY A DUMBBELL AND NOT PAIRED BARS. The question is not how large each figure is,
 * it is how far apart two measurements of one population sit, so the encoding should
 * be the gap. Two dots joined by a rule put the gap on the page directly; paired
 * bars make the reader subtract two lengths that share no baseline.
 *
 * WHY A LOG AXIS. The values run from 20 people (Lithuanian citizens) to 121,292
 * (Slovak citizens in Czechia), a span of nearly four orders of magnitude. Linear
 * would collapse twenty of the twenty-five rows onto the axis. On a log axis the
 * visual length of each dumbbell is the RATIO between the two counts, which is the
 * quantity the prose actually argues about: Hungary reporting half as many citizens
 * as births, the Netherlands four times as many.
 *
 * THE DIVERGENCE IS LABELLED AS A PERCENTAGE OF THE BORN FIGURE, because that is the
 * denominator the prose uses throughout. Czechia's 6.6 percent in bridge 1 is
 * 7,519/113,773, and the eight percent for the twenty-four countries excluding
 * Czechia is 15,954/191,896. Reading either against the citizen figure instead gives
 * 6.2 and 9.1, so the denominator has to be stated rather than assumed.
 */

export interface BasisRow {
  code: string;
  name: string;
  /** UN DESA, place of birth. */
  born: number;
  /** Eurostat migr_pop1ctz, foreign citizenship. */
  citizen: number;
}

export interface BasisLabels {
  bornLabel: string;
  citizenLabel: string;
  divergenceLabel: string;
  tableToggle: string;
  tableCountry: string;
}

interface Props {
  rows: BasisRow[];
  labels: BasisLabels;
}

/**
 * Locked tokens. Validator: lightness band, colour-vision separation (all-pairs dE
 * 15.7 protan, 24.8 normal) and contrast all pass; the chroma floor fails on Tatra
 * blue at 0.083 against 0.10, exactly as it does for the arrivals chart, because it
 * is a property of the palette. Relief as required: a legend, and a signed
 * divergence figure printed on every row, so identity and magnitude are both
 * readable without colour. `#00699A` is the passing substitute if 05-design.md is
 * ever reopened.
 */
const BORN_COLOR = 'var(--accent-primary)';
const CITIZEN_COLOR = 'var(--accent-secondary)';

function Chart({ rows, labels, width, locale }: Props & { width: number; locale: string }) {
  const [hot, setHot] = useState<string | null>(null);

  const compact = width < 560;
  const rowH = compact ? 19 : 22;
  const margin = {
    top: 8,
    right: compact ? 10 : 92,
    bottom: 30,
    left: compact ? 74 : 104,
  };
  const innerW = width - margin.left - margin.right;
  const innerH = rows.length * rowH;
  if (innerW <= 0 || !rows.length) return null;

  // Domain floor is 10 rather than the data minimum: a log axis cannot start at 0,
  // and a round decade keeps the ticks meaningful.
  const maxV = Math.max(...rows.flatMap(r => [r.born, r.citizen]), 10);
  const x = scaleLog({ domain: [10, maxV * 1.15], range: [0, innerW] });

  const fmt = (v: number) => Math.round(v).toLocaleString(locale);
  /** Signed divergence as a share of the BORN figure. See the header note. */
  const pct = (r: BasisRow) => ((r.citizen - r.born) / r.born) * 100;
  const pctText = (r: BasisRow) => {
    const p = pct(r);
    const s = Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 10) / 10;
    return `${p >= 0 ? '+' : ''}${s.toLocaleString(locale)}%`;
  };

  return (
    <svg width={width} height={innerH + margin.top + margin.bottom} role="img"
      aria-label="Slovak-born residents against Slovak citizens by destination, 2020">
      <Group left={margin.left} top={margin.top}>
        {x.ticks(4).map(t => (
          <line key={String(t)} x1={x(t)} x2={x(t)} y1={0} y2={innerH}
            stroke="var(--border-subtle)" strokeOpacity={0.7} />
        ))}

        {rows.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const isHot = hot === r.code;
          const bx = x(Math.max(r.born, 10));
          const cx = x(Math.max(r.citizen, 10));
          return (
            <g key={r.code}
              onMouseEnter={() => setHot(r.code)}
              onMouseLeave={() => setHot(null)}>
              {/* Full-width hit strip: the dumbbell itself is a thin target. */}
              <rect x={-margin.left} y={i * rowH} width={width} height={rowH} fill="transparent" />
              {isHot && (
                <rect x={-margin.left + 2} y={i * rowH} width={width - 4} height={rowH}
                  fill="var(--bg-nested)" opacity={0.7} />
              )}
              <text x={-10} y={cy} textAnchor="end" dominantBaseline="middle"
                fontSize={compact ? 10 : 11} fontFamily="var(--font-sans)"
                fill={isHot ? 'var(--text-primary)' : 'var(--text-secondary)'}>
                {r.name}
              </text>
              {/* The rule IS the divergence, so it is neutral: the two dots carry
                  which measurement is which. */}
              <line x1={bx} x2={cx} y1={cy} y2={cy}
                stroke="var(--text-tertiary)" strokeWidth={isHot ? 2 : 1.4} strokeOpacity={0.55} />
              <circle cx={bx} cy={cy} r={isHot ? 5 : 4} fill={BORN_COLOR}
                stroke="var(--bg-page)" strokeWidth={1} />
              <circle cx={cx} cy={cy} r={isHot ? 5 : 4} fill={CITIZEN_COLOR}
                stroke="var(--bg-page)" strokeWidth={1} />
              {!compact && (
                <text x={innerW + 8} y={cy} dominantBaseline="middle" fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill={isHot ? 'var(--text-primary)' : 'var(--text-tertiary)'}>
                  {pctText(r)}
                </text>
              )}
            </g>
          );
        })}

        <AxisBottom
          scale={x}
          top={innerH}
          numTicks={4}
          tickFormat={v => {
            const n = Number(v);
            return n >= 1000 ? `${n / 1000}k` : String(n);
          }}
          tickLabelProps={() => ({
            fontSize: 10, fontFamily: 'var(--font-mono)',
            fill: 'var(--text-tertiary)', textAnchor: 'middle' as const,
          })}
          stroke="var(--border-emphasis)"
          tickStroke="var(--border-subtle)"
        />
      </Group>

      {/* Hover readout, anchored to the row rather than the cursor so it cannot
          cover the dumbbell it describes. */}
      {hot !== null && (() => {
        const i = rows.findIndex(r => r.code === hot);
        const r = rows[i];
        if (!r) return null;
        const boxW = 176;
        const cy = margin.top + i * rowH + rowH / 2;
        const flipUp = cy > innerH - 40;
        return (
          <g transform={`translate(${Math.max(4, width - boxW - 4)},${flipUp ? cy - 62 : cy + 8})`}
            pointerEvents="none">
            <rect width={boxW} height={54} rx={4} fill="var(--bg-surface)"
              stroke="var(--border-subtle)" />
            <text x={9} y={15} fontSize={11} fontFamily="var(--font-sans)"
              fill="var(--text-primary)">{r.name}</text>
            <g transform="translate(9,29)">
              <circle cx={3} cy={-3} r={3.5} fill={BORN_COLOR} />
              <text x={12} y={0} fontSize={10} fontFamily="var(--font-sans)"
                fill="var(--text-secondary)">{labels.bornLabel}</text>
              <text x={boxW - 18} y={0} textAnchor="end" fontSize={10}
                fontFamily="var(--font-mono)" fill="var(--text-primary)">{fmt(r.born)}</text>
            </g>
            <g transform="translate(9,43)">
              <circle cx={3} cy={-3} r={3.5} fill={CITIZEN_COLOR} />
              <text x={12} y={0} fontSize={10} fontFamily="var(--font-sans)"
                fill="var(--text-secondary)">{labels.citizenLabel}</text>
              <text x={boxW - 18} y={0} textAnchor="end" fontSize={10}
                fontFamily="var(--font-mono)" fill="var(--text-primary)">{fmt(r.citizen)}</text>
            </g>
          </g>
        );
      })()}
    </svg>
  );
}

export function DiasporaBasisChart({ rows, labels }: Props) {
  const locale = useLocale();
  const fmt = (v: number) => Math.round(v).toLocaleString(locale);
  const pctText = (r: BasisRow) => {
    const p = ((r.citizen - r.born) / r.born) * 100;
    const s = Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 10) / 10;
    return `${p >= 0 ? '+' : ''}${s.toLocaleString(locale)}%`;
  };

  return (
    <div className="basis-chart">
      <ul className="arrivals-legend">
        <li><span className="basis-dot" style={{ background: BORN_COLOR }} />{labels.bornLabel}</li>
        <li><span className="basis-dot" style={{ background: CITIZEN_COLOR }} />{labels.citizenLabel}</li>
      </ul>

      <ParentSize>
        {({ width }) => <Chart rows={rows} labels={labels} width={width} locale={locale} />}
      </ParentSize>

      <details className="arrivals-table">
        <summary>{labels.tableToggle}</summary>
        <div className="arrivals-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{labels.tableCountry}</th>
                <th scope="col">{labels.bornLabel}</th>
                <th scope="col">{labels.citizenLabel}</th>
                <th scope="col">{labels.divergenceLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.code}>
                  <th scope="row">{r.name}</th>
                  <td>{fmt(r.born)}</td>
                  <td>{fmt(r.citizen)}</td>
                  <td>{pctText(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

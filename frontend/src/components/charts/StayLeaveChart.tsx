import React from 'react';
import { AboutData } from './AboutData';
import type { SourcePanel } from '../../content/internal';

interface StayLeaveLabels {
  stay: string;
  return: string;
  other: string;
  /** The share the report leaves uncategorised. See SHARES below. */
  unstated: string;
  caption: string;
}

interface StayLeaveChartProps {
  labels: StayLeaveLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

/**
 * DZS 2023 survey shares, as published. The values are fixed; only the labels
 * localise. Each is traceable to data/processed/dzs_slovak_2023.json, which carries
 * the verbatim sentence and page number behind every one.
 *
 * CORRECTED 2026-08-27. This read 54 / 33 / 13, which sums to exactly 100. The
 * report says 54 percent plan to stay, 13 percent want to use their knowledge in
 * their country of origin, and 13 percent want to try another foreign country: 80
 * in total. "Return to Slovakia 33%" is in no sentence of the source. It made the
 * bar reconcile to 100 and did nothing else, which is the same failure as the
 * fabricated 300,000 that once headlined the landing page.
 *
 * The 20 points the report does not categorise are now drawn as their own segment
 * rather than folded into one of the real ones. A stacked bar that must total 100
 * is exactly the shape that invites this error, so the residual is shown instead of
 * absorbed.
 */
const SHARES: { key: 'stay' | 'return' | 'other' | 'unstated'; value: number; color: string }[] = [
  { key: 'stay', value: 54, color: 'var(--accent-secondary)' },
  { key: 'return', value: 13, color: 'var(--accent-primary)' },
  { key: 'other', value: 13, color: 'var(--accent-tertiary)' },
  { key: 'unstated', value: 20, color: 'var(--border-subtle)' },
];

export function StayLeaveChart({ labels, aboutLabel, sourcePanel }: StayLeaveChartProps) {
  return (
    <div className="stay-leave-bar">
      {/* A legend, because two of the four segments are now 13 percent wide and a
          13 percent segment has no room for its own label. Before the correction
          only one segment fell below that threshold, so an unnamed colour was
          survivable; two adjacent unnamed colours are not. Uses the shared
          .chart-legend chrome so it matches the other figures on the site. */}
      <ul className="chart-legend">
        {SHARES.map(d => (
          <li key={d.key}>
            <span className="stay-leave-swatch" style={{ background: d.color }} />
            {labels[d.key]} {d.value}%
          </li>
        ))}
      </ul>
      <div className="stay-leave-bar-inner" role="img" aria-label={SHARES.map(d => `${labels[d.key]} ${d.value} percent`).join(', ')}>
        {SHARES.map(d => (
          <div
            key={d.key}
            className="stay-leave-segment"
            style={{
              width: `${d.value}%`,
              backgroundColor: d.color,
            }}
          >
            {d.value >= 20 ? `${labels[d.key]} ${d.value}%` : `${d.value}%`}
          </div>
        ))}
      </div>
      <div className="chart-caption-row">
        <p className="stay-leave-caption">{labels.caption}</p>
        <AboutData label={aboutLabel} panel={sourcePanel} />
      </div>
    </div>
  );
}

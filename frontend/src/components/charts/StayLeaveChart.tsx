import React from 'react';
import { AboutData } from './AboutData';
import type { SourcePanel } from '../../content/internal';

interface StayLeaveLabels {
  stay: string;
  return: string;
  other: string;
  caption: string;
}

interface StayLeaveChartProps {
  labels: StayLeaveLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

// DZS 2023 survey shares. The values are fixed; only the labels localise.
const SHARES: { key: 'stay' | 'return' | 'other'; value: number; color: string }[] = [
  { key: 'stay', value: 54, color: 'var(--accent-secondary)' },
  { key: 'return', value: 33, color: 'var(--accent-primary)' },
  { key: 'other', value: 13, color: 'var(--accent-tertiary)' },
];

export function StayLeaveChart({ labels, aboutLabel, sourcePanel }: StayLeaveChartProps) {
  return (
    <div className="stay-leave-bar">
      <div className="stay-leave-bar-inner">
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

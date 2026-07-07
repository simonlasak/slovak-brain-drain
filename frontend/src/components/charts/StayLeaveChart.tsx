import React from 'react';

const DATA = [
  { label: 'Stay in Czechia', value: 54, color: 'var(--accent-secondary)' },
  { label: 'Return to Slovakia', value: 33, color: 'var(--accent-primary)' },
  { label: 'Try another country', value: 13, color: 'var(--accent-tertiary)' },
];

export function StayLeaveChart() {
  return (
    <div className="stay-leave-bar">
      <div className="stay-leave-bar-inner">
        {DATA.map(d => (
          <div
            key={d.label}
            className="stay-leave-segment"
            style={{
              width: `${d.value}%`,
              backgroundColor: d.color,
            }}
          >
            {d.value >= 20 ? `${d.label} ${d.value}%` : `${d.value}%`}
          </div>
        ))}
      </div>
      <p className="stay-leave-caption">
        src: DZS 2023 survey of international students at Czech universities (N approx. 3,200 Slovak respondents). Survey proportions, not administrative data.
      </p>
    </div>
  );
}

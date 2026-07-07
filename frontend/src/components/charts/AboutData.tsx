import React, { useEffect, useState } from 'react';
import type { SourcePanel } from '../../content/internal';

/**
 * "About this data" affordance. A small inline trigger that opens a slide-in
 * panel with the source, derivation, and caveat for a chart or map. Reused by
 * every visualisation so each finding on the site is one click from its
 * provenance (a Definition-of-Done requirement).
 */
export function AboutData({ label, panel }: { label: string; panel: SourcePanel }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="about-data-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="about-data-icon" aria-hidden="true">i</span>
        {label}
      </button>

      {open && (
        <div
          className="about-data-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={panel.title}
          onClick={() => setOpen(false)}
        >
          <div className="about-data-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="about-data-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h3 className="about-data-title">{panel.title}</h3>

            <p className="about-data-heading">Source</p>
            <p className="about-data-body">{panel.source}</p>

            <p className="about-data-heading">How it is derived</p>
            <p className="about-data-body">{panel.derivation}</p>

            <p className="about-data-heading">What to keep in mind</p>
            <p className="about-data-body">{panel.caveat}</p>
          </div>
        </div>
      )}
    </>
  );
}

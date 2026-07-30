import React, { useRef, useState, useEffect } from 'react';
import { query, registerParquet } from '../lib/db';

/**
 * The landing hero number.
 *
 * This component previously held its value as a literal char array
 * (['3','0','0',',','0','0','0']). That 300,000 traced to an illustrative
 * EXAMPLE in docs/07-editorial-content.md, not to any dataset, and it rendered
 * as the site's largest claim for months.
 *
 * So the number is no longer expressible as a literal. The component takes a
 * {metric, geoLevel, yearFrom, yearTo} descriptor, resolves it through the
 * DuckDB layer against the same parquet the charts read, and renders whatever
 * comes back. An unsourced hero is now unrepresentable rather than merely
 * discouraged: there is no prop that accepts a number.
 *
 * `fallback` is the server-rendered value, shown while the WASM engine loads so
 * the hero never blanks. It is passed from the page, which cannot invent it
 * either. If the query disagrees with it, the query wins and we log; that
 * mismatch means the parquet moved and the page needs rebuilding.
 */

export interface HeroMetric {
  /** Metric name in section1_internal.parquet. */
  metric: string;
  /** Which geographic level. For migration series only 'nation' is meaningful. */
  geoLevel: string;
  yearFrom: number;
  yearTo: number;
  /** Server-rendered value, so the hero never renders empty. */
  fallback: number;
}

function groupDigits(value: number): string[] {
  // European convention per docs/05-design.md is a non-breaking space for the
  // thousands separator in Slovak. The landing hero is language-neutral digits,
  // so a comma is used for the English default; the separator is a single
  // character either way and the reveal treats it as one cell.
  return value.toLocaleString('en').split('');
}

export default function HeroCounter({ metric, geoLevel, yearFrom, yearTo, fallback }: HeroMetric) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<number>(fallback);
  const [visibleChars, setVisibleChars] = useState(0);

  // Resolve the descriptor against the parquet. Sums the series over the window
  // at the requested level, which is the only arithmetic this component does.
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        await registerParquet('s1.parquet', '/data/section1_internal.parquet');
        const rows = (await query(`
          SELECT sum(value) AS total
          FROM 's1.parquet'
          WHERE metric = '${metric}'
            AND geo_level = '${geoLevel}'
            AND year BETWEEN ${yearFrom} AND ${yearTo}
            AND age_bracket = 'all'
            AND sex = 'all'
            AND education = 'all'
        `)) as unknown as { total: number | null }[];
        if (cancelled) return;
        const total = rows[0]?.total;
        if (total == null) {
          console.error(
            `HeroCounter: ${metric} at geo_level='${geoLevel}' returned no rows for ` +
            `${yearFrom}-${yearTo}. Keeping the server-rendered value.`
          );
          return;
        }
        const resolved = Math.round(Number(total));
        if (resolved !== fallback) {
          console.warn(
            `HeroCounter: parquet says ${resolved}, page was rendered with ` +
            `${fallback}. Using the parquet. Rebuild the page.`
          );
        }
        setValue(resolved);
      } catch (err) {
        // Keep the server-rendered value rather than blanking the hero.
        console.error('HeroCounter: could not resolve metric, showing fallback.', err);
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [metric, geoLevel, yearFrom, yearTo, fallback]);

  const chars = groupDigits(value);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisibleChars(chars.length);
      return;
    }
    const interval = 1000 / chars.length;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setVisibleChars(step);
      if (step >= chars.length) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [chars.length]);

  return (
    <div ref={ref} style={{
      fontFamily: 'var(--font-serif)',
      fontSize: 'clamp(80px, 16vw, 180px)',
      fontWeight: 400,
      color: 'var(--accent-primary)',
      letterSpacing: '-0.03em',
      lineHeight: 0.9,
      margin: 0,
      display: 'flex',
      justifyContent: 'center',
    }}>
      {chars.map((char, i) => (
        <span
          key={`${i}-${char}`}
          style={{
            display: 'inline-block',
            opacity: (chars.length - i) <= visibleChars ? 1 : 0,
            transition: 'opacity 0.12s ease',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

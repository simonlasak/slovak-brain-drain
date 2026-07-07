import React, { useRef, useState, useEffect } from 'react';

interface StatCalloutProps {
  value: string;
  label: string;
}

function parseNumeric(value: string): { number: number; prefix: string; suffix: string } | null {
  const match = value.match(/^([^0-9]*)([0-9][0-9,.]*)([^0-9]*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return { number: num, prefix: match[1], suffix: match[3] };
}

function formatNumber(n: number, original: string): string {
  if (original.includes(',')) {
    return Math.round(n).toLocaleString('en');
  }
  if (original.includes('.')) {
    const decimals = (original.split('.')[1] || '').replace(/[^0-9]/g, '').length;
    return n.toFixed(decimals);
  }
  return Math.round(n).toLocaleString('en');
}

export function StatCallout({ value, label }: StatCalloutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const parsed = parseNumeric(value);
    if (!parsed) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animate(parsed);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  function animate(parsed: { number: number; prefix: string; suffix: string }) {
    const duration = 800;
    const start = performance.now();
    const target = parsed.number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setDisplayValue(`${parsed.prefix}${formatNumber(current, value)}${parsed.suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
    }

    setDisplayValue(`${parsed.prefix}0${parsed.suffix}`);
    requestAnimationFrame(tick);
  }

  return (
    <div className="stat-callout" ref={ref}>
      <p className="stat-callout-value">{displayValue}</p>
      <p className="stat-callout-label">{label}</p>
    </div>
  );
}

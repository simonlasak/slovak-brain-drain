import React, { useRef, useState, useEffect } from 'react';

export default function HeroCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleChars, setVisibleChars] = useState(0);
  const hasAnimated = useRef(false);

  const finalChars = ['3', '0', '0', ',', '0', '0', '0'];

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisibleChars(finalChars.length);
      return;
    }
    animate();
  }, []);

  function animate() {
    const totalSteps = finalChars.length;
    const interval = 1000 / totalSteps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setVisibleChars(step);
      if (step >= totalSteps) clearInterval(timer);
    }, interval);
  }

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
      {finalChars.map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: (finalChars.length - i) <= visibleChars ? 1 : 0,
            transition: 'opacity 0.12s ease',
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

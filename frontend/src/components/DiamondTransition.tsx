import React, { useEffect, useRef, useState } from 'react';

export default function DiamondTransition() {
  const [triggered, setTriggered] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (hasTriggered.current) return;
      if (window.scrollY > window.innerHeight * 0.3) {
        hasTriggered.current = true;
        setTriggered(true);
        window.removeEventListener('scroll', handleScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? '0ms' : '900ms';
  const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // Each diamond moves from a vertical stack to a horizontal row.
  // Top diamond arcs left, bottom diamond arcs right, middle stays center.
  // All rotate 180deg during the motion.
  const getTransform = (index: number): string => {
    if (!triggered) {
      const yOffsets = [-20, 0, 20];
      return `translate(0px, ${yOffsets[index]}px) rotate(45deg)`;
    }
    const xOffsets = [-32, 0, 32];
    return `translate(${xOffsets[index]}px, 0px) rotate(225deg)`;
  };

  const getSize = (index: number): number => {
    if (!triggered) return [12, 8, 6][index];
    return 10;
  };

  return (
    <>
      <div style={{
        position: 'relative',
        width: '96px',
        height: '48px',
        margin: '0 auto',
        animation: (!triggered && !reducedMotion) ? 'diamondBob 1.6s ease-in-out infinite alternate' : 'none',
      }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${getSize(i)}px`,
              height: `${getSize(i)}px`,
              marginTop: `${-getSize(i) / 2}px`,
              marginLeft: `${-getSize(i) / 2}px`,
              background: 'var(--accent-primary)',
              opacity: 0.5,
              transform: getTransform(i),
              transition: `transform ${duration} ${easing}, width ${duration} ${easing}, height ${duration} ${easing}, margin ${duration} ${easing}`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes diamondBob {
          from { transform: translateY(-4px); }
          to { transform: translateY(0px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0s !important; }
        }
      `}</style>
    </>
  );
}

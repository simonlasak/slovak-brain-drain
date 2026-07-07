import React, { useRef, useState, useEffect } from 'react';

interface AnimateOnScrollProps {
  children: (animated: boolean) => React.ReactNode;
  threshold?: number;
}

export function AnimateOnScroll({ children, threshold = 1.0 }: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setAnimated(true);
      return;
    }

    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated) {
          setAnimated(true);
        }
      },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animated, threshold]);

  return <div ref={ref}>{children(animated)}</div>;
}

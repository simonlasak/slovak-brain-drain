import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';

interface RegionRow {
  cz_geo_code: string;
  value: number;
  year: number;
}

interface CorridorMapWaveProps {
  data: RegionRow[];
  years: number[];
}

function computeBBox(geojson: any): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  function processCoords(coords: number[]) {
    const [lng, lat] = coords;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  function walk(geometry: any) {
    if (geometry.type === 'Polygon') {
      for (const ring of geometry.coordinates) for (const c of ring) processCoords(c);
    } else if (geometry.type === 'MultiPolygon') {
      for (const poly of geometry.coordinates) for (const ring of poly) for (const c of ring) processCoords(c);
    }
  }
  for (const f of geojson.features) walk(f.geometry);
  return [[minLng, minLat], [maxLng, maxLat]];
}

function regionCentroid(geometry: any): { lng: number; lat: number } {
  let sumLng = 0, sumLat = 0, count = 0;
  const walk = (arr: any) => {
    if (typeof arr[0] === 'number') {
      sumLng += arr[0]; sumLat += arr[1]; count++;
    } else {
      for (const a of arr) walk(a);
    }
  };
  walk(geometry.coordinates);
  return { lng: count ? sumLng / count : 0, lat: count ? sumLat / count : 0 };
}

function interpolateGrowth(pctChange: number, maxPct: number): [number, number, number, number] {
  if (pctChange === 0) return [244, 239, 227, 180];
  const t = Math.min(1, Math.max(0, pctChange / maxPct));
  const r = Math.round(244 - t * (244 - 20));
  const g = Math.round(239 - t * (239 - 59));
  const b = Math.round(227 - t * (227 - 77));
  return [r, g, b, 220];
}

export function CorridorMapWave({ data, years }: CorridorMapWaveProps) {
  const [geojson, setGeojson] = useState<any>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [activeYear, setActiveYear] = useState(years[0] || 2015);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [revealedRegions, setRevealedRegions] = useState<Set<string>>(new Set());
  const [waveDone, setWaveDone] = useState(false);
  const tooltipTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const activeYearRef = useRef(activeYear);
  const waveBackRef = useRef<HTMLDivElement>(null);
  const waveFrontRef = useRef<HTMLDivElement>(null);

  const yearAbsolute = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const y of years) map[y] = {};
    for (const r of data) if (map[r.year]) map[r.year][r.cz_geo_code] = r.value;
    return map;
  }, [data, years]);

  const baselineYear = years[0] || 2015;
  const baseline = yearAbsolute[baselineYear] || {};

  const yearChangeMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const y of years) {
      map[y] = {};
      const abs = yearAbsolute[y] || {};
      for (const code of Object.keys(abs)) {
        const base = baseline[code];
        map[y][code] = base && base > 0 ? ((abs[code] - base) / base) * 100 : 0;
      }
    }
    return map;
  }, [yearAbsolute, baseline, years]);

  const maxGrowthPct = useMemo(() => {
    let max = 0;
    for (const y of years) for (const v of Object.values(yearChangeMap[y] || {})) if (v > max) max = v;
    return max || 1;
  }, [yearChangeMap, years]);

  // Each region's bounding box top edge in screen space (pixels from top of sticky container)
  // Computed once viewState + geojson are ready.
  const regionBBoxes = useMemo(() => {
    if (!geojson || !viewState || !stickyRef.current) return null;
    const { width, height } = stickyRef.current.getBoundingClientRect();
    if (!width || !height) return null;
    const viewport = new WebMercatorViewport({
      width, height,
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
    });
    const map: Record<string, { topY: number; bottomY: number }> = {};
    for (const f of geojson.features) {
      const id = f.properties?.NUTS_ID;
      if (!id) continue;
      let minY = Infinity, maxY = -Infinity;
      const walk = (arr: any) => {
        if (typeof arr[0] === 'number') {
          const [px, py] = viewport.project([arr[0], arr[1]]);
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        } else {
          for (const a of arr) walk(a);
        }
      };
      walk(f.geometry.coordinates);
      map[id] = { topY: minY, bottomY: maxY };
    }
    return map;
  }, [geojson, viewState]);

  useEffect(() => {
    fetch('/data/cz_kraje.geojson')
      .then(r => r.json())
      .then(gj => setGeojson(gj));
  }, []);

  useEffect(() => {
    if (!geojson || !stickyRef.current) return;
    const { width, height } = stickyRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const bbox = computeBBox(geojson);
    const viewport = new WebMercatorViewport({ width, height });
    const fitted = viewport.fitBounds(bbox, { padding: { top: 40, bottom: 40, left: 40, right: 40 } });
    setViewState({ longitude: fitted.longitude, latitude: fitted.latitude, zoom: fitted.zoom, pitch: 0, bearing: 0 });
  }, [geojson]);

  // Wave recession animation: waveline starts above the map (top of sticky container)
  // and recedes downward, passing across the map. As its top edge crosses each region's
  // top-Y, that region reveals immediately (sharp).
  useEffect(() => {
    if (!geojson || !regionBBoxes || !stickyRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      const ids = geojson.features.map((f: any) => f.properties?.NUTS_ID).filter(Boolean) as string[];
      setRevealedRegions(new Set(ids));
      setWaveDone(true);
      return;
    }

    const containerHeight = stickyRef.current.getBoundingClientRect().height;
    const duration = 2800;
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // Wave-line top edge starts at y=-100 (above viewport), ends at y=containerHeight+200 (below)
      const waveLineY = -100 + eased * (containerHeight + 300);

      // Position the visible wave lines in the DOM
      if (waveFrontRef.current) {
        waveFrontRef.current.style.transform = `translateY(${waveLineY}px)`;
      }
      if (waveBackRef.current) {
        // Back wave trails 18px above the front wave
        waveBackRef.current.style.transform = `translateY(${waveLineY - 18}px)`;
      }

      // Reveal regions whose top-Y has been crossed by the wave's top edge
      const newlyRevealed: string[] = [];
      for (const f of geojson.features) {
        const id = f.properties?.NUTS_ID;
        if (!id) continue;
        const bb = regionBBoxes![id];
        if (bb && bb.topY <= waveLineY) newlyRevealed.push(id);
      }
      if (newlyRevealed.length > 0) {
        setRevealedRegions(prev => {
          let changed = false;
          const next = new Set(prev);
          for (const id of newlyRevealed) {
            if (!next.has(id)) { next.add(id); changed = true; }
          }
          return changed ? next : prev;
        });
      }

      if (t < 1) raf = requestAnimationFrame(tick);
      else setWaveDone(true);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geojson, regionBBoxes]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || years.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScroll = rect.height - window.innerHeight;
      if (totalScroll <= 0) return;
      const progress = Math.max(0, Math.min(0.99, -rect.top / totalScroll));
      const stepIndex = Math.floor(progress * years.length);
      const clamped = Math.max(0, Math.min(years.length - 1, stepIndex));
      const newYear = years[clamped];
      if (newYear !== activeYearRef.current) {
        activeYearRef.current = newYear;
        setActiveYear(newYear);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [years]);

  const currentChange = yearChangeMap[activeYear] || {};
  const currentAbsolute = yearAbsolute[activeYear] || {};
  const total = Object.values(currentAbsolute).reduce((s, v) => s + v, 0);
  const baseTotal = Object.values(yearAbsolute[baselineYear] || {}).reduce((s, v) => s + v, 0);

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [new GeoJsonLayer({
      id: 'cz-choropleth',
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: (f: any) => {
        const nutsId = f.properties?.NUTS_ID;
        if (!revealedRegions.has(nutsId)) return [244, 239, 227, 0] as any;
        const pctChange = currentChange[nutsId];
        if (pctChange === undefined) return [244, 239, 227, 180] as any;
        return interpolateGrowth(pctChange, maxGrowthPct) as any;
      },
      getLineColor: (f: any) => {
        const nutsId = f.properties?.NUTS_ID;
        if (!revealedRegions.has(nutsId)) return [100, 90, 75, 0] as any;
        if (nutsId === hoveredId) return [50, 35, 25, 190] as any;
        return [100, 90, 75, 60] as any;
      },
      getLineWidth: (f: any) => {
        const nutsId = f.properties?.NUTS_ID;
        if (nutsId === hoveredId) return 2.8;
        return 0.7;
      },
      lineWidthMinPixels: 0.5,
      pickable: true,
      updateTriggers: {
        getFillColor: [activeYear, revealedRegions.size],
        getLineColor: [hoveredId, revealedRegions.size],
        getLineWidth: [hoveredId],
      },
      // Sharp reveal: very fast fill transition so the region appears almost
      // instantly as the wave passes over it
      transitions: {
        getFillColor: 120,
        getLineColor: 120,
        getLineWidth: 200,
      },
    })];
  }, [geojson, currentChange, maxGrowthPct, hoveredId, activeYear, revealedRegions]);

  const waveOpacity = waveDone ? 0 : 1;

  return (
    <div ref={containerRef} style={{ height: `${years.length * 100}vh`, position: 'relative' }}>
      <div ref={stickyRef} style={{ position: 'sticky', top: '72px', height: 'calc(100dvh - 72px)', width: '100vw', overflow: 'hidden' }}>
        {viewState && (
          <DeckGL
            initialViewState={viewState}
            controller={false}
            layers={layers}
            onHover={({ object }: any) => {
              const nutsId = object?.properties?.NUTS_ID;
              setHoveredId(nutsId || null);
              if (!nutsId) {
                if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                setTooltipVisible(false);
                setHoveredName(null);
                return;
              }
              const name = object?.properties?.NUTS_NAME || nutsId;
              if (hoveredName === name && tooltipVisible) return;
              if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
              setTooltipVisible(false);
              tooltipTimer.current = window.setTimeout(() => {
                setHoveredName(name);
                setTooltipVisible(true);
              }, 120) as unknown as number;
            }}
            getCursor={() => 'default'}
            style={{ background: 'var(--bg-page)', width: '100%', height: '100%' }}
          />
        )}

        {/* Layered parallax waves receding downward.
            Each wave is positioned absolutely and its translateY is updated by rAF
            to match the wave-line position. Internal SVG content drifts left (parallax). */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: waveOpacity,
          transition: 'opacity 600ms ease-out',
        }}>
          {/* Back wave - slower drift, Tatra blue, thinner */}
          <div ref={waveBackRef} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '60px',
            willChange: 'transform',
          }}>
            <svg
              viewBox="0 0 1600 60"
              preserveAspectRatio="none"
              className="wave-layer-back"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '200%',
                height: '60px',
              }}
            >
              <path
                d="M0,30 C100,10 200,50 300,30 C400,10 500,50 600,30 C700,10 800,50 900,30 C1000,10 1100,50 1200,30 C1300,10 1400,50 1500,30 C1600,10 1600,30 1600,30"
                fill="none"
                stroke="var(--accent-secondary)"
                strokeWidth="1.5"
                strokeOpacity="0.45"
              />
            </svg>
          </div>

          {/* Front wave - faster drift, terracotta, thicker */}
          <div ref={waveFrontRef} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '60px',
            willChange: 'transform',
          }}>
            <svg
              viewBox="0 0 1600 60"
              preserveAspectRatio="none"
              className="wave-layer-front"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '200%',
                height: '60px',
              }}
            >
              <path
                d="M0,35 C80,15 160,55 240,35 C320,15 400,55 480,35 C560,15 640,55 720,35 C800,15 880,55 960,35 C1040,15 1120,55 1200,35 C1280,15 1360,55 1440,35 C1520,15 1600,35 1600,35"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeOpacity="0.65"
              />
            </svg>
          </div>
        </div>

        {/* Info card top-right */}
        <div style={{
          position: 'absolute',
          top: '2.5rem',
          right: '2.5rem',
          maxWidth: '320px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          pointerEvents: 'none',
          opacity: waveDone ? 1 : 0,
          transform: waveDone ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 500ms ease-out 100ms, transform 500ms ease-out 100ms',
        }}>
          <p style={{
            fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em',
            color: '#8B6F4F', margin: '0 0 0.3rem 0',
            fontFamily: 'var(--font-sans)', fontWeight: 500,
          }}>Slovaks registered in Czech regions</p>
          <h2 style={{
            margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)',
            fontWeight: 400, lineHeight: 1, color: '#2A1810',
          }}>{activeYear}</h2>
          <p style={{
            margin: '0.4rem 0 0 0', fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)', color: '#6B4A2F',
          }}>
            {total.toLocaleString('en')} total
            {activeYear !== baselineYear && baseTotal > 0 && (
              <span style={{ marginLeft: '0.5em', color: '#2A6B8B' }}>
                +{((total - baseTotal) / baseTotal * 100).toFixed(1)}%
              </span>
            )}
          </p>
        </div>

        {/* Tooltip */}
        <div style={{
          position: 'absolute',
          top: '2.5rem',
          right: '23rem',
          opacity: tooltipVisible && hoveredId && waveDone ? 1 : 0,
          transform: tooltipVisible && hoveredId && waveDone ? 'translateX(0)' : 'translateX(20px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: 'none',
          background: 'rgba(42, 24, 16, 0.88)',
          backdropFilter: 'blur(6px)',
          borderRadius: '6px',
          padding: '0.6rem 1rem',
          minWidth: '140px',
        }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#FBF7F0', margin: 0, fontFamily: 'var(--font-sans)' }}>
            {hoveredName || ' '}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'rgba(251,247,240,0.7)', margin: '2px 0 0 0', fontFamily: 'var(--font-mono)' }}>
            {hoveredId && currentAbsolute[hoveredId] !== undefined
              ? `${currentAbsolute[hoveredId].toLocaleString('en')} Slovaks`
              : ' '}
          </p>
          {hoveredId && activeYear !== baselineYear && currentChange[hoveredId] !== undefined && (
            <p style={{ fontSize: '0.75rem', color: '#6FA0B8', margin: '2px 0 0 0', fontFamily: 'var(--font-mono)' }}>
              +{currentChange[hoveredId].toFixed(1)}% since {baselineYear}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

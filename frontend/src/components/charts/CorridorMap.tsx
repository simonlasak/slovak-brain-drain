import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';

interface RegionRow {
  cz_geo_code: string;
  value: number;
  year: number;
}

interface CorridorMapProps {
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
      for (const ring of geometry.coordinates) {
        for (const coord of ring) processCoords(coord);
      }
    } else if (geometry.type === 'MultiPolygon') {
      for (const poly of geometry.coordinates) {
        for (const ring of poly) {
          for (const coord of ring) processCoords(coord);
        }
      }
    }
  }

  for (const feature of geojson.features) {
    walk(feature.geometry);
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

function interpolateGrowth(pctChange: number, maxPct: number): [number, number, number, number] {
  if (pctChange === 0) return [244, 239, 227, 180];
  const t = Math.min(1, Math.max(0, pctChange / maxPct));
  const r = Math.round(244 - t * (244 - 20));
  const g = Math.round(239 - t * (239 - 59));
  const b = Math.round(227 - t * (227 - 77));
  return [r, g, b, 220];
}

export function CorridorMap({ data, years }: CorridorMapProps) {
  const [geojson, setGeojson] = useState<any>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [activeYear, setActiveYear] = useState(years[0] || 2015);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [revealedRegions, setRevealedRegions] = useState<Set<string>>(new Set());
  const [animPhase, setAnimPhase] = useState<'init' | 'drawing' | 'filling' | 'settled'>('init');
  const tooltipTimer = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const activeYearRef = useRef(activeYear);
  const dataReady = useRef(false);

  const yearAbsolute = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const year of years) map[year] = {};
    for (const r of data) {
      if (map[r.year]) map[r.year][r.cz_geo_code] = r.value;
    }
    return map;
  }, [data, years]);

  const baselineYear = years[0] || 2015;
  const baseline = yearAbsolute[baselineYear] || {};

  const yearChangeMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const year of years) {
      map[year] = {};
      const abs = yearAbsolute[year] || {};
      for (const code of Object.keys(abs)) {
        const base = baseline[code];
        if (base && base > 0) {
          map[year][code] = ((abs[code] - base) / base) * 100;
        } else {
          map[year][code] = 0;
        }
      }
    }
    return map;
  }, [yearAbsolute, baseline, years]);

  const maxGrowthPct = useMemo(() => {
    let max = 0;
    for (const year of years) {
      for (const val of Object.values(yearChangeMap[year] || {})) {
        if (val > max) max = val;
      }
    }
    return max || 1;
  }, [yearChangeMap, years]);

  useEffect(() => {
    fetch('/data/cz_kraje.geojson')
      .then(r => r.json())
      .then(gj => {
        setGeojson(gj);
        dataReady.current = true;

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const ids: string[] = gj.features
          .map((f: any) => f.properties?.NUTS_ID)
          .filter(Boolean);

        if (prefersReduced) {
          setRevealedRegions(new Set(ids));
          setAnimPhase('settled');
          return;
        }

        // Shuffle for random reveal order
        const shuffled = [...ids];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Phase 1: borders draw in random order (thick + dark)
        setAnimPhase('drawing');
        shuffled.forEach((id, i) => {
          setTimeout(() => {
            setRevealedRegions(prev => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          }, (i + 1) * 80);
        });

        // Phase 2: fills come in after borders complete
        const drawingDuration = shuffled.length * 80 + 250;
        setTimeout(() => setAnimPhase('filling'), drawingDuration);

        // Phase 3: borders settle to thin/subtle after fills
        setTimeout(() => setAnimPhase('settled'), drawingDuration + 700);
      });
  }, []);

  useEffect(() => {
    if (!geojson || !stickyRef.current) return;
    const { width, height } = stickyRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const bbox = computeBBox(geojson);
    const viewport = new WebMercatorViewport({ width, height });
    const fitted = viewport.fitBounds(bbox, {
      padding: { top: 40, bottom: 40, left: 40, right: 40 },
    });

    setViewState({
      longitude: fitted.longitude,
      latitude: fitted.latitude,
      zoom: fitted.zoom,
      pitch: 0,
      bearing: 0,
    });
  }, [geojson]);

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
    return [
      new GeoJsonLayer({
        id: 'cz-choropleth',
        data: geojson,
        filled: true,
        stroked: true,
        getFillColor: (f: any) => {
          const nutsId = f.properties?.NUTS_ID;
          if (!revealedRegions.has(nutsId)) return [244, 239, 227, 0] as any;
          if (animPhase === 'drawing') return [244, 239, 227, 0] as any;
          const pctChange = currentChange[nutsId];
          if (pctChange === undefined) return [244, 239, 227, 180] as any;
          return interpolateGrowth(pctChange, maxGrowthPct) as any;
        },
        getLineColor: (f: any) => {
          const nutsId = f.properties?.NUTS_ID;
          if (!revealedRegions.has(nutsId)) return [50, 35, 25, 0] as any;
          if (nutsId === hoveredId) return [50, 35, 25, 190] as any;
          if (animPhase === 'drawing' || animPhase === 'filling') return [80, 70, 60, 160] as any;
          return [100, 90, 75, 60] as any;
        },
        getLineWidth: (f: any) => {
          const nutsId = f.properties?.NUTS_ID;
          if (nutsId === hoveredId) return 2.8;
          if (animPhase === 'drawing' || animPhase === 'filling') return 2.2;
          return 0.7;
        },
        lineWidthMinPixels: 0.5,
        pickable: true,
        updateTriggers: {
          getFillColor: [activeYear, revealedRegions.size, animPhase],
          getLineColor: [hoveredId, revealedRegions.size, animPhase],
          getLineWidth: [hoveredId, animPhase],
        },
        transitions: {
          getFillColor: 600,
          getLineColor: 200,
          getLineWidth: 200,
        },
      }),
    ];
  }, [geojson, currentChange, maxGrowthPct, hoveredId, activeYear, revealedRegions, animPhase]);

  return (
    <div ref={containerRef} style={{ height: `${years.length * 100}vh`, position: 'relative' }}>
      <div
        ref={stickyRef}
        style={{
          position: 'sticky',
          top: '72px',
          height: 'calc(100dvh - 72px)',
          width: '100vw',
        }}
      >
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

        {/* Info card - top right */}
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
        }}>
          <p style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#8B6F4F',
            margin: '0 0 0.3rem 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
          }}>
            Slovaks registered in Czech regions
          </p>
          <h2 style={{
            margin: 0,
            fontSize: '2.5rem',
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            lineHeight: 1,
            color: '#2A1810',
          }}>
            {activeYear}
          </h2>
          <p style={{
            margin: '0.4rem 0 0 0',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            color: '#6B4A2F',
          }}>
            {total.toLocaleString('en')} total
            {activeYear !== baselineYear && baseTotal > 0 && (
              <span style={{ marginLeft: '0.5em', color: '#2A6B8B' }}>
                +{((total - baseTotal) / baseTotal * 100).toFixed(1)}%
              </span>
            )}
          </p>
        </div>

        {/* Tooltip - emerges to the left from under the info card */}
        <div style={{
          position: 'absolute',
          top: '2.5rem',
          right: '23rem',
          opacity: tooltipVisible && hoveredId ? 1 : 0,
          transform: tooltipVisible && hoveredId ? 'translateX(0)' : 'translateX(20px)',
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

        {activeYear === years[0] && (
          <div className="corridor-map-scroll-hint">
            scroll to advance through years
          </div>
        )}
      </div>
    </div>
  );
}

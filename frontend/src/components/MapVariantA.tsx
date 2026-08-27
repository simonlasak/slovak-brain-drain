import React, { useEffect, useState, useMemo, useRef } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { WebMercatorViewport } from '@deck.gl/core';
import { loadSeries } from '../lib/chartData';
import { AboutData } from './charts/AboutData';
import type { SourcePanel } from '../content/internal';

type Bounds = [[number, number], [number, number]]; // [[minLng,minLat],[maxLng,maxLat]]

// Walk every coordinate in a GeoJSON FeatureCollection to find its extent.
function geojsonBounds(gj: any): Bounds | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const c of coords) visit(c);
    }
  };
  for (const f of gj.features || []) {
    if (f.geometry?.coordinates) visit(f.geometry.coordinates);
  }
  if (!isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

const IDN3_TO_SK: Record<number, string> = {
  101:"SK0101",102:"SK0102",103:"SK0103",104:"SK0104",105:"SK0105",106:"SK0106",107:"SK0107",108:"SK0108",
  201:"SK0211",202:"SK0212",203:"SK0213",204:"SK0214",205:"SK0215",206:"SK0216",207:"SK0217",
  301:"SK0221",302:"SK0222",303:"SK0223",304:"SK0224",305:"SK0225",306:"SK0226",307:"SK0227",308:"SK0228",309:"SK0229",
  401:"SK0231",402:"SK0232",403:"SK0233",404:"SK0234",405:"SK0235",406:"SK0236",407:"SK0237",
  501:"SK0311",502:"SK0312",503:"SK0313",504:"SK0314",505:"SK0315",506:"SK0316",507:"SK0317",508:"SK0318",509:"SK0319",510:"SK031A",511:"SK031B",
  601:"SK0321",602:"SK0322",603:"SK0323",604:"SK0324",605:"SK0325",606:"SK0326",607:"SK0327",608:"SK0328",609:"SK0329",610:"SK032A",611:"SK032B",612:"SK032C",613:"SK032D",
  701:"SK0411",702:"SK0412",703:"SK0413",704:"SK0414",705:"SK0415",706:"SK0416",707:"SK0417",708:"SK0418",709:"SK0419",710:"SK041A",711:"SK041B",712:"SK041C",713:"SK041D",
  801:"SK0421",802:"SK0422",803:"SK0423",804:"SK0424",805:"SK0425",806:"SK0426",807:"SK0427",808:"SK0428",809:"SK0429",810:"SK042A",811:"SK042B",
};

// Structural step metadata (which metric colours the map at each scroll step).
// The step title/description text is bilingual and supplied via props.
//
// There is no international-migration step. intl_net is total net migration, not
// international: internal moves cancel in the difference, so it is identical at
// every geographic level. It is also the difference between a near-complete
// inflow register (Foreign Police) and an unenforced outflow register (municipal
// offices), so its sign is an artefact of that asymmetry. intl_out cannot stand
// in for it either: below the national level it counts moves out of the unit,
// including moves to other Slovak districts.
const STEPS: { metric: string | null; year: number }[] = [
  { metric: null, year: 2024 },
  { metric: 'population', year: 2024 },
  { metric: 'cohort_retention', year: 2024 },
  { metric: 'total_change', year: 2024 },
];

// How much the map may be scaled down (in px of extra bottom padding) to clear
// the info card once the free vertical slack is used up. Slovakia is roughly
// 2:1, so on most screens the fit is width-constrained and there is leftover
// vertical space to spend for free; past that, clearing the card costs zoom.
// 80px keeps the map at ~86-90% of its full size in the worst real viewports
// instead of the ~60-70% a full clearance would cost on a short laptop window.
const MAX_SHRINK_PX = 80;
// Never let the reserve squeeze the country below this height.
const MIN_MAP_PX = 140;
// Breathing room between the top of the info card and the nearest land.
const CARD_GAP_PX = 24;

interface StepText { title: string; description: string; }

interface MapVariantAProps {
  steps: StepText[];
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

// Gain: Tatra blue scale (#DCE9EE -> #143B4D)
// Loss: Terracotta scale (#FBE0D8 -> #5A1808)
function interpolateDiv(value: number, absMax: number, center: number = 0): [number, number, number, number] {
  if (absMax === 0) return [244, 239, 227, 200];
  const shifted = value - center;
  const range = Math.max(Math.abs(absMax - center), Math.abs(-absMax - center)) || 1;
  const t = Math.max(-1, Math.min(1, shifted / range));
  if (t > 0) {
    // Gain: Tatra blue
    const r = Math.round(220 - t * (220 - 20));
    const g = Math.round(233 - t * (233 - 59));
    const b = Math.round(238 - t * (238 - 77));
    return [r, g, b, 220];
  } else {
    // Loss: Terracotta
    const s = Math.abs(t);
    const r = Math.round(251 - s * (251 - 90));
    const g = Math.round(224 - s * (224 - 24));
    const b = Math.round(216 - s * (216 - 8));
    return [r, g, b, 220];
  }
}

// Sequential: Tatra blue (light to dark) for non-divergent metrics
function interpolateSeq(value: number, min: number, max: number): [number, number, number, number] {
  if (max === min) return [244, 239, 227, 200];
  const t = (value - min) / (max - min);
  // DCE9EE -> 2A6B8B -> 143B4D
  const r = Math.round(220 - t * (220 - 20));
  const g = Math.round(233 - t * (233 - 59));
  const b = Math.round(238 - t * (238 - 77));
  return [r, g, b, 220];
}

export default function MapVariantA({ steps, aboutLabel, sourcePanel }: MapVariantAProps) {
  const [geojson, setGeojson] = useState<any>(null);
  const [mapData, setMapData] = useState<Record<string, number>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [cardState, setCardState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const [displayedStep, setDisplayedStep] = useState(0);
  const [hoveredIdn3, setHoveredIdn3] = useState<number | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ name: string; value: number } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [revealedRegions, setRevealedRegions] = useState<Set<number>>(new Set());
  const [animPhase, setAnimPhase] = useState<'init' | 'drawing' | 'filling' | 'settled'>('init');
  const [isMobile, setIsMobile] = useState(false);
  const [viewState, setViewState] = useState({ latitude: 48.73, longitude: 19.7, zoom: 7.4, pitch: 0, bearing: 0 });
  const dataReadyRef = useRef(false);
  const tooltipTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const maxCardHeightRef = useRef(0);
  const lastWidthRef = useRef(0);
  const boundsRef = useRef<Bounds | null>(null);
  const targetStepRef = useRef(0);
  const preloadedData = useRef<Record<string, number>[]>([]);

  // Fit Slovakia's bounds to the current container size. Recomputed on mount
  // and on every resize so the map scales to fit instead of being cropped.
  //
  // The info card overlays the bottom of the map, so we reserve room for it as
  // extra *bottom* padding. That pushes the fitted country upward, out from
  // under the card. Because the fit is usually width-constrained, most of that
  // reserve is paid out of leftover vertical space and costs no zoom at all;
  // only the remainder (capped at MAX_SHRINK_PX) shrinks the map.
  function fitToContainer() {
    const el = mapWrapRef.current;
    const bounds = boundsRef.current;
    if (!el || !bounds) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width <= 0 || height <= 0) return;
    const base = width < 640 ? 12 : 48;
    // The card reflows to a different height when the layout width changes
    // (notably across the mobile breakpoint), so drop the remembered maximum.
    if (width !== lastWidthRef.current) {
      lastWidthRef.current = width;
      maxCardHeightRef.current = 0;
    }
    try {
      // First fit with symmetric padding to learn how tall the country renders
      // and therefore how much vertical slack is available for free.
      const probe = new WebMercatorViewport({ width, height });
      const fit = probe.fitBounds(bounds, { padding: base });
      const v0 = new WebMercatorViewport({
        width, height,
        longitude: fit.longitude, latitude: fit.latitude, zoom: fit.zoom,
      });
      const top = v0.project([bounds[0][0], bounds[1][1]])[1];
      const bottom = v0.project([bounds[1][0], bounds[0][1]])[1];
      const slack = Math.max(0, height - 2 * base - (bottom - top));

      // How much vertical space the card actually occupies, measured from the
      // DOM so the reserve tracks real content (and translated copy) instead of
      // a guessed constant. Fall back to the CSS offsets before first paint.
      // Each step's card has a different amount of copy. Reserve for the
      // tallest one seen so far so the map holds a steady zoom while scrolling
      // instead of nudging on every step change.
      const cardOffset = width < 640 ? 16 : 40;
      const measured = cardRef.current?.offsetHeight || 0;
      if (measured > maxCardHeightRef.current) maxCardHeightRef.current = measured;
      const cardHeight = maxCardHeightRef.current || (width < 640 ? 230 : 330);
      const reserve = cardHeight + cardOffset + CARD_GAP_PX;

      let extra = Math.min(reserve, slack + MAX_SHRINK_PX);
      extra = Math.max(0, Math.min(extra, height - 2 * base - MIN_MAP_PX));

      const { longitude, latitude, zoom } = probe.fitBounds(bounds, {
        padding: { top: base, left: base, right: base, bottom: base + extra },
      });
      setViewState(v => ({ ...v, longitude, latitude, zoom }));
    } catch (e) {
      // Keep the last good view if fitBounds fails (e.g. zero-area bounds).
    }
  }

  // Preload all step data once on mount
  useEffect(() => {
    async function preload() {
      try {
        // One generated series per step metric. The series keys mirror STEPS, so
        // adding a step means adding a query in
        // pipeline/analysis/chart_data.py and it will fail loudly here if the
        // file is missing rather than colouring the map with nothing.
        const metrics = STEPS.map(s => s.metric).filter(Boolean) as string[];
        const results = await Promise.all(
          metrics.map(metric =>
            loadSeries<{ geo_code: string; value: number }>(`s1_map_okres_${metric}_2024`),
          ),
        );

        // Index 0 = empty (step 0 has null metric), then one per real step
        const parsed: Record<string, number>[] = [{}];
        for (const rows of results) {
          const m: Record<string, number> = {};
          for (const r of rows) m[r.geo_code] = r.value;
          parsed.push(m);
        }
        preloadedData.current = parsed;
        (window as any).__preloadedData = preloadedData.current;
        dataReadyRef.current = true;
        setDataReady(true);
        applyStep(targetStepRef.current);
      } catch (err) {
        console.error('PRELOAD FAILED:', err);
      }
    }
    preload();

    const mq = window.matchMedia('(max-width: 640px)');
    const onMq = () => setIsMobile(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);

    fetch('/data/sk_okresy.geojson').then(r => r.json()).then(gj => {
      setGeojson(gj);
      boundsRef.current = geojsonBounds(gj);
      fitToContainer();
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const ids: number[] = gj.features
        .map((f: any) => f.properties?.IDN3)
        .filter((id: any) => id != null);

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

      setAnimPhase('drawing');
      shuffled.forEach((id, i) => {
        setTimeout(() => {
          setRevealedRegions(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        }, (i + 1) * 20);
      });

      const drawingDuration = shuffled.length * 20 + 250;
      setTimeout(() => setAnimPhase('filling'), drawingDuration);
      setTimeout(() => setAnimPhase('settled'), drawingDuration + 700);
    });

    // Refit the map whenever its container changes size (window resize,
    // device rotation, sidebar toggles) so Slovakia scales instead of cropping.
    // Also observe the info card: its height is what we reserve room for, and
    // it is only measurable after it has rendered its first step of copy.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fitToContainer());
      if (mapWrapRef.current) ro.observe(mapWrapRef.current);
      if (cardRef.current) ro.observe(cardRef.current);
    }

    return () => {
      mq.removeEventListener('change', onMq);
      if (ro) ro.disconnect();
    };
  }, []);

  const cardTimer = useRef<number | null>(null);

  function applyStep(stepIndex: number) {
    if (!dataReadyRef.current) return;
    targetStepRef.current = stepIndex;

    // Cancel any pending card animation
    if (cardTimer.current) { clearTimeout(cardTimer.current); cardTimer.current = null; }

    // Hide tooltip immediately
    setTooltipVisible(false);

    // Set map data synchronously (map colors update instantly)
    setMapData(preloadedData.current[stepIndex] || {});
    setActiveStep(stepIndex);

    // Card animation sequencing
    if (stepIndex === 0) {
      setCardState('exiting');
      cardTimer.current = window.setTimeout(() => { setCardState('hidden'); }, 350);
    } else if (cardState === 'hidden' || activeStep === 0) {
      // First card appearing
      setDisplayedStep(stepIndex);
      setCardState('entering');
      cardTimer.current = window.setTimeout(() => { setCardState('visible'); }, 50);
    } else {
      // Transition between cards: exit old, enter new
      setCardState('exiting');
      cardTimer.current = window.setTimeout(() => {
        setDisplayedStep(stepIndex);
        setCardState('entering');
        cardTimer.current = window.setTimeout(() => { setCardState('visible'); }, 50);
      }, 300);
    }
  }

  // Scroll handler using ref for comparison
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScroll = rect.height - window.innerHeight;
      if (totalScroll <= 0) return;
      const progress = Math.max(0, Math.min(0.99, -rect.top / totalScroll));
      const step = Math.floor(progress * STEPS.length);
      const clampedStep = Math.max(0, Math.min(STEPS.length - 1, step));
      if (clampedStep !== targetStepRef.current) {
        applyStep(clampedStep);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDivergent = STEPS[activeStep].metric !== null && STEPS[activeStep].metric !== 'population';
  const divergentCenter = STEPS[activeStep].metric === 'cohort_retention' ? 100 : 0;
  const values = Object.values(mapData);
  const absMax = Math.max(...values.map(Math.abs), 1);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [new GeoJsonLayer({
      id: 'choropleth',
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: (f: any) => {
        const idn3 = f.properties?.IDN3;
        if (!revealedRegions.has(idn3)) return [244, 239, 227, 0] as any;
        if (animPhase === 'drawing') return [244, 239, 227, 0] as any;
        const skCode = IDN3_TO_SK[idn3];
        if (!skCode) return [244, 239, 227, 200] as any;
        const value = mapData[skCode];
        if (value === undefined) return [244, 239, 227, 200] as any;
        if (isDivergent) return interpolateDiv(value, absMax, divergentCenter) as any;
        return interpolateSeq(value, minVal, maxVal) as any;
      },
      getLineColor: (f: any) => {
        const idn3 = f.properties?.IDN3;
        if (!revealedRegions.has(idn3)) return [50, 35, 25, 0] as any;
        if (idn3 === hoveredIdn3) return [50, 35, 25, 190] as any;
        if (animPhase === 'drawing' || animPhase === 'filling') return [80, 70, 60, 160] as any;
        return [100, 90, 75, 60] as any;
      },
      getLineWidth: (f: any) => {
        const idn3 = f.properties?.IDN3;
        if (idn3 === hoveredIdn3) return 2.8;
        if (animPhase === 'drawing' || animPhase === 'filling') return 2.2;
        return 0.7;
      },
      lineWidthMinPixels: 0.5,
      pickable: true,
      updateTriggers: {
        getFillColor: [mapData, isDivergent, divergentCenter, absMax, minVal, maxVal, revealedRegions.size, animPhase],
        getLineColor: [hoveredIdn3, revealedRegions.size, animPhase],
        getLineWidth: [hoveredIdn3, animPhase],
      },
      transitions: {
        getFillColor: 600,
        getLineColor: 200,
        getLineWidth: 200,
      },
    })];
  }, [geojson, mapData, isDivergent, divergentCenter, absMax, minVal, maxVal, hoveredIdn3, revealedRegions, animPhase]);

  return (
    <div style={{ margin: '-2rem -1.5rem 0' }}>
      {/* Scrollytelling map section */}
      <div ref={containerRef} style={{ height: `${STEPS.length * 100}vh`, position: 'relative' }}>
        <div ref={mapWrapRef} style={{ position: 'sticky', top: '72px', height: 'calc(100dvh - 72px)', width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}>
          <DeckGL
            viewState={viewState}
            controller={false}
            layers={layers}
            onHover={({ object }: any) => {
              const idn3 = object?.properties?.IDN3;
              setHoveredIdn3(idn3 || null);
              if (!idn3) {
                if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                setTooltipVisible(false);
                return;
              }
              const skCode = IDN3_TO_SK[idn3];
              const name = object?.properties?.NM3 || '';
              const value = skCode ? mapData[skCode] : undefined;
              if (value === undefined) {
                setTooltipVisible(false);
                return;
              }
              if (hoveredInfo?.name === name && tooltipVisible) return;
              if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
              setTooltipVisible(false);
              tooltipTimer.current = window.setTimeout(() => {
                setHoveredInfo({ name, value });
                setTooltipVisible(true);
              }, 120);
            }}
            getCursor={() => 'default'}
            style={{ background: '#FBF7F0', width: '100%', height: '100%' }}
          />

          {/* Hover tooltip - bottom left of info card (desktop) / top on mobile */}
          <div style={{
            position: 'absolute',
            ...(isMobile
              ? { top: '1rem', left: '1rem', right: '1rem' }
              : { bottom: '2.5rem', right: '27.5rem' }),
            opacity: tooltipVisible && (isMobile || cardState === 'visible') ? 1 : 0,
            transform: tooltipVisible && (isMobile || cardState === 'visible') ? 'translateX(0)' : 'translateX(20px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: 'none',
            background: 'rgba(42, 24, 16, 0.88)',
            backdropFilter: 'blur(6px)',
            borderRadius: '6px',
            padding: '0.6rem 1rem',
            minWidth: '140px',
          }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#FBF7F0', margin: 0 }}>{hoveredInfo?.name || ' '}</p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(251,247,240,0.7)', margin: '2px 0 0 0' }}>{hoveredInfo ? Math.round(hoveredInfo.value).toLocaleString() : ' '}</p>
          </div>

          {/* Info card - bottom right (desktop) / full-width bottom (mobile) */}
          <div ref={cardRef} style={{
            position: 'absolute',
            ...(isMobile
              ? { bottom: '1rem', left: '1rem', right: '1rem', maxWidth: 'none', padding: '1.1rem 1.25rem' }
              : { bottom: '2.5rem', right: '2.5rem', maxWidth: '380px', padding: '1.5rem 1.75rem' }),
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(10px)', borderRadius: '10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            opacity: cardState === 'visible' ? 1 : 0,
            transform: cardState === 'exiting' ? 'translate(40px, 0)' : cardState === 'entering' ? 'translate(0, 14px)' : 'translate(0, 0)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            pointerEvents: cardState === 'visible' ? 'auto' : 'none',
          }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa', margin: '0 0 0.4rem 0' }}>
              {displayedStep} / {STEPS.length - 1}
            </p>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontFamily: 'var(--font-serif)', fontWeight: 600, lineHeight: 1.2 }}>
              {steps[displayedStep]?.title}
            </h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', lineHeight: 1.6, color: '#444' }}>
              {steps[displayedStep]?.description}
            </p>
            <AboutData label={aboutLabel} panel={sourcePanel} />
          </div>

          {/* Scroll indicator on first step */}
          {activeStep === 0 && (
            <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', opacity: 0.5, fontSize: '0.75rem', color: '#888' }}>
              scroll to explore
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

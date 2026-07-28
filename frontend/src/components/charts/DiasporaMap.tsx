import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { WebMercatorViewport, FlyToInterpolator } from '@deck.gl/core';
import { AboutData } from './AboutData';
import { useLocale } from '../../lib/locale';
import type { SourcePanel } from '../../content/internal';

/**
 * Section 3 centrepiece: an interactive world choropleth of the Slovak-born
 * diaspora. Deliberately NOT scrollytelling (sections 1 and 2 already use that
 * device). The whole world is visible on load; clicking a country that holds
 * diaspora zooms to it and opens a detail panel with its figure and, where the
 * series exists, its 1990-2020 trend.
 *
 * FIRST PASS, interaction open for review. The zoom-and-detail behaviour is
 * isolated in `focusCountry` / `resetView` and the panel below, so the visual
 * treatment can change without touching the data plumbing.
 */

interface CountryDatum {
  /** UN M49 code, zero-padded, matching the `m49` property on the boundaries. */
  code: string;
  value: number;
  /** UN DESA snapshot years, ascending. Empty when the country has no series. */
  trend: { year: number; value: number }[];
}

interface DiasporaMapLabels {
  eyebrow: string;
  year: string;
  totalLabel: string;
  tooltipUnit: string;
  noTrend: string;
  trendLabel: string;
  hint: string;
  resetLabel: string;
  noData: string;
}

interface DiasporaMapProps {
  data: CountryDatum[];
  total: number;
  labels: DiasporaMapLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

const WORLD_BOUNDS: [[number, number], [number, number]] = [[-170, -58], [190, 78]];

// Sequential Tatra blue, matching the site's other choropleths. The diaspora
// spans 2 to 113,773, so colour on a log scale or Czechia flattens everything.
function fillFor(value: number, maxLog: number): [number, number, number, number] {
  if (!value || value <= 0) return [244, 239, 227, 120];
  const t = Math.min(1, Math.log10(value + 1) / maxLog);
  return [
    Math.round(220 - t * (220 - 20)),
    Math.round(233 - t * (233 - 59)),
    Math.round(238 - t * (238 - 77)),
    225,
  ];
}

function bboxOf(geometry: any): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (c: any) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    } else {
      for (const k of c) visit(k);
    }
  };
  visit(geometry.coordinates);
  return [[minLng, minLat], [maxLng, maxLat]];
}

export function DiasporaMap({ data, total, labels, aboutLabel, sourcePanel }: DiasporaMapProps) {
  const locale = useLocale();
  const [geojson, setGeojson] = useState<any>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [hovered, setHovered] = useState<{ name: string; value: number } | null>(null);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const geojsonRef = useRef<any>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, CountryDatum>();
    for (const d of data) m.set(d.code, d);
    return m;
  }, [data]);

  const maxLog = useMemo(() => {
    const max = data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0);
    return Math.log10(max + 1) || 1;
  }, [data]);

  // Fit the whole world to the container, and refit on resize so the map
  // scales rather than cropping.
  function fitWorld() {
    const el = wrapRef.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width <= 0 || height <= 0) return;
    try {
      const vp = new WebMercatorViewport({ width, height });
      const { longitude, latitude, zoom } = vp.fitBounds(WORLD_BOUNDS, {
        padding: width < 640 ? 4 : 24,
      });
      setViewState({ longitude, latitude, zoom, pitch: 0, bearing: 0 });
    } catch (e) {
      // Keep the last good view.
    }
  }

  useEffect(() => {
    fetch('/data/world_countries.geojson')
      .then(r => r.json())
      .then(gj => {
        geojsonRef.current = gj;
        setGeojson(gj);
        fitWorld();
      });

    const mq = window.matchMedia('(max-width: 640px)');
    const onMq = () => setIsMobile(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);

    let ro: ResizeObserver | null = null;
    if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
      // Only refit to the world when nothing is selected; refitting while
      // zoomed into a country would throw the reader back out.
      ro = new ResizeObserver(() => { if (!selectedRef.current) fitWorld(); });
      ro.observe(wrapRef.current);
    }
    return () => {
      mq.removeEventListener('change', onMq);
      if (ro) ro.disconnect();
    };
  }, []);

  // Mirror `selected` into a ref so the ResizeObserver callback, which is
  // created once on mount, can read the current value.
  const selectedRef = useRef<typeof selected>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  function focusCountry(feature: any) {
    const el = wrapRef.current;
    if (!el) return;
    const code = feature.properties?.m49;
    const name = feature.properties?.name || code;
    setSelected({ code, name });

    try {
      const vp = new WebMercatorViewport({ width: el.clientWidth, height: el.clientHeight });
      const fitted = vp.fitBounds(bboxOf(feature.geometry), {
        padding: Math.min(120, Math.max(40, el.clientWidth * 0.08)),
      });
      setViewState({
        longitude: fitted.longitude,
        latitude: fitted.latitude,
        // Cap the zoom so a small country does not fill the screen at street level.
        zoom: Math.min(fitted.zoom, 6),
        pitch: 0,
        bearing: 0,
        transitionDuration: 700,
        transitionInterpolator: new FlyToInterpolator(),
      });
    } catch (e) {
      // Selection still applies even if the camera move fails.
    }
  }

  function resetView() {
    setSelected(null);
    setHovered(null);
    const el = wrapRef.current;
    if (!el) return;
    try {
      const vp = new WebMercatorViewport({ width: el.clientWidth, height: el.clientHeight });
      const { longitude, latitude, zoom } = vp.fitBounds(WORLD_BOUNDS, {
        padding: el.clientWidth < 640 ? 4 : 24,
      });
      setViewState({
        longitude, latitude, zoom, pitch: 0, bearing: 0,
        transitionDuration: 600,
        transitionInterpolator: new FlyToInterpolator(),
      });
    } catch (e) {
      // Keep the last good view.
    }
  }

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [new GeoJsonLayer({
      id: 'diaspora-world',
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: (f: any) => {
        const d = byCode.get(f.properties?.m49);
        return fillFor(d?.value ?? 0, maxLog) as any;
      },
      getLineColor: (f: any) => {
        if (selected && f.properties?.m49 === selected.code) return [42, 24, 16, 220] as any;
        return [120, 105, 88, 90] as any;
      },
      getLineWidth: (f: any) =>
        selected && f.properties?.m49 === selected.code ? 2.4 : 0.5,
      lineWidthMinPixels: 0.4,
      lineWidthMaxPixels: 3,
      pickable: true,
      onClick: ({ object }: any) => {
        if (!object) return;
        // Countries with no diaspora record are still clickable so the reader
        // gets an explicit "no data" answer rather than a dead click.
        focusCountry(object);
      },
      updateTriggers: {
        getFillColor: [byCode, maxLog],
        getLineColor: [selected?.code],
        getLineWidth: [selected?.code],
      },
      transitions: { getFillColor: 400, getLineColor: 200, getLineWidth: 200 },
    })];
  }, [geojson, byCode, maxLog, selected]);

  const selectedDatum = selected ? byCode.get(selected.code) : undefined;
  const fmt = (n: number) => Math.round(n).toLocaleString(locale);

  return (
    <div ref={wrapRef} className="diaspora-map-wrap">
      {viewState && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
          controller={{ dragRotate: false, touchRotate: false }}
          layers={layers}
          getCursor={({ isHovering }: any) => (isHovering ? 'pointer' : 'grab')}
          onHover={({ object }: any) => {
            const code = object?.properties?.m49;
            if (!code) { setHovered(null); return; }
            const d = byCode.get(code);
            setHovered({ name: object.properties?.name || code, value: d?.value ?? 0 });
          }}
          style={{ background: '#EDF3F5', width: '100%', height: '100%' }}
        />
      )}

      {/* Headline card: world totals, or the selected country's detail. */}
      <div className={`diaspora-card${isMobile ? ' is-mobile' : ''}`}>
        {!selected ? (
          <>
            <p className="diaspora-card-eyebrow">{labels.eyebrow}</p>
            <h2 className="diaspora-card-value">{fmt(total)}</h2>
            <p className="diaspora-card-sub">
              {labels.totalLabel} · {labels.year}
            </p>
            <AboutData label={aboutLabel} panel={sourcePanel} />
          </>
        ) : (
          <>
            <p className="diaspora-card-eyebrow">{selected.name}</p>
            {selectedDatum ? (
              <>
                <h2 className="diaspora-card-value">{fmt(selectedDatum.value)}</h2>
                <p className="diaspora-card-sub">
                  {labels.tooltipUnit} · {labels.year}
                </p>
                {selectedDatum.trend.length > 1 ? (
                  <Sparkline points={selectedDatum.trend} label={labels.trendLabel} locale={locale} />
                ) : (
                  <p className="diaspora-card-note">{labels.noTrend}</p>
                )}
              </>
            ) : (
              <p className="diaspora-card-note">{labels.noData}</p>
            )}
            <button type="button" className="diaspora-reset" onClick={resetView}>
              {labels.resetLabel}
            </button>
          </>
        )}
      </div>

      {/* Hover tooltip. Suppressed on touch, where hover is meaningless. */}
      {!isMobile && hovered && (
        <div className="diaspora-tooltip">
          <p className="diaspora-tooltip-name">{hovered.name}</p>
          <p className="diaspora-tooltip-value">
            {hovered.value > 0 ? `${fmt(hovered.value)} ${labels.tooltipUnit}` : labels.noData}
          </p>
        </div>
      )}

      {!selected && <div className="diaspora-hint">{labels.hint}</div>}
    </div>
  );
}

/** Minimal inline trend line for the seven UN DESA snapshot years. */
function Sparkline({ points, label, locale }: {
  points: { year: number; value: number }[];
  label: string;
  locale: string;
}) {
  const w = 200, h = 44, pad = 3;
  const xs = points.map(p => p.year);
  const ys = points.map(p => p.value);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const x = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (w - 2 * pad);
  // Baseline at zero: the story is growth from a small base, so a zero floor is
  // the honest framing.
  const y = (v: number) => h - pad - (v / (maxY || 1)) * (h - 2 * pad);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <div className="diaspora-spark">
      <svg width={w} height={h} role="img" aria-label={`${label}: ${points.map(p => `${p.year} ${p.value}`).join(', ')}`}>
        <path d={path} fill="none" stroke="var(--accent-secondary)" strokeWidth={1.6} />
        <circle cx={x(last.year)} cy={y(last.value)} r={2.6} fill="var(--accent-secondary)" />
      </svg>
      <p className="diaspora-spark-label">
        {label} · {Math.round(points[0].value).toLocaleString(locale)} → {Math.round(last.value).toLocaleString(locale)}
      </p>
    </div>
  );
}

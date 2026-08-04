import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { WebMercatorViewport, FlyToInterpolator } from '@deck.gl/core';
import { AboutData } from './AboutData';
import { useLocale } from '../../lib/locale';
import type { SourcePanel } from '../../content/internal';

/**
 * Section 3 centrepiece: the diaspora as proportional bubbles on a world map.
 *
 * NOT scrollytelling. The earlier four-step plan is void: it was built on a
 * 1990-to-2020 transition, and every UN DESA reference year is modelled, so a
 * transition between two of them animates two model outputs. This is one
 * snapshot with interaction.
 *
 * ENCODING: bubbles only, no choropleth. Four channels (choropleth + bubble +
 * log scale + type-C flag) read as clutter, and the choropleth is the one to
 * drop because polygon area is not the quantity: Canada pale-and-huge against
 * Czechia dark-and-small inverts the ranking for anyone reading area. Bubble
 * area carries magnitude with no area bias, so the land underneath can stay
 * neutral cream and do nothing but locate.
 *
 * WHY BUBBLE AREA AND NOT RADIUS: radius proportional to value would make
 * Czechia's disc ~240x the area of a 2-person country. Radius scales with the
 * square root, so area is proportional to the count.
 */

interface CountryDatum {
  /** ISO3, matching the `iso3` property on the boundaries. */
  code: string;
  value: number;
  /**
   * True where UN DESA compiled this row from foreign-citizenship data rather
   * than place of birth. Only Czechia matters at scale, and bridge 1 turns on
   * it, so the map must not present it as one of the other fifty.
   */
  citizenBasis?: boolean;
}

interface DiasporaMapLabels {
  /** Section eyebrow, e.g. "§3 · GLOBAL DIASPORA". */
  eyebrow: string;
  /** Chart title above the map. */
  title: string;
  /** One-line description of what is plotted. */
  subtitle: string;
  year: string;
  totalLabel: string;
  tooltipUnit: string;
  hint: string;
  resetLabel: string;
  noData: string;
  /** Legend heading, and the note that the scale is not linear. */
  legendTitle: string;
  legendNote: string;
  /** Marker label and footnote for the citizenship-basis countries. */
  citizenBasisLabel: string;
  citizenBasisNote: string;
  /** Label on the Slovakia marker. */
  originLabel: string;
  srcLine: string;
}

interface DiasporaMapProps {
  data: CountryDatum[];
  total: number;
  labels: DiasporaMapLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

// Trimmed at the poles: Antarctica carries no diaspora and eats a third of the
// frame. The north edge clears Greenland and Svalbard, which the previous
// version clipped under the nav.
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-168, -56], [178, 82]];

// Slovakia, marked so the reader has an origin to read distance from.
const ORIGIN: [number, number] = [19.7, 48.73];

// Terracotta sequential, per 05-design.md. The previous build shipped Tatra
// blue on a terracotta spec.
const TERRACOTTA: [number, number, number][] = [
  [251, 224, 216],  // #FBE0D8
  [232, 154, 130],  // #E89A82
  [184, 58, 31],    // #B83A1F
  [138, 40, 18],    // #8A2812
  [90, 24, 8],      // #5A1808
];

// Bubble radius in metres, so discs scale with the map. Area proportional to
// the count: r = k * sqrt(value).
const RADIUS_K = 1400;
const MIN_RADIUS_PX = 3;
const MAX_RADIUS_PX = 46;

function rampColour(value: number, maxLog: number): [number, number, number] {
  if (value <= 0) return TERRACOTTA[0];
  const t = Math.min(1, Math.log10(value + 1) / maxLog);
  const i = Math.min(TERRACOTTA.length - 1, Math.floor(t * TERRACOTTA.length));
  return TERRACOTTA[i];
}

function centroidOf(geometry: any): [number, number] | null {
  // Area-weighted centroid of the largest ring, which keeps the marker on the
  // mainland for countries with distant territories (France, Norway, the US).
  let best: { area: number; pt: [number, number] } | null = null;
  const rings: number[][][] = [];
  const collect = (c: any, depth: number) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') return;
    if (typeof c[0][0] === 'number') { rings.push(c as number[][]); return; }
    for (const k of c) collect(k, depth + 1);
  };
  collect(geometry.coordinates, 0);
  for (const ring of rings) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const f = x0 * y1 - x1 * y0;
      a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (a === 0) continue;
    const area = Math.abs(a / 2);
    const pt: [number, number] = [cx / (3 * a), cy / (3 * a)];
    if (!best || area > best.area) best = { area, pt };
  }
  return best ? best.pt : null;
}

export function DiasporaMap({ data, total, labels, aboutLabel, sourcePanel }: DiasporaMapProps) {
  const locale = useLocale();
  const [geojson, setGeojson] = useState<any>(null);
  const [viewState, setViewState] = useState<any>(null);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Cursor-following tooltip. The previous build anchored a dark panel to the
  // bottom-left that duplicated the card verbatim.
  const [tip, setTip] = useState<{ x: number; y: number; name: string; value: number; citizenBasis: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<typeof selected>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, CountryDatum>();
    for (const d of data) m.set(d.code, d);
    return m;
  }, [data]);

  const maxLog = useMemo(() => {
    const max = data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0);
    return Math.log10(max + 1) || 1;
  }, [data]);

  // One bubble per country that has a figure and a geometry to sit on.
  const bubbles = useMemo(() => {
    if (!geojson) return [];
    const out: {
      code: string; name: string; value: number;
      position: [number, number]; citizenBasis: boolean;
    }[] = [];
    for (const f of geojson.features) {
      const code = f.properties?.iso3;
      const d = code ? byCode.get(code) : undefined;
      if (!d || d.value <= 0) continue;
      const pos = centroidOf(f.geometry);
      if (!pos) continue;
      out.push({
        code,
        name: f.properties?.name || code,
        value: d.value,
        position: pos,
        citizenBasis: Boolean(d.citizenBasis),
      });
    }
    // Largest first so small discs draw on top and stay clickable.
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [geojson, byCode]);

  function fitWorld(animate = false) {
    const el = wrapRef.current;
    if (!el) return;
    const width = el.clientWidth, height = el.clientHeight;
    if (width <= 0 || height <= 0) return;
    try {
      const vp = new WebMercatorViewport({ width, height });
      const { longitude, latitude, zoom } = vp.fitBounds(WORLD_BOUNDS, {
        padding: width < 640 ? 8 : 32,
      });
      setViewState({
        longitude, latitude, zoom, pitch: 0, bearing: 0,
        ...(animate ? { transitionDuration: 600, transitionInterpolator: new FlyToInterpolator() } : {}),
      });
    } catch {
      // Keep the last good view.
    }
  }

  useEffect(() => {
    fetch('/data/world_countries.geojson')
      .then(r => r.json())
      .then(gj => { setGeojson(gj); fitWorld(); });

    const mq = window.matchMedia('(max-width: 640px)');
    const onMq = () => setIsMobile(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);

    let ro: ResizeObserver | null = null;
    if (wrapRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (!selectedRef.current) fitWorld(); });
      ro.observe(wrapRef.current);
    }
    return () => {
      mq.removeEventListener('change', onMq);
      if (ro) ro.disconnect();
    };
  }, []);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  function selectCode(code: string, name: string) {
    setSelected({ code, name });
    setTip(null);
  }

  function resetView() {
    setSelected(null);
    setTip(null);
    fitWorld(true);
  }

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [
      // Land: neutral cream, doing nothing but locating. #F4EFE3 per the spec's
      // map rules; the previous build used #EDF3F5, a blue-grey nowhere in the
      // palette.
      new GeoJsonLayer({
        id: 'world-land',
        data: geojson,
        filled: true,
        stroked: true,
        getFillColor: [244, 239, 227, 255],
        getLineColor: (f: any) =>
          selected && f.properties?.iso3 === selected.code
            ? [184, 58, 31, 230]
            : [212, 165, 71, 110],
        getLineWidth: (f: any) =>
          selected && f.properties?.iso3 === selected.code ? 2 : 0.5,
        lineWidthMinPixels: 0.4,
        lineWidthMaxPixels: 2.5,
        pickable: true,
        onClick: ({ object }: any) => {
          if (!object?.properties?.iso3) return;
          selectCode(object.properties.iso3, object.properties.name || object.properties.iso3);
        },
        updateTriggers: {
          getLineColor: [selected?.code],
          getLineWidth: [selected?.code],
        },
        transitions: { getLineColor: 200, getLineWidth: 200 },
      }),

      // Slovakia, so the reader has an origin. Diamond per the folk-motif rule
      // is not available on ScatterplotLayer, so this is the one small circle,
      // outlined rather than filled to read as a marker not a magnitude.
      new ScatterplotLayer({
        id: 'origin',
        data: [{ position: ORIGIN }],
        getPosition: (d: any) => d.position,
        getRadius: 5,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: [42, 24, 16, 235],
        lineWidthUnits: 'pixels',
        getLineWidth: 1.6,
        pickable: false,
      }),

      new ScatterplotLayer({
        id: 'diaspora-bubbles',
        data: bubbles,
        getPosition: (d: any) => d.position,
        // Area proportional to the count.
        getRadius: (d: any) => RADIUS_K * Math.sqrt(d.value),
        radiusMinPixels: MIN_RADIUS_PX,
        radiusMaxPixels: MAX_RADIUS_PX,
        filled: true,
        stroked: true,
        getFillColor: (d: any) => [...rampColour(d.value, maxLog), 205] as any,
        // Citizenship-basis countries get a dark ring: the figure is on a
        // different definition from the rest and the map says so.
        getLineColor: (d: any) =>
          d.citizenBasis ? [42, 24, 16, 255] : [251, 247, 240, 200] as any,
        lineWidthUnits: 'pixels',
        getLineWidth: (d: any) => (d.citizenBasis ? 2 : 0.8),
        pickable: true,
        onClick: ({ object }: any) => object && selectCode(object.code, object.name),
        onHover: ({ object, x, y }: any) => {
          if (!object) { setTip(null); return; }
          setTip({ x, y, name: object.name, value: object.value, citizenBasis: object.citizenBasis });
        },
        updateTriggers: {
          getFillColor: [maxLog],
          getLineColor: [],
        },
      }),
    ];
  }, [geojson, bubbles, maxLog, selected]);

  const selectedDatum = selected ? byCode.get(selected.code) : undefined;
  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en');

  // Legend ticks at powers of ten, which is what makes the log scale legible.
  const legendTicks = [100, 10_000, 100_000];

  return (
    <figure className="diaspora-figure">
      <figcaption className="diaspora-head">
        <p className="diaspora-eyebrow">{labels.eyebrow}</p>
        <h2 className="diaspora-title">{labels.title}</h2>
        <p className="diaspora-subtitle">{labels.subtitle}</p>
      </figcaption>

      <div ref={wrapRef} className="diaspora-map-wrap">
        {viewState && (
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
            controller={{ dragRotate: false, touchRotate: false }}
            layers={layers}
            getCursor={({ isHovering }: any) => (isHovering ? 'pointer' : 'grab')}
            style={{ background: 'var(--accent-secondary-light)', width: '100%', height: '100%' }}
          />
        )}

        <div className="diaspora-legend">
          <p className="diaspora-legend-title">{labels.legendTitle}</p>
          <div className="diaspora-legend-bubbles">
            {legendTicks.map(t => {
              const px = Math.max(
                MIN_RADIUS_PX,
                Math.min(MAX_RADIUS_PX, 46 * Math.sqrt(t / 113773)),
              );
              return (
                <div className="diaspora-legend-item" key={t}>
                  <span
                    className="diaspora-legend-disc"
                    style={{
                      width: px * 2, height: px * 2,
                      background: `rgb(${rampColour(t, maxLog).join(',')})`,
                    }}
                  />
                  <span className="diaspora-legend-tick">{fmt(t)}</span>
                </div>
              );
            })}
          </div>
          <p className="diaspora-legend-note">{labels.legendNote}</p>
          <p className="diaspora-legend-basis">
            <span className="diaspora-legend-ring" aria-hidden="true" />
            {labels.citizenBasisLabel}
          </p>
        </div>

        {/* Cursor-following tooltip, distinct from the card. */}
        {!isMobile && tip && (
          <div
            className="diaspora-tip"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
            aria-hidden="true"
          >
            <span className="diaspora-tip-name">{tip.name}</span>
            <span className="diaspora-tip-value">{fmt(tip.value)}</span>
            {tip.citizenBasis && (
              <span className="diaspora-tip-basis">{labels.citizenBasisLabel}</span>
            )}
          </div>
        )}

        {!selected && (
          <p className="diaspora-affordance">{labels.hint}</p>
        )}
      </div>

      {/* Detail card sits BELOW the map, not floating over the ocean. */}
      <div className="diaspora-detail">
        {!selected ? (
          <>
            <p className="diaspora-detail-eyebrow">{labels.totalLabel}</p>
            <p className="diaspora-detail-value">{fmt(total)}</p>
            <p className="diaspora-detail-sub">{labels.year}</p>
          </>
        ) : (
          <>
            <p className="diaspora-detail-eyebrow">{selected.name}</p>
            {selectedDatum && selectedDatum.value > 0 ? (
              <>
                <p className="diaspora-detail-value">{fmt(selectedDatum.value)}</p>
                <p className="diaspora-detail-sub">
                  {labels.tooltipUnit} · {labels.year}
                </p>
                {selectedDatum.citizenBasis && (
                  <p className="diaspora-detail-note">{labels.citizenBasisNote}</p>
                )}
              </>
            ) : (
              <p className="diaspora-detail-note">{labels.noData}</p>
            )}
            <button type="button" className="diaspora-reset" onClick={resetView}>
              {labels.resetLabel}
            </button>
          </>
        )}
        <div className="diaspora-detail-meta">
          <p className="diaspora-src">{labels.srcLine}</p>
          <AboutData label={aboutLabel} panel={sourcePanel} />
        </div>
      </div>
    </figure>
  );
}

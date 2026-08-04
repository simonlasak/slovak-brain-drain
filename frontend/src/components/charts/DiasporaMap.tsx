import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoAzimuthalEqualArea, geoNaturalEarth1, geoPath, geoCentroid } from 'd3-geo';
import { AboutData } from './AboutData';
import { useLocale } from '../../lib/locale';
import type { SourcePanel } from '../../content/internal';

/**
 * Section 3 centrepiece: the diaspora as proportional discs.
 *
 * EUROPE IS THE PRIMARY FIGURE, the world is a locator. Inverted 2026-08 from
 * the reverse arrangement. 393,444 of the 419,651 counted people, 93.8 percent,
 * and 35 of the 51 destinations sit inside lon -25..45, lat 34..72. A world map
 * cannot resolve that pile, which is why the previous build shipped a subtitle
 * explaining that its own main chart could not be read, and then a floating
 * inset to compensate. The inset was doing the work; it is now the figure. The
 * world frame keeps the 14-destination tail (25,847 people, 6.2 percent) and the
 * United States annotation, which are the only things it was ever needed for.
 *
 * NOT scrollytelling, and no zoom. Every UN DESA reference year is modelled, so
 * a transition between two of them animates two model outputs. Nothing here
 * attaches a wheel listener, so the page scrolls over the figure.
 *
 * WHY LAEA FOR EUROPE, NOT EQUAL EARTH. Equal Earth is equal-area but it
 * compresses vertically toward the poles, and measured on a render rather than
 * argued from theory it is severe: at a 1000x500 frame it yields 3.71 px per
 * degree of latitude at the equator against 1.72 px between 60 and 83.6 degrees,
 * a 2.2x squash. Greenland came out at width/height 2.67 against 1.94 on Natural
 * Earth, and the whole world at aspect 2.278 inside a 2:1 box. Lambert azimuthal
 * equal-area centred on 10E 52N is what Europe's own statistical standard
 * (EPSG:3035) uses, is equal-area without the polar squash inside this window,
 * and gives the window a natural aspect of 1.3926, which is where 760x546 comes
 * from. The locator uses Natural Earth 1 because a whole-world frame needs a
 * compromise projection and its Greenland is the less distorted of the two.
 *
 * PROJECTION DOES NOT AFFECT THE DISCS. A radius depends only on the value, so
 * the two frames share one absolute area scale and one legend serves both. Both
 * viewBoxes are authored at 1 unit = 1 CSS pixel at full size, so MAX_R means
 * the same apparent size in each. The projection affects only the land beneath.
 *
 * TWO SYMBOL CONVENTIONS, down from four. A disc, whose area is the count, and a
 * ring on that disc, meaning the figure is not a place-of-birth count. The ring
 * covers both the 3 citizenship-basis rows and the 1 model-imputed row: they
 * were a solid ring and a dashed ring before, which asked the reader to tell two
 * dash patterns apart on an 11px circle to learn something the readout states in
 * words. Slovakia and the United States are now text annotations rather than a
 * diamond and a crossed circle, because neither is a datum on this scale.
 */

interface CountryDatum {
  /** ISO3, matching the `iso3` property on the boundaries. */
  code: string;
  value: number;
  /**
   * True where UN DESA compiled this row from foreign-citizenship data (type C)
   * rather than place of birth. Only Czechia matters at scale, and bridge 1
   * turns on it.
   */
  citizenBasis?: boolean;
  /**
   * True where the row is imputed from a regional model (type I) rather than
   * observed. Bosnia and Herzegovina is the only one. Carried separately from
   * citizenBasis because the readout names which of the two applies, even though
   * both now draw the same ring.
   */
  imputed?: boolean;
}

interface DiasporaMapLabels {
  eyebrow: string;
  title: string;
  subtitle: string;
  year: string;
  totalLabel: string;
  tooltipUnit: string;
  resetLabel: string;
  noData: string;
  legendTitle: string;
  /** The single ring convention, covering both non-birthplace bases. */
  offBasisLabel: string;
  /** Readout note naming which basis applies. */
  citizenBasisNote: string;
  imputedNote: string;
  /** Text annotation at Slovakia, in the European frame. */
  originLabel: string;
  /** Heading and caption for the world locator. */
  locatorTitle: string;
  locatorNote: string;
  /** The United States: an absence, not a zero. Plain HTML, so it wraps. */
  absentTitle: string;
  absentNote: string;
  srcLine: string;
}

interface DiasporaMapProps {
  data: CountryDatum[];
  total: number;
  labels: DiasporaMapLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

/**
 * European frame. 760x546 is the window's own natural aspect (1.3926) at a width
 * that fits the content column beside a 300px readout rail.
 */
const EU_W = 760;
const EU_H = 546;

/**
 * The European window: lon -25..45, lat 34..72. Holds 35 of the 51 destinations
 * and 393,444 of the 419,651 counted people. Wider than the -11..32 box the old
 * inset used, which excluded Iceland, Turkey and Cyprus for no reason beyond the
 * box being drawn tight around the largest discs.
 */
const EU_WINDOW: [[number, number], [number, number]] = [[-25, 34], [45, 72]];

/** EPSG:3035's centre. */
const EU_CENTRE: [number, number] = [10, 52];

/** World locator, sized to the rail. Aspect is Natural Earth 1's own, 2.298. */
const LOC_W = 300;
const LOC_H = 131;

/** Slovakia, the origin. A text label, not a glyph. */
const ORIGIN: [number, number] = [19.7, 48.73];

/** Single terracotta, --accent-primary. Area is the only quantitative channel. */
const DISC_FILL = '#B83A1F';
const DISC_STROKE = '#FBF7F0';
/** The one ring: figure is not a place-of-birth count. */
const RING_STROKE = '#2A1810';

/**
 * One radius scale for both frames, in SVG units, which equal CSS pixels at full
 * size in each viewBox. MAX_R 36 is the largest value that leaves no disc fully
 * swallowed by a larger one in the European frame: at 40 Slovenia disappears
 * inside Austria, and at 54, which is what the old world frame's 40 worked out
 * to here, Poland and Slovenia both vanish inside Czechia.
 */
const MAX_R = 36;
const MIN_R = 2.4;

interface Bubble {
  code: string;
  name: string;
  value: number;
  lonLat: [number, number];
  citizenBasis: boolean;
  imputed: boolean;
  /** True where the figure is not a place-of-birth count: one ring, either way. */
  offBasis: boolean;
}

/** Samples the window's edges for fitExtent.
 *
 * A MultiPoint, not a Polygon: a ring wound counter-clockwise is the complement
 * of the box on the sphere and d3 then fits the whole world, which is how the
 * first version of the old inset rendered as a second tiny world map. And curved
 * meridians mean the four corners alone understate the box's width at
 * mid-latitudes, so the edges are sampled rather than just the corners.
 */
function windowSample([[w, s], [e, n]]: [[number, number], [number, number]]) {
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    coordinates.push([w + (e - w) * t, s], [w + (e - w) * t, n]);
    coordinates.push([w, s + (n - s) * t], [e, s + (n - s) * t]);
  }
  return { type: 'MultiPoint' as const, coordinates };
}

/**
 * The same window as a closed LineString, for drawing its outline on the
 * locator. Not a Polygon: see the call site.
 */
function windowOutline([[w, s], [e, n]]: [[number, number], [number, number]]) {
  const coordinates: [number, number][] = [];
  const along = (
    from: [number, number], to: [number, number],
  ) => {
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      coordinates.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
    }
  };
  along([w, s], [e, s]);
  along([e, s], [e, n]);
  along([e, n], [w, n]);
  along([w, n], [w, s]);
  return { type: 'LineString' as const, coordinates } as any;
}

export function DiasporaMap({ data, total, labels, aboutLabel, sourcePanel }: DiasporaMapProps) {
  const locale = useLocale();
  const [geojson, setGeojson] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; b: Bubble } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const byCode = useMemo(() => {
    const m = new Map<string, CountryDatum>();
    for (const d of data) m.set(d.code, d);
    return m;
  }, [data]);

  const maxValue = useMemo(
    () => data.reduce((acc, d) => (d.value > acc ? d.value : acc), 0) || 1,
    [data],
  );

  useEffect(() => {
    fetch('/data/world_countries.geojson')
      .then(r => r.json())
      .then(setGeojson)
      .catch(() => setGeojson(null));
  }, []);

  // Europe: LAEA on EPSG:3035's centre, fitted to the stated window rather than
  // to whatever features happen to carry data.
  const eu = useMemo(() => {
    const projection = geoAzimuthalEqualArea()
      .rotate([-EU_CENTRE[0], -EU_CENTRE[1]])
      .fitExtent([[8, 8], [EU_W - 8, EU_H - 8]], windowSample(EU_WINDOW));
    return { projection, path: geoPath(projection) };
  }, []);

  // Locator: fitted to the whole feature collection.
  const loc = useMemo(() => {
    if (!geojson) return null;
    const projection = geoNaturalEarth1().fitExtent([[2, 2], [LOC_W - 2, LOC_H - 2]], geojson);
    return { projection, path: geoPath(projection) };
  }, [geojson]);

  const bubbles = useMemo<Bubble[]>(() => {
    if (!geojson) return [];
    const out: Bubble[] = [];
    for (const f of geojson.features) {
      const code = f.properties?.iso3;
      const d = code ? byCode.get(code) : undefined;
      if (!d || d.value <= 0) continue;
      const c = geoCentroid(f);
      if (!c || Number.isNaN(c[0])) continue;
      const citizenBasis = Boolean(d.citizenBasis);
      const imputed = Boolean(d.imputed);
      out.push({
        code,
        name: f.properties?.name || code,
        value: d.value,
        lonLat: [c[0], c[1]],
        citizenBasis,
        imputed,
        offBasis: citizenBasis || imputed,
      });
    }
    // Largest first, so small discs paint on top and stay hoverable.
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [geojson, byCode]);

  const inEurope = (b: Bubble) => {
    const [[w, s], [e, n]] = EU_WINDOW;
    const [lon, lat] = b.lonLat;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  };

  const european = useMemo(() => bubbles.filter(inEurope), [bubbles]);
  /** The tail: everything the European frame does not hold. */
  const tail = useMemo(() => bubbles.filter(b => !inEurope(b)), [bubbles]);

  const radius = (v: number) => Math.max(MIN_R, MAX_R * Math.sqrt(v / maxValue));

  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en');

  function showTip(e: React.MouseEvent, b: Bubble) {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, b });
  }

  const clearTip = () => setTip(null);

  // The per-disc mouseleave is not enough on its own. A fast exit off the edge of
  // an SVG, a disc unmounting under the cursor, and every touch interaction all
  // leave a tooltip on screen with nothing to dismiss it, which is how the
  // previous build's tooltip persisted indefinitely. Scroll and window blur are
  // the two other ways the cursor stops being where the tooltip says it is.
  useEffect(() => {
    if (!tip) return;
    window.addEventListener('scroll', clearTip, { passive: true });
    window.addEventListener('blur', clearTip);
    return () => {
      window.removeEventListener('scroll', clearTip);
      window.removeEventListener('blur', clearTip);
    };
  }, [tip]);

  const selectedDatum = selected ? byCode.get(selected) : undefined;
  const selectedBubble = selected ? bubbles.find(b => b.code === selected) : undefined;
  const selectedName = selectedBubble?.name || selected;

  /** One disc. Identical radius scale in both frames. */
  function Disc({ b, projection }: { b: Bubble; projection: any }) {
    const p = projection(b.lonLat);
    if (!p) return null;
    const r = radius(b.value);
    const isSelected = selected === b.code;
    return (
      <circle
        cx={p[0]}
        cy={p[1]}
        r={r}
        fill={DISC_FILL}
        fillOpacity={isSelected ? 0.95 : 0.72}
        stroke={b.offBasis ? RING_STROKE : DISC_STROKE}
        strokeWidth={b.offBasis ? 1.4 : 0.6}
        className="diaspora-disc"
        onMouseMove={e => showTip(e, b)}
        onMouseLeave={clearTip}
        onClick={() => setSelected(b.code === selected ? null : b.code)}
        tabIndex={0}
        role="button"
        aria-label={`${b.name}: ${fmt(b.value)} ${labels.tooltipUnit}`}
        onFocus={() => setSelected(b.code)}
      />
    );
  }

  const readout = (
    <div className="diaspora-readout">
      {!selected ? (
        <>
          <p className="diaspora-readout-eyebrow">{labels.totalLabel}</p>
          <p className="diaspora-readout-value">{fmt(total)}</p>
          <p className="diaspora-readout-sub">{labels.year}</p>
        </>
      ) : (
        <>
          <p className="diaspora-readout-eyebrow">{selectedName}</p>
          {selectedDatum && selectedDatum.value > 0 ? (
            <>
              <p className="diaspora-readout-value">{fmt(selectedDatum.value)}</p>
              <p className="diaspora-readout-sub">
                {labels.tooltipUnit} · {labels.year}
              </p>
              {selectedDatum.citizenBasis && (
                <p className="diaspora-readout-note">{labels.citizenBasisNote}</p>
              )}
              {selectedDatum.imputed && (
                <p className="diaspora-readout-note">{labels.imputedNote}</p>
              )}
            </>
          ) : (
            <p className="diaspora-readout-note">{labels.noData}</p>
          )}
          <button type="button" className="diaspora-reset" onClick={() => setSelected(null)}>
            {labels.resetLabel}
          </button>
        </>
      )}
    </div>
  );

  return (
    <figure className="diaspora-figure">
      <figcaption className="diaspora-head">
        <p className="diaspora-eyebrow">{labels.eyebrow}</p>
        <h2 className="diaspora-title">{labels.title}</h2>
        <p className="diaspora-subtitle">{labels.subtitle}</p>
      </figcaption>

      {/* Map and readout are siblings in one grid, so they are on screen
          together: the readout used to sit below a full-viewport-height map and
          was never visible at the same time as the thing it described. */}
      <div ref={stageRef} className="diaspora-stage" onMouseLeave={clearTip}>
        <div className="diaspora-primary">
          <svg
            className="diaspora-eu-svg"
            viewBox={`0 0 ${EU_W} ${EU_H}`}
            role="img"
            aria-label={labels.title}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id="diaspora-eu-clip">
                <rect x={0} y={0} width={EU_W} height={EU_H} />
              </clipPath>
            </defs>
            <rect x={0} y={0} width={EU_W} height={EU_H} fill="#DCE9EE" />
            {geojson && (
              <g clipPath="url(#diaspora-eu-clip)">
                <g>
                  {geojson.features.map((f: any, i: number) => (
                    <path
                      key={f.properties?.iso3 || i}
                      d={eu.path(f) || undefined}
                      fill="#F4EFE3"
                      stroke="#D4A547"
                      strokeOpacity={0.5}
                      strokeWidth={0.5}
                    />
                  ))}
                </g>
                <g>
                  {european.map(b => (
                    <Disc key={b.code} b={b} projection={eu.projection} />
                  ))}
                </g>
                {/* Slovakia: a label, not a symbol. paint-order puts the cream
                    stroke behind the glyphs so it reads over land and over the
                    edge of Czechia's disc without a box. */}
                <text
                  className="diaspora-origin-label"
                  x={eu.projection(ORIGIN)[0] + 8}
                  y={eu.projection(ORIGIN)[1] - 8}
                >
                  {labels.originLabel}
                </text>
              </g>
            )}
          </svg>
        </div>

        <div className="diaspora-rail">
          {readout}

          <div className="diaspora-legend">
            <p className="diaspora-legend-title">{labels.legendTitle}</p>
            {/* Ticks are round scale anchors, not countries. They used to be
                1,000 / 20,000 / 113,773, and that last one is Czechia, whose
                figure is the citizenship-basis outlier: the legend was
                illustrating a birthplace map with a non-birthplace number. The
                scale is the same in both frames, so this legend serves both. */}
            <div className="diaspora-legend-bubbles">
              {[1000, 20_000, 100_000].map(t => {
                const r = radius(t);
                return (
                  <div className="diaspora-legend-item" key={t}>
                    <span
                      className="diaspora-legend-disc"
                      style={{ width: r * 2, height: r * 2 }}
                    />
                    <span className="diaspora-legend-tick">{fmt(t)}</span>
                  </div>
                );
              })}
            </div>
            {/* Swatch is inline SVG, drawn the way the map draws it. A CSS border
                on a circle this small does not survive. */}
            <p className="diaspora-legend-flag">
              <svg className="diaspora-legend-mark" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="10" r="7" fill={DISC_FILL} fillOpacity={0.72}
                  stroke={RING_STROKE} strokeWidth={1.8} />
              </svg>
              {labels.offBasisLabel}
            </p>
          </div>

          {loc && geojson && (
            <div className="diaspora-locator">
              <p className="diaspora-locator-title">{labels.locatorTitle}</p>
              <svg
                viewBox={`0 0 ${LOC_W} ${LOC_H}`}
                className="diaspora-locator-svg"
                role="img"
                aria-label={labels.locatorTitle}
              >
                <rect x={0} y={0} width={LOC_W} height={LOC_H} fill="#DCE9EE" />
                <g>
                  {geojson.features.map((f: any, i: number) => {
                    const iso = f.properties?.iso3;
                    // The United States is outlined, not filled differently: the
                    // annotation beneath says what the outline means, so this is
                    // not a fourth symbol convention competing with the discs.
                    const isUS = iso === 'USA';
                    return (
                      <path
                        key={iso || i}
                        d={loc.path(f) || undefined}
                        fill="#F4EFE3"
                        stroke={isUS ? RING_STROKE : '#D4A547'}
                        strokeOpacity={isUS ? 0.85 : 0.45}
                        strokeWidth={isUS ? 0.9 : 0.4}
                      />
                    );
                  })}
                </g>
                {/* The European window, so the locator says where the primary
                    figure is.

                    A LineString, not a Polygon. As a Polygon this drew a dashed
                    loop around most of the world: d3 reads ring winding to decide
                    which side is the interior, and the wrong sense makes the box
                    the complement of itself on the sphere. A LineString has no
                    interior to get backwards. The edges are sampled rather than
                    cornered because Natural Earth curves its meridians. */}
                <path
                  className="diaspora-window-outline"
                  d={loc.path(windowOutline(EU_WINDOW)) || undefined}
                />
                <g>
                  {tail.map(b => (
                    <Disc key={b.code} b={b} projection={loc.projection} />
                  ))}
                </g>
              </svg>
              <p className="diaspora-locator-note">{labels.locatorNote}</p>
              {/* HTML, not SVG text. The old version authored its line breaks by
                  hand in the content module and needed a mobile font-size
                  override, because SVG text neither wraps nor scales with the
                  reader's type size. */}
              <p className="diaspora-absent">
                <span className="diaspora-absent-title">{labels.absentTitle}</span>{' '}
                {labels.absentNote}
              </p>
            </div>
          )}

          <div className="diaspora-rail-meta">
            <p className="diaspora-src">{labels.srcLine}</p>
            <AboutData label={aboutLabel} panel={sourcePanel} />
          </div>
        </div>

        {tip && (
          <div
            className="diaspora-tip"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
            aria-hidden="true"
          >
            <span className="diaspora-tip-name">{tip.b.name}</span>
            <span className="diaspora-tip-value">{fmt(tip.b.value)}</span>
            {/* The short flag, not the full note. The tooltip used to print the
                same three-line paragraph the readout does, one inch away from it,
                which is the whole readout duplicated on top of the map. */}
            {tip.b.offBasis && (
              <span className="diaspora-tip-basis">{labels.offBasisLabel}</span>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

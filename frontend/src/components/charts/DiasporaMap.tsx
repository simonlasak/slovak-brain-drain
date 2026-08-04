import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoEqualEarth, geoPath, geoCentroid } from 'd3-geo';
import { AboutData } from './AboutData';
import { useLocale } from '../../lib/locale';
import type { SourcePanel } from '../../content/internal';

/**
 * Section 3 centrepiece: the diaspora as proportional discs on a world map,
 * plus a European inset carrying the 92 percent of the data that piles up
 * around Slovakia.
 *
 * NOT scrollytelling. The earlier four-step plan is void: it was built on a
 * 1990-to-2020 transition, and every UN DESA reference year is modelled, so a
 * transition between two of them animates two model outputs.
 *
 * WHY SVG AND d3.geoPath, NOT deck.gl. The previous build mapped lon/lat
 * linearly to x/y, which is equirectangular in all but name, and hand-rolled an
 * antimeridian split in the pipeline to compensate. Three defects came out of
 * that one decision: Chukotka rendered as a rectangular block (the split's
 * closing edges were filled as a quadrilateral), the 82-degree crop cut straight
 * lines across northern Russia, Canada and Greenland, and Greenland was inflated
 * to rival Africa. d3.geoPath clips on the sphere before projecting, so it needs
 * no pre-split, and Equal Earth is an equal-area projection, so a disc's
 * surroundings are not distorted out of proportion to it.
 *
 * WHY EQUAL EARTH. Greenland's projected footprint drops from Africa-scale to
 * 4,443 square pixels at a 1000x500 frame, against 7,404 on Natural Earth and
 * far more on equirectangular. Antarctica is dropped in the pipeline, not
 * clipped here: it will never carry a Slovak figure and it was taking a fifth of
 * the frame to say so.
 *
 * NO ZOOM, AND NO SCROLL CAPTURE. The map is a static projection. Click-to-zoom
 * existed to let the reader separate the European pile, and the inset does that
 * permanently and without interaction, so the camera work is gone rather than
 * repaired. Nothing here attaches a wheel listener, so the page scrolls over the
 * map as it does over any figure.
 *
 * ENCODING: one channel, area. Discs are a single terracotta fill; the log
 * colour ramp is gone, because area already carried the magnitude and doubling
 * up made the small discs nearly invisible against cream. Radius scales as
 * sqrt(value), so area is proportional to the count.
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
   * citizenBasis because the subtitle previously folded it in with the
   * birth-derived rows.
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
  /** Marker label and footnote for the citizenship-basis countries. */
  citizenBasisLabel: string;
  citizenBasisNote: string;
  /** Marker label and footnote for the model-imputed country. */
  imputedLabel: string;
  imputedNote: string;
  /** Label on the Slovakia diamond. */
  originLabel: string;
  /** Inset heading and its own caption. */
  insetTitle: string;
  insetNote: string;
  /** The United States annotation: an absence, not a zero. */
  absentTitle: string;
  /** One entry per rendered line: SVG text does not wrap. */
  absentNote: string[];
  srcLine: string;
}

interface DiasporaMapProps {
  data: CountryDatum[];
  total: number;
  labels: DiasporaMapLabels;
  aboutLabel: string;
  sourcePanel: SourcePanel;
}

/** Projection frame for the world map, in SVG user units. */
const W = 1000;
const H = 500;

/** Projection frame for the European inset. */
const INSET_W = 420;
const INSET_H = 420;

/**
 * Inset window: lon -11..32, lat 34..71. Holds 32 of the 51 destinations and
 * 93.5 percent of the counted total, which is the pile the world view cannot
 * resolve. At world scale Czechia's disc has a 42px radius while Austria's
 * centroid sits 7px away and Slovakia's 10.6px, so all three are inside it.
 */
const INSET_BOUNDS: [[number, number], [number, number]] = [[-11, 34], [32, 71]];

/** Slovakia, the origin. Rendered as a diamond, never as a disc or a ring. */
const ORIGIN: [number, number] = [19.7, 48.73];

/**
 * The United States. Annotated because its absence is the section's argument:
 * UN DESA has no US row at all, since the US publishes only a combined
 * Czechoslovakia birthplace line. Placed over the continental US.
 */
const ABSENT_MARKER: [number, number] = [-98.5, 39.5];

/** Single terracotta, --accent-primary. Area is the only quantitative channel. */
const DISC_FILL = '#B83A1F';
const DISC_STROKE = '#FBF7F0';

/** Radius in SVG units at world scale; the inset scales these up. */
const MAX_R = 40;
const MIN_R = 2.2;
const INSET_MAX_R = 30;
const INSET_MIN_R = 3;

interface Bubble {
  code: string;
  name: string;
  value: number;
  lonLat: [number, number];
  citizenBasis: boolean;
  imputed: boolean;
}

export function DiasporaMap({ data, total, labels, aboutLabel, sourcePanel }: DiasporaMapProps) {
  const locale = useLocale();
  const [geojson, setGeojson] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; b: Bubble } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // World projection, fitted once to the whole feature collection.
  const world = useMemo(() => {
    if (!geojson) return null;
    const projection = geoEqualEarth().fitExtent([[2, 2], [W - 2, H - 2]], geojson);
    return { projection, path: geoPath(projection) };
  }, [geojson]);

  // Inset projection, fitted to the European window rather than to the features,
  // so the frame is the stated lon/lat box and not a bounding box of whatever
  // happens to carry data.
  //
  // The window is passed as a SAMPLED MultiPoint, not a Polygon, for two reasons.
  // A polygon ring wound counter-clockwise is the complement of the box on the
  // sphere, and d3 then fits the whole world: the first version of this did
  // exactly that and the inset rendered as a second, tiny world map. And Equal
  // Earth curves its meridians, so the four corners alone understate the box's
  // width at mid-latitudes. Sampling the edges avoids both traps.
  const inset = useMemo(() => {
    if (!geojson) return null;
    const [[w, s], [e, n]] = INSET_BOUNDS;
    const edge: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      edge.push([w + (e - w) * t, s], [w + (e - w) * t, n]);
      edge.push([w, s + (n - s) * t], [e, s + (n - s) * t]);
    }
    const projection = geoEqualEarth().fitExtent(
      [[2, 2], [INSET_W - 2, INSET_H - 2]],
      { type: 'MultiPoint', coordinates: edge } as any,
    );
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
      out.push({
        code,
        name: f.properties?.name || code,
        value: d.value,
        lonLat: [c[0], c[1]],
        citizenBasis: Boolean(d.citizenBasis),
        imputed: Boolean(d.imputed),
      });
    }
    // Largest first, so small discs paint on top and stay hoverable.
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [geojson, byCode]);

  const inInset = (b: Bubble) => {
    const [[w, s], [e, n]] = INSET_BOUNDS;
    const [lon, lat] = b.lonLat;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  };

  const radius = (v: number, maxR: number, minR: number) =>
    Math.max(minR, maxR * Math.sqrt(v / maxValue));

  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en');

  function showTip(e: React.MouseEvent, b: Bubble) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, b });
  }

  const selectedDatum = selected ? byCode.get(selected) : undefined;
  const selectedName = selected
    ? bubbles.find(b => b.code === selected)?.name || selected
    : null;

  /** One disc, shared by both frames. */
  function Disc({
    b, projection, maxR, minR,
  }: { b: Bubble; projection: any; maxR: number; minR: number }) {
    const p = projection(b.lonLat);
    if (!p) return null;
    const r = radius(b.value, maxR, minR);
    const isSelected = selected === b.code;
    return (
      <circle
        cx={p[0]}
        cy={p[1]}
        r={r}
        fill={DISC_FILL}
        fillOpacity={isSelected ? 0.95 : 0.72}
        stroke={b.citizenBasis || b.imputed ? '#2A1810' : DISC_STROKE}
        strokeWidth={b.citizenBasis || b.imputed ? 1.4 : 0.6}
        strokeDasharray={b.imputed ? '2.5 2' : undefined}
        style={{ cursor: 'pointer' }}
        onMouseMove={e => showTip(e, b)}
        onMouseLeave={() => setTip(null)}
        onClick={() => setSelected(b.code === selected ? null : b.code)}
        tabIndex={0}
        role="button"
        aria-label={`${b.name}: ${fmt(b.value)} ${labels.tooltipUnit}`}
        onFocus={() => setSelected(b.code)}
      />
    );
  }

  /** Slovakia: a diamond. Rings are reserved for the definitional flags. */
  function OriginDiamond({ projection, size }: { projection: any; size: number }) {
    const p = projection(ORIGIN);
    if (!p) return null;
    return (
      <g aria-label={labels.originLabel} transform={`translate(${p[0]},${p[1]})`}>
        <path
          d={`M0,${-size} L${size},0 L0,${size} L${-size},0 Z`}
          fill="#FBF7F0"
          stroke="#2A1810"
          strokeWidth={1.4}
        />
      </g>
    );
  }

  return (
    <figure className="diaspora-figure">
      <figcaption className="diaspora-head">
        <p className="diaspora-eyebrow">{labels.eyebrow}</p>
        <h2 className="diaspora-title">{labels.title}</h2>
        <p className="diaspora-subtitle">{labels.subtitle}</p>
      </figcaption>

      <div ref={wrapRef} className="diaspora-map-wrap">
        {world && geojson && (
          <svg
            className="diaspora-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={labels.title}
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              {geojson.features.map((f: any, i: number) => (
                <path
                  key={f.properties?.iso3 || i}
                  d={world.path(f) || undefined}
                  fill="#F4EFE3"
                  stroke="#D4A547"
                  strokeOpacity={0.45}
                  strokeWidth={0.4}
                />
              ))}
            </g>

            {/* United States: a labelled absence. Drawn before the discs so no
                disc is obscured by it. */}
            <UnitedStatesAbsence
              projection={world.projection}
              title={labels.absentTitle}
              note={labels.absentNote}
            />

            <g>
              {bubbles.map(b => (
                <Disc key={b.code} b={b} projection={world.projection} maxR={MAX_R} minR={MIN_R} />
              ))}
            </g>

            <OriginDiamond projection={world.projection} size={5} />
          </svg>
        )}

        {/* European inset. Roughly 93 percent of the counted total is inside
            this window and unreadable at world scale. */}
        {inset && geojson && (
          <div className="diaspora-inset">
            <p className="diaspora-inset-title">{labels.insetTitle}</p>
            <svg
              viewBox={`0 0 ${INSET_W} ${INSET_H}`}
              className="diaspora-inset-svg"
              role="img"
              aria-label={labels.insetTitle}
            >
              <defs>
                {/* Everything outside the frame is clipped, so land beyond the
                    window does not spill over the inset's border. */}
                <clipPath id="diaspora-inset-clip">
                  <rect x={0} y={0} width={INSET_W} height={INSET_H} />
                </clipPath>
              </defs>
              <rect x={0} y={0} width={INSET_W} height={INSET_H} fill="#DCE9EE" />
              <g clipPath="url(#diaspora-inset-clip)">
                <g>
                  {geojson.features.map((f: any, i: number) => (
                    <path
                      key={f.properties?.iso3 || i}
                      d={inset.path(f) || undefined}
                      fill="#F4EFE3"
                      stroke="#D4A547"
                      strokeOpacity={0.5}
                      strokeWidth={0.5}
                    />
                  ))}
                </g>
                <g>
                  {bubbles.filter(inInset).map(b => (
                    <Disc
                      key={b.code}
                      b={b}
                      projection={inset.projection}
                      maxR={INSET_MAX_R}
                      minR={INSET_MIN_R}
                    />
                  ))}
                </g>
                <OriginDiamond projection={inset.projection} size={6} />
              </g>
            </svg>
            <p className="diaspora-inset-note">{labels.insetNote}</p>
          </div>
        )}

        <div className="diaspora-legend">
          <p className="diaspora-legend-title">{labels.legendTitle}</p>
          <div className="diaspora-legend-bubbles">
            {[1000, 20_000, 113_773].map(t => {
              const r = radius(t, 26, 2);
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
          {/* Swatches are inline SVG, not bordered spans: a CSS dashed border on
              an 11px circle renders as a smudge at this size and could not be
              told apart from the solid one. */}
          <p className="diaspora-legend-flag">
            <svg className="diaspora-legend-mark" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7" fill={DISC_FILL} fillOpacity={0.72}
                stroke="#2A1810" strokeWidth={1.6} />
            </svg>
            {labels.citizenBasisLabel}
          </p>
          <p className="diaspora-legend-flag">
            <svg className="diaspora-legend-mark" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="10" r="7" fill={DISC_FILL} fillOpacity={0.72}
                stroke="#2A1810" strokeWidth={1.6} strokeDasharray="3 2.4" />
            </svg>
            {labels.imputedLabel}
          </p>
          <p className="diaspora-legend-flag">
            <svg className="diaspora-legend-mark" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10,2 L18,10 L10,18 L2,10 Z" fill="#FBF7F0"
                stroke="#2A1810" strokeWidth={1.6} />
            </svg>
            {labels.originLabel}
          </p>
        </div>

        {tip && (
          <div
            className="diaspora-tip"
            style={{ left: tip.x + 14, top: tip.y + 14 }}
            aria-hidden="true"
          >
            <span className="diaspora-tip-name">{tip.b.name}</span>
            <span className="diaspora-tip-value">{fmt(tip.b.value)}</span>
            {tip.b.citizenBasis && (
              <span className="diaspora-tip-basis">{labels.citizenBasisLabel}</span>
            )}
            {tip.b.imputed && (
              <span className="diaspora-tip-basis">{labels.imputedLabel}</span>
            )}
          </div>
        )}
      </div>

      <div className="diaspora-detail">
        {!selected ? (
          <>
            <p className="diaspora-detail-eyebrow">{labels.totalLabel}</p>
            <p className="diaspora-detail-value">{fmt(total)}</p>
            <p className="diaspora-detail-sub">{labels.year}</p>
          </>
        ) : (
          <>
            <p className="diaspora-detail-eyebrow">{selectedName}</p>
            {selectedDatum && selectedDatum.value > 0 ? (
              <>
                <p className="diaspora-detail-value">{fmt(selectedDatum.value)}</p>
                <p className="diaspora-detail-sub">
                  {labels.tooltipUnit} · {labels.year}
                </p>
                {selectedDatum.citizenBasis && (
                  <p className="diaspora-detail-note">{labels.citizenBasisNote}</p>
                )}
                {selectedDatum.imputed && (
                  <p className="diaspora-detail-note">{labels.imputedNote}</p>
                )}
              </>
            ) : (
              <p className="diaspora-detail-note">{labels.noData}</p>
            )}
            <button type="button" className="diaspora-reset" onClick={() => setSelected(null)}>
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

/**
 * The United States, annotated as an absence.
 *
 * Currently the largest empty space on the map, which reads as a rendering bug.
 * It is not: UN DESA has no United States row for Slovak origin at all, because
 * the US publishes only a combined "Czechoslovakia (includes Czech Republic and
 * Slovakia)" birthplace line, and the UN builds origin estimates from what
 * destinations publish. Verified in the source workbook: 150 origin countries
 * are published for the US and Slovakia is not among them, while the row's
 * world total exceeds the sum of its published origins by 4.05 million.
 *
 * A hollow marker with a rule to a label, so it cannot be read as a disc.
 */
function UnitedStatesAbsence({
  projection, title, note,
}: { projection: any; title: string; note: string[] }) {
  const p = projection(ABSENT_MARKER);
  if (!p) return null;
  const [x, y] = p;
  // Label sits down-left of the marker, over the eastern Pacific, clear of the
  // Mexican and Central American discs.
  const lx = x - 96;
  const ly = y + 74;
  return (
    <g className="diaspora-absent" aria-label={`${title}. ${note.join(' ')}`}>
      <circle
        cx={x}
        cy={y}
        r={7}
        fill="none"
        stroke="#8B6F4F"
        strokeWidth={1.1}
        strokeDasharray="3 2.5"
      />
      <line x1={x - 3.4} y1={y - 3.4} x2={x + 3.4} y2={y + 3.4} stroke="#8B6F4F" strokeWidth={1.1} />
      <line x1={x - 3.4} y1={y + 3.4} x2={x + 3.4} y2={y - 3.4} stroke="#8B6F4F" strokeWidth={1.1} />
      <line x1={x - 6} y1={y + 6} x2={lx + 84} y2={ly - 12} stroke="#8B6F4F" strokeWidth={0.7} />
      <text x={lx} y={ly} className="diaspora-absent-title">{title}</text>
      {/* SVG text does not wrap and the mobile breakpoint scales this up, so the
          line breaks are authored in the content module. dy is in em, so the
          leading tracks whatever font-size the breakpoint sets. The first line's
          baseline clears the title by 1.6em for the same reason. */}
      <text x={lx} y={ly} className="diaspora-absent-note">
        {note.map((line, i) => (
          <tspan key={i} x={lx} dy={i === 0 ? '1.6em' : '1.25em'}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

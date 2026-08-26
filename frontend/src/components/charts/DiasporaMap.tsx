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
 * (EPSG:3035) uses, and is equal-area without the polar squash inside this window.
 * The window's aspect, 1.17, is measured from its own content, not chosen. The
 * locator uses Natural Earth 1 because a whole-world frame needs a compromise
 * projection and its Greenland is the less distorted of the two.
 *
 * ONE DISC SCALE, MEASURED. A radius depends only on the value, so the projection
 * never distorts a disc; but a radius is in the user units of whichever viewBox
 * draws it, and the two viewBoxes render at different CSS widths. Equal radii are
 * therefore NOT equal apparent size, which was a live bug once the frames stopped
 * being the same width. `locFactor` measures both frames' pixels-per-user-unit and
 * corrects the locator, so one legend genuinely serves both at any viewport.
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
 * MEMBERSHIP TEST, not the frame. Which destinations are "European" for the
 * purpose of splitting the 51 rows between the two figures: lon -25..45, lat
 * 34..72 holds 35 of them and 393,444 of the 419,651 counted people.
 *
 * This used to be the projection window too, and that was the cause of the empty
 * Arctic and Atlantic bands. The box has to be generous to include Iceland and
 * Cyprus as members, but a generous box projected literally puts its own corners
 * in open ocean: measured on the render, the shipped -25..45/34..72 frame had
 * 197px of dead water left of the westmost disc and 98px above the northmost, and
 * only 41 percent of the frame carried ink. The two jobs are now separate. This
 * decides membership; EU_MARGIN and the discs decide the frame.
 */
const EU_MEMBER_BOX: [[number, number], [number, number]] = [[-25, 34], [45, 72]];

/** EPSG:3035's centre. */
const EU_CENTRE: [number, number] = [10, 52];

/**
 * Padding in projected units between the frame and the outermost member land.
 *
 * Raised from 10 to 18 because 10 was not enough to stop a coastline READING as
 * cut even when it was not: Cyprus sat about 10px inside the east edge and looked
 * sliced. Nothing is clipped at either value; this is about apparent clearance.
 */
const EU_MARGIN = 18;

/**
 * FIGURE WIDTH. Map and strip share this, so they share a left and right edge.
 * The viewBox is authored in the same units, so 1 unit = 1 CSS pixel at full size
 * and MAX_R, stroke widths and the SVG label size all mean what they say.
 */
const MAP_W = 900;

/**
 * MAP HEIGHT, and it is a budget outcome rather than a free choice.
 *
 * The figure must fit 900px in total including the title. Measured on the render,
 * the rest of it costs: head 102, strip 230, foot 32, gaps 36 = 400. That leaves 500.
 * 620 was asked for and does not fit: it lands the figure at about 1028, because the
 * strip's locator cell needs 230 rather than the 170 the budget assumed.
 *
 * WHAT THIS COSTS, stated plainly. The tightest frame holding all 35 European
 * destinations and their land has aspect 1.175, because Norway's north coast at
 * 71N and Sicily set its height and nothing inside a 1 percent mass budget can
 * move either. Forcing 900x500 means aspect 1.800, so about 35 percent of the
 * width is beyond the tight box. That slack is the price of the shared edge and
 * the height cap; it is not a fitting error. Making the map taller reduces it and
 * pushes the figure past 900.
 */
const MAP_H = 500;

/**
 * How the horizontal slack is split, west versus east. Half each.
 *
 * Tried 0.34, biased east on the theory that slack spent over land looks less empty
 * than slack spent over water. Wrong, on the render: 66 percent of 319 units pushed
 * the frame into Iraq and Saudi Arabia, and a large empty LANDMASS reads as missing
 * data in a proportional-symbol map, where empty ocean reads as nothing at all.
 * Centred keeps the Middle East out of frame and puts the surplus in the Atlantic.
 *
 * No projection fixes this. Measured over the same 35 destinations, every candidate
 * gives Europe essentially the same shape: LAEA 1.175, Albers 40/65 1.163, Albers
 * 43/62 1.184, Lambert conformal 1.179. Europe is 1.17 wide-to-tall and the slack is
 * a function of the target aspect alone.
 */
const EU_WEST_SHARE = 0.5;

/**
 * World locator, cropped in latitude to -36..72.
 *
 * Not the whole globe: the 14 destinations out here span -28.9 (South Africa) to
 * 66.1 (Russia), so everything below -36 or above 72 is empty ocean and Arctic.
 * Cropping takes the aspect from 2.316 to 2.936, which is 35px of height saved at
 * a 380px cell width, and height is the constraint that decides whether the strip
 * clears the fold. Both extremes keep 6 degrees of margin, and the United States
 * (25..49) is well inside.
 */
const LOC_LAT: [number, number] = [-36, 72];
const LOC_W = 300;
const LOC_H = Math.round(LOC_W / 2.936);

/** Slovakia, the origin. A text label with a leader tick, not a glyph. */
const ORIGIN: [number, number] = [19.7, 48.73];

/**
 * Half-width and half-height of the origin diamond, in projected units.
 *
 * The Cicmany diamond from 05-design.md, which is the one shape the design system
 * allows and specifies for map markers: `M 0 -h L w 0 L 0 h L -w 0 Z`. Unfilled,
 * no leader line, sitting on Slovakia's centroid.
 *
 * This replaces an outlined polygon plus a leader plus a placed label, which went
 * through three positions and still read as labelling a neighbour. The reason it
 * kept failing is that a label needs an unambiguous anchor, and Slovakia has no
 * disc to anchor to; a distinct mark at the point is the anchor. The word now lives
 * in the key rather than on the map, so there is nothing left to collide.
 */
const ORIGIN_R = 5.5;

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


export function DiasporaMap({ data, total, labels, aboutLabel, sourcePanel }: DiasporaMapProps) {
  const locale = useLocale();
  const [geojson, setGeojson] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; b: Bubble } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const euSvgRef = useRef<SVGSVGElement>(null);
  const locSvgRef = useRef<SVGSVGElement>(null);

  /**
   * ONE DISC SCALE ACROSS BOTH FRAMES, MEASURED RATHER THAN ASSUMED.
   *
   * A radius is in the user units of whichever viewBox draws it, and the two
   * viewBoxes are rendered at different CSS widths, so equal radii do NOT mean
   * equal apparent size. That was a live bug: the locator's 300-unit viewBox
   * rendered at 380px while Europe's 584-unit box rendered at 584px, so every
   * locator disc was 27 percent larger than the same value in the main frame and
   * the legend's "one basis" claim was false.
   *
   * This measures both frames' pixels-per-user-unit and gives the locator a
   * correction factor, so a count is the same apparent size everywhere including
   * the legend, at every viewport rather than only at the design width.
   */
  const [locFactor, setLocFactor] = useState(1);
  useEffect(() => {
    const measure = () => {
      const e = euSvgRef.current;
      const l = locSvgRef.current;
      if (!e || !l) return;
      const eBox = e.viewBox.baseVal;
      const lBox = l.viewBox.baseVal;
      const eW = e.getBoundingClientRect().width;
      const lW = l.getBoundingClientRect().width;
      if (!eBox.width || !lBox.width || !eW || !lW) return;
      const euPerUnit = eW / eBox.width;
      const locPerUnit = lW / lBox.width;
      if (!locPerUnit) return;
      const next = euPerUnit / locPerUnit;
      setLocFactor(prev => (Math.abs(prev - next) > 0.005 ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (euSvgRef.current) ro.observe(euSvgRef.current);
    if (locSvgRef.current) ro.observe(locSvgRef.current);
    return () => ro.disconnect();
  }, [geojson]);

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

  // Locator: fitted to the cropped latitude band rather than to the whole feature
  // collection, so the empty southern ocean and Arctic are not paid for in height.
  const loc = useMemo(() => {
    if (!geojson) return null;
    const coordinates: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const t = i / 90;
      coordinates.push([-180 + 360 * t, LOC_LAT[0]], [-180 + 360 * t, LOC_LAT[1]]);
    }
    const projection = geoNaturalEarth1().fitExtent(
      [[2, 2], [LOC_W - 2, LOC_H - 2]],
      { type: 'MultiPoint', coordinates } as any,
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
    const [[w, s], [e, n]] = EU_MEMBER_BOX;
    const [lon, lat] = b.lonLat;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  };

  const european = useMemo(() => bubbles.filter(inEurope), [bubbles]);
  /** The tail: everything the European frame does not hold. */
  const tail = useMemo(() => bubbles.filter(b => !inEurope(b)), [bubbles]);

  const radius = (v: number) => Math.max(MIN_R, MAX_R * Math.sqrt(v / maxValue));

  /**
   * Europe: LAEA on EPSG:3035's centre, then the viewBox is measured from the
   * DISCS rather than from a lon/lat box, which is what removes the empty Arctic
   * and Atlantic bands. Fitted to the member discs' centroids at an arbitrary
   * reference size, the ink box is expanded by each disc's own radius, and
   * EU_MARGIN is added all round.
   *
   * Depends on `european` and on the radius scale, so it has to come after them.
   */
  /**
   * Every member country's LAND, in lon/lat, clipped to the membership box.
   *
   * The clip is what makes fitting to land workable without per-country special
   * cases. France's polygon reaches French Guiana and Reunion, and Norway's
   * reaches Svalbard at 81N; fitted literally, either would blow the frame open.
   * The membership box already defines what counts as European for this figure,
   * so reusing it as the clip removes exactly the territory that is out of scope.
   */
  const memberLand = useMemo<[number, number][]>(() => {
    if (!geojson || !european.length) return [];
    const [[bw, bs], [be, bn]] = EU_MEMBER_BOX;
    const codes = new Set(european.map(b => b.code));
    const out: [number, number][] = [];
    const walk = (c: any) => {
      if (typeof c[0] === 'number') {
        if (c[0] >= bw && c[0] <= be && c[1] >= bs && c[1] <= bn) out.push([c[0], c[1]]);
      } else for (const n of c) walk(n);
    };
    for (const f of geojson.features) {
      if (!codes.has(f.properties?.iso3)) continue;
      walk(f.geometry.coordinates);
    }
    return out;
  }, [geojson, european]);

  /**
   * Europe: LAEA on EPSG:3035's centre, with the viewBox measured from the
   * rendered content rather than from a lon/lat box.
   *
   * Fitted to member LAND as well as the discs. Fitting to discs alone was tight
   * enough to slice coastlines mid-shape, which reads as a rendering fault rather
   * than as a map window: measured at the vertex level, Finland overshot the north
   * edge by 51 units, Turkey the east by 138, Iceland 23, Sweden 20, Crete 17 and
   * Portugal 10. Including the land removes all of them at a cost of only 0.07 in
   * aspect, and it is why EU_MARGIN can come down from 14 to 10.
   */
  const eu = useMemo(() => {
    const projection = geoAzimuthalEqualArea().rotate([-EU_CENTRE[0], -EU_CENTRE[1]]);
    const seed = {
      type: 'MultiPoint',
      coordinates: memberLand.length
        ? (memberLand as any[]).concat(european.map(b => b.lonLat))
        : [EU_MEMBER_BOX[0], EU_MEMBER_BOX[1]],
    } as any;

    /**
     * The ink box: every member land vertex, plus every disc's full extent. Radii
     * are fixed in output units while the geography scales with the projection, so
     * the box is not a linear function of scale and the target has to be solved
     * for rather than computed in one step.
     */
    const ink = () => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of memberLand) {
        const p = projection(c);
        if (!p) continue;
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      for (const b of european) {
        const p = projection(b.lonLat);
        if (!p) continue;
        const r = radius(b.value);
        x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r);
        y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r);
      }
      return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
    };

    projection.fitExtent([[0, 0], [MAP_H, MAP_H]], seed);
    if (!european.length || !memberLand.length) {
      return { projection, path: geoPath(projection), viewBox: `0 0 ${MAP_W} ${MAP_H}` };
    }

    /**
     * Solve the scale so the inflated ink box exactly fills the 900x520 frame in
     * its binding dimension. Whichever of height or width/aspect is larger is the
     * one that binds; for this window it is always height, but the max() keeps that
     * an observation rather than an assumption.
     *
     * Iterated because the radii are fixed in output units while the geography
     * scales, so the box is not a linear function of scale.
     */
    const A = MAP_W / MAP_H;
    for (let i = 0; i < 10; i++) {
      const m = ink();
      const need = Math.max(m.h + 2 * EU_MARGIN, (m.w + 2 * EU_MARGIN) / A);
      if (Math.abs(need - MAP_H) < 0.05) break;
      projection.scale(projection.scale() * (MAP_H / need));
    }

    const m = ink();
    const w = m.w + 2 * EU_MARGIN;
    // Vertically centred on the content. Horizontally, the slack goes mostly east.
    const vy = (m.y0 + m.y1) / 2 - MAP_H / 2;
    const vx = w < MAP_W
      ? (m.x0 - EU_MARGIN) - (MAP_W - w) * EU_WEST_SHARE
      : (m.x0 + m.x1) / 2 - MAP_W / 2;
    return {
      projection,
      path: geoPath(projection),
      viewBox: `${vx} ${vy} ${MAP_W} ${MAP_H}`,
      box: { x: vx, y: vy, w: MAP_W, h: MAP_H },
    };
  }, [memberLand, european, maxValue]);

  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en');


  /** Feature by ISO3, for drawing a country's outline when it is active. */
  const featureByCode = useMemo(() => {
    const m = new Map<string, any>();
    if (!geojson) return m;
    for (const f of geojson.features) {
      const iso = f.properties?.iso3;
      if (iso) m.set(iso, f);
    }
    return m;
  }, [geojson]);

  /**
   * What is under the pointer: read it off the event target rather than computing it.
   *
   * Every disc and every country path carries data-iso, so the browser's own hit
   * testing answers the question, and it answers it against the geometry the reader
   * can actually see. Disc-over-country priority comes free, because discs are
   * painted above the land and so win the hit naturally.
   *
   * THIS REPLACED projection.invert + geoContains, which was wrong at locator scale.
   * Exact spherical containment disagrees with the rasterised path by roughly the
   * width of the feature: Australia's Cape York renders as a sliver of land a pixel
   * or two wide, and a point the reader sees as inside it inverted to 142.1E 10.9S,
   * which is the Torres Strait and correctly not in Australia. Countries were
   * unhittable wherever they were narrower than their own rendering error. Reading
   * the target cannot drift from the render, needs no tolerance fudge, and does no
   * work per mousemove.
   *
   * The frame check matters: the locator draws every country, including European
   * ones whose discs live in the other frame. Without it, hovering Germany on the
   * locator would name a country with no mark under the cursor.
   */
  function resolveTarget(e: React.MouseEvent, frame: Bubble[]): Bubble | null {
    const el = (e.target as Element | null)?.closest?.('[data-iso]') as Element | null;
    const iso = el?.getAttribute('data-iso');
    if (!iso) return null;
    return frame.find(b => b.code === iso) || null;
  }

  function showTip(e: { clientX: number; clientY: number }, b: Bubble) {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, b });
  }

  const clearTip = () => setTip(null);

  /**
   * HIT TEST ON THE SVG ROOT. This, not the per-disc mouseleave, is what actually
   * dismisses the tooltip.
   *
   * The bug this replaces: moving off a disc into ocean INSIDE the same SVG fires
   * no mouseleave on the root, and React's synthetic mouseleave on the circle was
   * unreliable for the same reason the tooltip survived at all. The earlier
   * verification tested the wrong event: it measured leaving the SVG entirely,
   * which was never the failing case.
   *
   * So the root owns the tooltip. Every mousemove inside either frame is tested
   * against every disc in that frame, and a miss clears. Distance is compared in
   * the SVG's own user units via getScreenCTM().inverse(), because both viewBoxes
   * are scaled by CSS and a client-pixel radius would be wrong by that factor.
   * Topmost-wins: the list is painted largest-first, so it is searched in reverse
   * to match what the reader can actually see and click.
   */
  function handleFrameMove(e: React.MouseEvent<SVGSVGElement>, frame: Bubble[]) {
    const hit = resolveTarget(e, frame);
    if (hit) showTip(e, hit);
    else if (tip) clearTip();
  }

  /**
   * Click resolves through the same function as hover, so the thing you clicked is
   * always the thing the tooltip named. Clicking away from any country clears the
   * selection, which makes the ocean the reset affordance.
   *
   * Handled at the root rather than on each disc: with both, a click on a disc would
   * bubble and toggle twice, cancelling itself.
   */
  function handleFrameClick(e: React.MouseEvent<SVGSVGElement>, frame: Bubble[]) {
    const hit = resolveTarget(e, frame);
    setSelected(hit ? (hit.code === selected ? null : hit.code) : null);
  }

  // The remaining ways the cursor stops being where the tooltip says it is:
  // scrolling, the window losing focus, and leaving the stage entirely (which the
  // stage's own onMouseLeave covers).
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

  /**
   * One disc. `factor` corrects for the frame's pixels-per-user-unit so that a
   * given count is the same apparent size in both frames and in the legend.
   */
  function Disc({ b, projection, factor = 1 }: { b: Bubble; projection: any; factor?: number }) {
    const p = projection(b.lonLat);
    if (!p) return null;
    const r = radius(b.value) * factor;
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
        data-iso={b.code}
        /* No pointer handlers here. The SVG root hit-tests for both hover and click,
           so moving into ocean inside the same frame clears the tooltip, and the
           whole country is a target rather than just this circle. A click here still
           bubbles to the root, which resolves it.

           The disc stays the KEYBOARD affordance: a country polygon cannot carry a
           sensible focus ring, and the discs give a predictable tab order. */
        tabIndex={0}
        role="button"
        aria-label={`${b.name}: ${fmt(b.value)} ${labels.tooltipUnit}`}
        onFocus={() => setSelected(b.code)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelected(b.code === selected ? null : b.code);
          }
        }}
      />
    );
  }

  /**
   * The active country's edges, drawn ABOVE the discs so the highlight is never
   * buried under a neighbour's mark. Active means hovered, or selected when nothing
   * is hovered, so a click leaves the outline in place after the cursor moves away.
   *
   * Unfilled: area is the quantitative channel, and tinting a country would sit on
   * top of the disc whose area the reader is trying to judge.
   */
  function ActiveOutline({ projection, frame }: { projection: any; frame: Bubble[] }) {
    const code = tip?.b.code || selected;
    if (!code) return null;
    if (!frame.some(b => b.code === code)) return null;
    const f = featureByCode.get(code);
    if (!f) return null;
    const d = geoPath(projection)(f);
    if (!d) return null;
    return <path className="diaspora-active-shape" d={d} />;
  }

  /** Slovakia: the Cicmany diamond on its centroid. No leader, no label, no fill. */
  function OriginDiamond({ projection, label }: { projection: any; label: string }) {
    const p = projection(ORIGIN);
    if (!p) return null;
    const [x, y] = p;
    const h = ORIGIN_R;
    return (
      <path
        className="diaspora-origin-diamond"
        d={`M ${x} ${y - h} L ${x + h} ${y} L ${x} ${y + h} L ${x - h} ${y} Z`}
        aria-label={label}
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
        <h2 className="diaspora-title">{labels.title}</h2>
        <p className="diaspora-subtitle">{labels.subtitle}</p>
      </figcaption>

      {/* Map, then a three-cell strip, then a full-width footer.
          Strip cell 1 locator + its caption + the US annotation, cell 2 readout,
          cell 3 disc scale + ring key. Source and About run full width beneath.

          ONE WIDTH. Head, map and strip are all MAP_W (900px) and centred, so they
          share a left and right edge. The map is 900 x 520; see MAP_H for why 520
          and not the 620 asked for, and for what the resulting horizontal slack
          costs. */}
      <div ref={stageRef} className="diaspora-stage" onMouseLeave={clearTip}>
        <div className="diaspora-primary">
          <svg
            ref={euSvgRef}
            className="diaspora-eu-svg"
            viewBox={eu.viewBox}
            role="img"
            aria-label={labels.title}
            preserveAspectRatio="xMidYMid meet"
            /* No inline sizing. The frame is now a fixed MAP_W x MAP_H window, so
               the aspect ratio is a constant the stylesheet can hold, and the width
               comes from the shared 900px figure width. */
            onMouseMove={e => handleFrameMove(e, european)}
            onClick={e => handleFrameClick(e, european)}
          >
              {eu.box && (
                <>
                  <defs>
                    <clipPath id="diaspora-eu-clip">
                      <rect x={eu.box.x} y={eu.box.y} width={eu.box.w} height={eu.box.h} />
                    </clipPath>
                  </defs>
                  <rect
                    x={eu.box.x} y={eu.box.y} width={eu.box.w} height={eu.box.h}
                    fill="#DCE9EE"
                  />
                </>
              )}
              {geojson && (
                <g clipPath="url(#diaspora-eu-clip)">
                  <g>
                    {geojson.features.map((f: any, i: number) => (
                      <path
                        key={f.properties?.iso3 || i}
                        /* data-iso so the frame-edge assertion is checkable against
                           the render: no MEMBER destination's land may cross an
                           edge. Non-members (Russia, North Africa) are expected to
                           be cut, the way any map window cuts them. */
                        data-iso={f.properties?.iso3}
                        className={
                          byCode.has(f.properties?.iso3)
                            ? 'diaspora-land diaspora-land-data'
                            : 'diaspora-land'
                        }
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
                  <ActiveOutline projection={eu.projection} frame={european} />
                  <OriginDiamond projection={eu.projection} label={labels.originLabel} />
                </g>
              )}
          </svg>
        </div>

        {/* THE STRIP: locator | readout | scale + ring key. */}
        <div className="diaspora-strip">
          {loc && geojson && (
            <div className="diaspora-locator">
              <p className="diaspora-locator-title">{labels.locatorTitle}</p>
              <svg
                ref={locSvgRef}
                viewBox={`0 0 ${LOC_W} ${LOC_H}`}
                className="diaspora-locator-svg"
                role="img"
                aria-label={labels.locatorTitle}
                onMouseMove={e => handleFrameMove(e, tail)}
                onClick={e => handleFrameClick(e, tail)}
              >
                <rect x={0} y={0} width={LOC_W} height={LOC_H} fill="#DCE9EE" />
                <g>
                  {geojson.features.map((f: any, i: number) => {
                    const iso = f.properties?.iso3;
                    // The United States is outlined, not filled differently: the
                    // annotation beneath says what the outline means, so this is
                    // not a third symbol convention competing with the discs.
                    const isUS = iso === 'USA';
                    return (
                      <path
                        key={iso || i}
                        data-iso={iso}
                        className={
                          byCode.has(iso) ? 'diaspora-land diaspora-land-data' : 'diaspora-land'
                        }
                        d={loc.path(f) || undefined}
                        fill="#F4EFE3"
                        stroke={isUS ? RING_STROKE : '#D4A547'}
                        strokeOpacity={isUS ? 0.85 : 0.45}
                        strokeWidth={isUS ? 0.9 : 0.4}
                      />
                    );
                  })}
                </g>
                <g>
                  {tail.map(b => (
                    <Disc key={b.code} b={b} projection={loc.projection} factor={locFactor} />
                  ))}
                </g>
                <ActiveOutline projection={loc.projection} frame={tail} />
              </svg>
              {/* HTML, not SVG text. The old version authored its line breaks by
                  hand in the content module and needed a mobile font-size
                  override, because SVG text neither wraps nor scales with the
                  reader's type size. */}
              <p className="diaspora-locator-note">{labels.locatorNote}</p>
              <p className="diaspora-absent">
                <span className="diaspora-absent-title">{labels.absentTitle}</span>{' '}
                {labels.absentNote}
              </p>
            </div>
          )}

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
            {/* The origin diamond's key. It is a third mark, which cuts against the
                two-convention rule, but Slovakia has to be identifiable and every
                attempt at labelling it on the map read as labelling a neighbour.
                Keyed here, the map stays uncluttered and the mark is unambiguous. */}
            <p className="diaspora-legend-flag">
              <svg className="diaspora-legend-mark" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M 10 3 L 17 10 L 10 17 L 3 10 Z" fill="none"
                  stroke={RING_STROKE} strokeWidth={1.8} />
              </svg>
              {labels.originLabel}
            </p>
          </div>
        </div>

        {/* Source and About, full width beneath the strip. */}
        <div className="diaspora-foot">
          <p className="diaspora-src">{labels.srcLine}</p>
          <AboutData label={aboutLabel} panel={sourcePanel} />
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

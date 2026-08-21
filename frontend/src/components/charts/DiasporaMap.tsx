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
 * Padding in projected units between the frame and the outermost thing it must
 * hold. Small, because the frame is fitted to LAND as well as discs now, so the
 * margin is breathing room rather than the only thing preventing a clip.
 */
const EU_MARGIN = 10;

/**
 * Target HEIGHT of the European frame in SVG user units, which equal CSS pixels
 * at the frame's design size, so MAX_R and the label font size mean what they say.
 *
 * Height rather than width, because height is the binding constraint. 435 is what
 * is left of a 900px viewport after the head (map top lands at 214), the gap, and
 * the strip, and it was arrived at by measuring the strip rather than by guessing:
 * the strip needs 215px, not the 170 the budget assumed, because its locator cell
 * holds a world map plus two paragraphs. The map gives up the difference so the
 * whole strip clears the fold. Width follows from the window's own aspect, 1.17.
 *
 * An earlier version solved for width and got this wrong in a way worth keeping a
 * note of: it fitted at a 1000-unit reference and let the measured ink box become
 * the viewBox, which came out 1032.8 units wide but rendered at 692px, so
 * everything scaled by 0.67 and MIN_R 2.4 drew at 1.6px.
 */
const EU_H = 435;

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
 * Offset from Slovakia's centroid to the label's anchor, in projected units:
 * below and to the right.
 *
 * From a grid search over the RENDERED layout, checking the label's measured box
 * and the leader segment against every disc. Straight down does not work: Hungary's
 * disc sits 31 units directly below Slovakia's centroid with under 1 unit of
 * horizontal offset, so a vertical leader of any useful length passes through it,
 * and a drop long enough to clear it (76) put the label in Croatia.
 *
 * Pushed out from (44, 32) to (64, 44) after looking at the render. Geometric
 * clearance was never the problem: at (44, 32) the label box cleared every disc and
 * the leader cleared Hungary by 12.5 units, and it still read wrong, because the
 * leader's origin sat almost on Czechia's ring and the label's left edge almost
 * touched Hungary's disc. Proximity, not overlap. The extra distance plus the
 * outlined polygon below is what makes it a country label.
 */
const ORIGIN_OFFSET: [number, number] = [64, 44];

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

/**
 * The membership box as a closed LineString, for drawing its outline on the
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

    const target = EU_H - 2 * EU_MARGIN;
    projection.fitExtent([[0, 0], [target, target]], seed);
    if (!european.length || !memberLand.length) {
      return { projection, path: geoPath(projection), viewBox: `0 0 ${EU_H} ${EU_H}` };
    }
    // Converges to well under a pixel in a couple of passes: the relationship is
    // close to affine, since only the radii are scale-invariant.
    for (let i = 0; i < 8; i++) {
      const m = ink();
      if (Math.abs(m.h - target) < 0.05) break;
      projection.scale(projection.scale() * (target / m.h));
    }
    const m = ink();
    const vx = m.x0 - EU_MARGIN;
    const vy = m.y0 - EU_MARGIN;
    const vw = m.w + 2 * EU_MARGIN;
    const vh = m.h + 2 * EU_MARGIN;
    return {
      projection,
      path: geoPath(projection),
      viewBox: `${vx} ${vy} ${vw} ${vh}`,
      box: { x: vx, y: vy, w: vw, h: vh },
    };
  }, [memberLand, european, maxValue]);

  const fmt = (n: number) => Math.round(n).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en');

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
  function handleFrameMove(
    e: React.MouseEvent<SVGSVGElement>, frame: Bubble[], proj: any, factor = 1,
  ) {
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    for (let i = frame.length - 1; i >= 0; i--) {
      const b = frame[i];
      const p = proj(b.lonLat);
      if (!p) continue;
      // Same radius the disc is drawn with, factor included, or the hit area and
      // the mark disagree.
      const r = radius(b.value) * factor;
      const dx = pt.x - p[0];
      const dy = pt.y - p[1];
      if (dx * dx + dy * dy <= r * r) {
        showTip(e, b);
        return;
      }
    }
    if (tip) clearTip();
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
        /* No onMouseMove/onMouseLeave here: the SVG root hit-tests instead, so
           moving into ocean inside the same frame clears the tooltip. */
        onClick={() => setSelected(b.code === selected ? null : b.code)}
        tabIndex={0}
        role="button"
        aria-label={`${b.name}: ${fmt(b.value)} ${labels.tooltipUnit}`}
        onFocus={() => setSelected(b.code)}
      />
    );
  }

  /**
   * Slovakia. A label with a leader tick to its centroid, placed BELOW Czechia's
   * disc rather than beside it.
   *
   * Beside the disc it read as a label FOR the disc, which is exactly wrong: the
   * disc there is Czechia's 113,773, and Slovakia is the origin, the one country
   * on the map with no disc at all. Dropping it below the pile and tying it back
   * with a tick makes it a country label. The tick ends short of the centroid so
   * the line does not read as a pointer to a datum.
   */
  function OriginLabel({ projection, label }: { projection: any; label: string }) {
    const p = projection(ORIGIN);
    if (!p) return null;
    const [x, y] = p;
    const tx = x + ORIGIN_OFFSET[0];
    const ty = y + ORIGIN_OFFSET[1];
    // The leader runs from just outside the centroid dot to just above the
    // label's cap line, so it touches neither.
    const len = Math.hypot(tx - x, ty - y) || 1;
    const ux = (tx - x) / len;
    const uy = (ty - y) / len;
    return (
      <g aria-label={label}>
        <line
          x1={x + ux * 4} y1={y + uy * 4}
          x2={tx - ux * 6} y2={ty - 12}
          className="diaspora-origin-tick"
        />
        <text className="diaspora-origin-label" x={tx} y={ty} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  }

  /**
   * Slovakia's own outline, so the label has something to label.
   *
   * Slovakia is the one country in this frame with no disc, being the origin rather
   * than a destination, and a label floating in the gap between Czechia's and
   * Hungary's discs read as belonging to one of them. Outlining the country makes
   * the referent unambiguous, and it reuses the treatment the locator already gives
   * the United States rather than introducing a third point symbol.
   *
   * Drawn ON TOP of the discs. Czechia's 36-unit disc covers most of Slovakia, so
   * underneath them only the eastern lobe showed and the outline could not do its
   * job. A country-shaped outline is in no danger of being mistaken for a disc, and
   * it is unfilled where it crosses one so the disc's area still reads.
   */
  function OriginOutline({ projection }: { projection: any }) {
    if (!geojson) return null;
    const f = geojson.features.find((x: any) => x.properties?.iso3 === 'SVK');
    if (!f) return null;
    const d = geoPath(projection)(f);
    if (!d) return null;
    return <path className="diaspora-origin-shape" d={d} />;
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

      {/* Map, then a three-cell strip, then a full-width footer.
          Strip cell 1 locator + its caption + the US annotation, cell 2 readout,
          cell 3 disc scale + ring key. Source and About run full width beneath.

          HEIGHT IS THE BINDING CONSTRAINT and it is in tension with a full-width
          map. This window's aspect is 1.17, so a map spanning the 1032px content
          column would be 881px tall and the strip below it would land near 1100 on
          a 900px viewport, which is the below-the-fold defect again. The map is
          therefore capped to EU_H and centred: it spans the column as a block, and
          the drawing is as wide as the height budget allows. */}
      <div ref={stageRef} className="diaspora-stage" onMouseLeave={clearTip}>
        <div className="diaspora-primary">
          <svg
            ref={euSvgRef}
            className="diaspora-eu-svg"
            viewBox={eu.viewBox}
            role="img"
            aria-label={labels.title}
            preserveAspectRatio="xMidYMid meet"
            /* Aspect and the width cap both come from the computed viewBox: the
               frame is measured from land and discs at runtime, so there is no
               constant to put in the stylesheet. max-width is the width the height
               budget buys, so height never exceeds EU_H and nothing letterboxes. */
            style={eu.box
              ? {
                aspectRatio: `${eu.box.w} / ${eu.box.h}`,
                maxWidth: `${Math.round(EU_H * (eu.box.w / eu.box.h))}px`,
              }
              : undefined}
            onMouseMove={e => handleFrameMove(e, european, eu.projection)}
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
                  <OriginOutline projection={eu.projection} />
                  <OriginLabel projection={eu.projection} label={labels.originLabel} />
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
                onMouseMove={e => handleFrameMove(e, tail, loc.projection, locFactor)}
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
                        d={loc.path(f) || undefined}
                        fill="#F4EFE3"
                        stroke={isUS ? RING_STROKE : '#D4A547'}
                        strokeOpacity={isUS ? 0.85 : 0.45}
                        strokeWidth={isUS ? 0.9 : 0.4}
                      />
                    );
                  })}
                </g>
                {/* The membership box, so the locator says where the primary
                    figure is.

                    A LineString, not a Polygon. As a Polygon this drew a dashed
                    loop around most of the world: d3 reads ring winding to decide
                    which side is the interior, and the wrong sense makes the box
                    the complement of itself on the sphere. A LineString has no
                    interior to get backwards. The edges are sampled rather than
                    cornered because Natural Earth curves its meridians. */}
                <path
                  className="diaspora-window-outline"
                  d={loc.path(windowOutline(EU_MEMBER_BOX)) || undefined}
                />
                <g>
                  {tail.map(b => (
                    <Disc key={b.code} b={b} projection={loc.projection} factor={locFactor} />
                  ))}
                </g>
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

import React, { useEffect, useState } from 'react';
import { loadSeries } from '../lib/chartData';
import { DiasporaMap } from './charts/DiasporaMap';
import { DiasporaRankedChart } from './charts/DiasporaRankedChart';
import { DiasporaArrivalsChart } from './charts/DiasporaArrivalsChart';
import { DiasporaBasisChart } from './charts/DiasporaBasisChart';
import type { BasisRow } from './charts/DiasporaBasisChart';
import type { ArrivalsSeries } from './charts/DiasporaArrivalsChart';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { AboutData } from './charts/AboutData';
import { useLocale } from '../lib/locale';
import { getSection3Content } from '../content/diaspora';
import { countryName } from '../content/countryNames';

// The source names, year windows and destination filters that used to be
// interpolated into SQL here now live with that SQL in
// pipeline/analysis/chart_data.py: un_desa_bilateral_2020 for the born stock,
// eurostat_migr_pop1ctz for the citizen stock, and oecd_mig_flows_B11 over
// 2008-2023 for the arrivals. Only the constants this component still reasons
// with remain below.

/** The UN DESA snapshot the map and both ranked charts are built on. */
const SNAPSHOT_YEAR = 2020;
const BASELINE_YEAR = 1990;
const TOP_N = 12;

/**
 * The arrivals panel. 2008 is not a stylistic choice: before it the reporting
 * panel grows from 5 countries to 22, Czechia's register is contradicted by its
 * own stock, and Switzerland steps level. See the chart component's header for the
 * arithmetic. The three destinations are the largest by 2008-2023 volume and are
 * 72.5 percent of the panel. This order fixes their colour assignment, so it must
 * stay in step with the s3_arrival_flows query's own destination list.
 */
const FLOW_CODES = ['DEU', 'CZE', 'AUT'];

interface StockRow { code: string; year: number; value: number; data_type: string }

function Section3App() {
  const locale = useLocale();
  const c = getSection3Content(locale);

  const [mapData, setMapData] = useState<
    { code: string; value: number; citizenBasis: boolean; imputed: boolean }[]
  >([]);
  const [ranked, setRanked] = useState<
    { code: string; name: string; value: number; growth: number | null }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [arrivals, setArrivals] = useState<ArrivalsSeries[]>([]);
  const [basis, setBasis] = useState<BasisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Every UN DESA snapshot year, so the map's per-country detail panel can
        // draw a trend without a second round trip.
        // data_type is UN DESA's own "type of data of destination" column: a
        // leading C means the figure was compiled from foreign-citizenship data
        // rather than place of birth. The map rings those discs, because
        // bridge 1 turns on the fact that the largest one is among them.
        const rows = await loadSeries<StockRow>('s3_born_stock');

        const byCode = new Map<string, { year: number; value: number }[]>();
        const basisByCode = new Map<string, boolean>();
        const imputedByCode = new Map<string, boolean>();
        for (const r of rows) {
          const list = byCode.get(r.code) || [];
          list.push({ year: Number(r.year), value: Number(r.value) });
          byCode.set(r.code, list);
          // data_type is a space-separated set of UN DESA codes, so test for
          // membership rather than a prefix: Bosnia's value is "I R", and Jordan
          // and Mongolia are "C R". A startsWith('C') test reads the first token
          // only, which happens to work for C but would silently miss a row
          // where C or I is not first.
          const codes = String(r.data_type).trim().toUpperCase().split(/\s+/);
          if (codes.includes('C')) basisByCode.set(r.code, true);
          if (codes.includes('I')) imputedByCode.set(r.code, true);
        }

        const snapshot: typeof mapData = [];
        for (const [code, series] of byCode) {
          const current = series.find(s => s.year === SNAPSHOT_YEAR);
          if (!current) continue;
          snapshot.push({
            code,
            value: current.value,
            citizenBasis: basisByCode.get(code) === true,
            imputed: imputedByCode.get(code) === true,
          });
        }
        snapshot.sort((a, b) => b.value - a.value);
        setMapData(snapshot);
        setTotal(snapshot.reduce((sum, d) => sum + d.value, 0));

        setRanked(
          snapshot.slice(0, TOP_N).map(d => {
            const series = byCode.get(d.code) || [];
            const base = series.find(s => s.year === BASELINE_YEAR);
            return {
              code: d.code,
              name: countryName(d.code, locale),
              value: d.value,
              growth: base && base.value > 0
                ? ((d.value - base.value) / base.value) * 100
                : null,
            };
          })
        );
        // Born against citizen, 2020: two different QUANTITIES on the same snapshot,
        // inner-joined so only destinations reporting both appear. Never summed with
        // each other for the same reason the arrivals series is kept apart.
        const citizenRows = await loadSeries<{ code: string; value: number }>('s3_citizen_stock');

        const citizenByCode = new Map<string, number>();
        for (const r of citizenRows) citizenByCode.set(r.code, Number(r.value));

        setBasis(
          snapshot
            .filter(d => citizenByCode.has(d.code))
            .map(d => ({
              code: d.code,
              name: countryName(d.code, locale),
              born: d.value,
              citizen: citizenByCode.get(d.code)!,
            }))
            .sort((a, b) => b.born - a.born)
        );

        // Annual arrivals: a FLOW on the citizenship definition. Queried
        // separately and never joined to the stock rows, because adding or netting
        // the two would mix definitions.
        const flowRows = await loadSeries<{ code: string; year: number; value: number }>(
          's3_arrival_flows',
        );

        const flowByCode = new Map<string, { year: number; value: number }[]>();
        for (const r of flowRows) {
          const list = flowByCode.get(r.code) || [];
          list.push({ year: Number(r.year), value: Number(r.value) });
          flowByCode.set(r.code, list);
        }
        // Kept in FLOW_CODES order so the colour assignment is fixed rather than
        // dependent on what the query happened to return first.
        setArrivals(
          FLOW_CODES
            .map(code => ({
              code,
              name: countryName(code, locale),
              points: flowByCode.get(code) || [],
            }))
            .filter(s => s.points.length > 0)
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [locale]);

  if (loading) return null;
  if (error) return <p className="section3-error">Error: {error}</p>;

  return (
    <>
      {/* The notice must precede the map: the map carries English labels under an
          unreviewed locale, so a Slovak reader has to be told before reading it,
          not four screens later. */}
      {!c.reviewed && c.translationNotice && (
        <p className="section3-translation-notice section3-notice-top">
          {c.translationNotice}
        </p>
      )}

      <DiasporaMap
        data={mapData}
        total={total}
        labels={c.map}
        aboutLabel={c.aboutLabel}
        sourcePanel={c.sources.map}
      />

      <div className="section3-editorial">

        {/* No eyebrow here: the map's own figcaption carries it, and repeating
            it put the same label on screen twice. */}
        <header className="section3-header">
          <h1 className="section3-h1">{c.h1}</h1>
        </header>

        <div className="section3-prose">
          {c.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout1.value} label={c.callout1.label} />

        <h3 className="section3-h3">{c.sub1}</h3>

        <AnimateOnScroll>
          {animated => (
            <div className="section3-chart-wide">
              <DiasporaRankedChart data={ranked} mode="absolute" animated={animated} />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.caption1}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.ranked} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        {/* The growth view sits with the absolute one rather than under sub2. They
            are two modes of the same twelve destinations, which is why the component
            takes a mode prop, and the growth panel's own caveat says to read it
            against the absolute figures. Under sub2 it was answering a heading about
            counting the same people twice, which it does not do. */}
        <AnimateOnScroll>
          {animated => (
            <div className="section3-chart-wide">
              <DiasporaRankedChart data={ranked} mode="growth" animated={animated} />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.captionGrowth}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.growth} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section3-prose">
          {c.bridge1.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout2.value} label={c.callout2.label} />

        <h3 className="section3-h3">{c.sub2}</h3>

        <AnimateOnScroll>
          {animated => (
            <div className="section3-chart-wide">
              <DiasporaBasisChart rows={basis} labels={c.basis} animated={animated} />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.caption2}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.basis} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section3-prose">
          {c.bridge2.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section3-h3">{c.subFlows}</h3>

        <div className="section3-prose">
          <p>{c.bridgeFlows[0]}</p>
        </div>

        <AnimateOnScroll>
          {animated => (
            <div className="section3-chart-wide">
              <DiasporaArrivalsChart series={arrivals} labels={c.arrivals} animated={animated} />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.captionFlows}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.trend} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section3-prose">
          {c.bridgeFlows.slice(1).map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section3-h3">{c.sub3}</h3>

        <div className="section3-prose">
          {c.bridge3.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section3-h3">{c.sub4}</h3>

        <div className="section3-prose section3-closing">
          {c.closing.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {/* Deliberately understated: a data limitation, not a headline. */}
        <p className="section3-data-note">{c.dataNote}</p>

      </div>
    </>
  );
}

export default Section3App;

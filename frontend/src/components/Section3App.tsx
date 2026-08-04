import React, { useEffect, useState } from 'react';
import { query, registerParquet } from '../lib/db';
import { DiasporaMap } from './charts/DiasporaMap';
import { DiasporaRankedChart } from './charts/DiasporaRankedChart';
import { SectionEyebrow } from './charts/SectionEyebrow';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { AboutData } from './charts/AboutData';
import { useLocale } from '../lib/locale';
import { getSection3Content } from '../content/diaspora';
import { countryName } from '../content/countryNames';

/** The UN DESA snapshot the map and both ranked charts are built on. */
const SNAPSHOT_YEAR = 2020;
const BASELINE_YEAR = 1990;
const DESA_SOURCE = 'un_desa_bilateral_2020';
const TOP_N = 12;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await registerParquet('s3.parquet', '/data/section3_diaspora.parquet');

        // Every UN DESA snapshot year, so the map's per-country detail panel can
        // draw a trend without a second round trip.
        // data_type is UN DESA's own "type of data of destination" column: a
        // leading C means the figure was compiled from foreign-citizenship data
        // rather than place of birth. The map rings those discs, because
        // bridge 1 turns on the fact that the largest one is among them.
        const rows = await query(`
          SELECT destination_iso3 AS code, year, value,
                 COALESCE(data_type, '') AS data_type
          FROM 's3.parquet'
          WHERE metric = 'stock'
            AND source = '${DESA_SOURCE}'
            AND sex = 'all'
            AND slovak_def = 'born'
            AND age_bracket = 'all'
            AND education = 'all'
          ORDER BY destination_iso3, year
        `) as unknown as StockRow[];

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
          {() => (
            <div className="section3-chart-wide">
              <DiasporaRankedChart data={ranked} mode="absolute" />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.caption1}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.ranked} />
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
          {() => (
            <div className="section3-chart-wide">
              <DiasporaRankedChart data={ranked} mode="growth" />
              <div className="chart-caption-row">
                <p className="section3-caption">{c.caption2}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.growth} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section3-prose">
          {c.bridge2.map((p, i) => <p key={i}>{p}</p>)}
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

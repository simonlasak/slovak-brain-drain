import React, { useEffect, useState } from 'react';
import { query, registerParquet } from '../lib/db';
import { CorridorMap } from './charts/CorridorMap';
import { StockTrendChart } from './charts/StockTrendChart';
import { StudentBreakdownChart } from './charts/StudentBreakdownChart';
import { SectionEyebrow } from './charts/SectionEyebrow';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { StayLeaveChart } from './charts/StayLeaveChart';
import { AboutData } from './charts/AboutData';
import { useLocale } from '../lib/locale';
import { getSection2Content } from '../content/corridor';

interface StockRow {
  year: number;
  pathway: string;
  value: number;
  computed?: boolean;
}

interface StudentRow {
  year: number;
  level: string;
  value: number;
}

interface RegionRow {
  cz_geo_code: string;
  value: number;
  year: number;
}

function Section2App() {
  const locale = useLocale();
  const c = getSection2Content(locale);
  const [stockData, setStockData] = useState<StockRow[]>([]);
  const [studentData, setStudentData] = useState<StudentRow[]>([]);
  const [regionData, setRegionData] = useState<RegionRow[]>([]);
  const [regionYears, setRegionYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await registerParquet('s2.parquet', '/data/section2_corridor.parquet');

        const regionRows = await query(`
          SELECT cz_geo_code, value, year
          FROM 's2.parquet'
          WHERE pathway = 'all'
            AND cz_geo_code != 'CZ'
            AND sex = 'all'
            AND source = 'csu_CIZ003T003'
            AND metric = 'stock'
          ORDER BY year, cz_geo_code
        `) as RegionRow[];
        setRegionData(regionRows);

        const years = [...new Set(regionRows.map(r => r.year))].sort((a, b) => a - b);
        setRegionYears(years);

        const stockRows = await query(`
          SELECT year, pathway, value
          FROM 's2.parquet'
          WHERE sex = 'all'
            AND cz_geo_code = 'CZ'
            AND year BETWEEN 2015 AND 2024
            AND (
              (pathway = 'all' AND source = 'csu_CIZ003T003' AND metric = 'stock')
              OR (pathway = 'labour' AND employment_status = 'total' AND metric = 'stock')
              OR (pathway = 'student' AND field_or_sector = 'ED5-8' AND metric = 'students_enrolled')
            )
          ORDER BY year, pathway
        `) as StockRow[];

        const labour2024 = await query(`
          SELECT 2024 as year, 'labour' as pathway,
            SUM(value) as value
          FROM 's2.parquet'
          WHERE pathway = 'labour'
            AND year = 2024
            AND sex = 'all'
            AND employment_status IN ('employed', 'self_employed')
        `) as StockRow[];

        const hasLabour2024 = stockRows.some(r => r.pathway === 'labour' && r.year === 2024);
        const allStock = hasLabour2024
          ? stockRows
          : [...stockRows, ...labour2024.map(r => ({ ...r, computed: true }))];

        setStockData(allStock);

        const studentRows = await query(`
          SELECT year, field_or_sector as level, value
          FROM 's2.parquet'
          WHERE pathway = 'student'
            AND sex = 'all'
            AND field_or_sector IN ('ED6', 'ED7', 'ED8')
            AND year BETWEEN 2013 AND 2024
          ORDER BY year, level
        `) as StudentRow[];
        setStudentData(studentRows);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (error) return <p className="section2-error">Error: {error}</p>;

  return (
    <>
      <CorridorMap
        data={regionData}
        years={regionYears}
        labels={c.map}
        aboutLabel={c.aboutLabel}
        sourcePanel={c.sources.map}
      />

      <div className="section2-editorial">

        {!c.reviewed && c.translationNotice && (
          <p className="section2-translation-notice">{c.translationNotice}</p>
        )}

        <header className="section2-header">
          <SectionEyebrow>{c.eyebrow}</SectionEyebrow>
          <h1 className="section2-h1">{c.h1}</h1>
        </header>

        <div className="section2-prose">
          {c.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout1.value} label={c.callout1.label} />

        <h3 className="section2-h3">{c.sub1}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section2-chart-wide">
              <StockTrendChart data={stockData} animated={animated} seriesLabels={c.stockSeries} />
              <div className="chart-caption-row">
                <p className="section2-caption">{c.caption1}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.stock} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section2-prose">
          {c.bridge1.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout2.value} label={c.callout2.label} />

        <h3 className="section2-h3">{c.sub2}</h3>

        <div className="section2-prose">
          {c.bridge2.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section2-h3">{c.sub3}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section2-chart-wide">
              <StudentBreakdownChart data={studentData} animated={animated} levelLabels={c.studentLevels} />
              <div className="chart-caption-row">
                <p className="section2-caption">{c.caption3}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.student} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section2-prose">
          {c.bridge3.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section2-h3">{c.sub4}</h3>

        <StatCallout value={c.callout3.value} label={c.callout3.label} />

        <div className="section2-prose">
          {c.bridge4.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StayLeaveChart
          labels={c.stayLeave}
          aboutLabel={c.aboutLabel}
          sourcePanel={c.sources.stayLeave}
        />

        <h3 className="section2-h3">{c.sub5}</h3>

        <div className="section2-prose">
          {c.bridge5.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section2-h3">{c.sub6}</h3>

        <div className="section2-prose section2-closing">
          {c.closing.map((p, i) => <p key={i}>{p}</p>)}
        </div>

      </div>
    </>
  );
}

export default Section2App;

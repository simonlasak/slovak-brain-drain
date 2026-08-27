import React, { useEffect, useState } from 'react';
import { loadSeries } from '../lib/chartData';
import { CorridorMap } from './charts/CorridorMap';
import { StockTrendChart } from './charts/StockTrendChart';
import { StudentBreakdownChart } from './charts/StudentBreakdownChart';
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
        const regionRows = await loadSeries<RegionRow>('s2_regions');
        setRegionData(regionRows);

        const years = [...new Set(regionRows.map(r => r.year))].sort((a, b) => a - b);
        setRegionYears(years);

        const stockRows = await loadSeries<StockRow>('s2_stock_series');

        // s2_labour_2024 is the only SUM on this section, so it is the only query
        // where an unconstrained dimension could double-count. Its SQL pins
        // age_bracket and education to 'all' explicitly: today every labour row
        // carries 'all' for both, so the sum is correct either way, but it would
        // silently double-count the moment CSU published an age or education
        // breakdown. See check_subtotal_double_counting in
        // pipeline/validate/invariants.py, which reports employment_status alone
        // as a 4.95x trap on this file.
        const labour2024 = await loadSeries<StockRow>('s2_labour_2024');

        const hasLabour2024 = stockRows.some(r => r.pathway === 'labour' && r.year === 2024);
        const allStock = hasLabour2024
          ? stockRows
          : [...stockRows, ...labour2024.map(r => ({ ...r, computed: true }))];

        setStockData(allStock);

        const studentRows = await loadSeries<StudentRow>('s2_students_by_level');
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

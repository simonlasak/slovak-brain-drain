import React, { useEffect, useState } from 'react';
import { query, registerParquet } from '../lib/db';
import { CorridorMap } from './charts/CorridorMap';
import { StockTrendChart } from './charts/StockTrendChart';
import { StudentBreakdownChart } from './charts/StudentBreakdownChart';
import { SectionEyebrow } from './charts/SectionEyebrow';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { StayLeaveChart } from './charts/StayLeaveChart';

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
      <CorridorMap data={regionData} years={regionYears} />

      <div className="section2-editorial">

        <header className="section2-header">
          <SectionEyebrow>&#167;2 &#183; Czech Corridor</SectionEyebrow>
          <h1 className="section2-h1">The Czech Corridor</h1>
        </header>

        <div className="section2-prose">
          <p>Two Czech statistical registers count Slovaks in Czechia, and they arrive at different totals. The foreigners' residence register (CSU CIZ002/CIZ003) recorded 125,280 Slovak citizens with a registered address in Czechia as of early 2025. The labour registry (CSU CIZ03) recorded 240,297 Slovaks as economically active in Czechia in 2023. The gap reflects the nature of the corridor itself: under EU free movement, a Slovak citizen can work in Czechia on a Czech employment contract while maintaining official residence in Slovakia. Tens of thousands do, particularly along the Moravian border. Neither number is wrong. The residence figure counts people who live in Czechia. The labour figure counts people who work there. Together they describe a corridor where the boundary between "living abroad" and "commuting to a better-paying job" has dissolved for a significant share of the Slovak workforce.</p>
          <p>This corridor did not emerge in a surge. Both figures accumulated over two decades of stable departures, roughly 6,000 to 7,000 new arrivals per year since EU accession in 2004. The two countries share a language boundary so low it barely registers, mutual recognition of qualifications, and seventy-four years of shared institutional history. What the data describes is the internal extension of the Slovak labour market into a higher-wage jurisdiction, not emigration in the classical sense.</p>
          <p>The question this section answers is not "why do Slovaks leave?" but "what happened to the ones who left for Czechia twenty years ago?" The answer, visible in both the employment stock and the age structure, is that they stayed.</p>
        </div>

        <StatCallout value="240,297" label="Slovaks economically active in Czechia, 2023" />

        <h3 className="section2-h3">Accumulated, not surged</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section2-chart-wide">
              <StockTrendChart data={stockData} animated={animated} />
              <p className="section2-caption">
                src: CSU CIZ003T003 (residence), CIZ03 (labour), Eurostat educ_uoe_mobs02 (students)
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section2-prose">
          <p>The labour stock reached 240,297 in 2023: 216,239 on standard employment contracts and 24,058 operating as self-employed holders of a Czech trade licence. Growth from 164,710 in 2015 to 240,297 in 2023 represents a 46 percent increase over eight years, driven almost entirely by the retention of existing residents rather than acceleration of new arrivals. OECD annual inflow data confirms that the rate of new Slovak arrivals to Czechia has remained stable at approximately 6,000 to 7,000 per year throughout this period. The residence-registered population grew more slowly, from 101,589 in 2015 to 125,280 in 2025 (23 percent), suggesting that a portion of the labour growth came from Slovaks formalising work arrangements without changing their registered address.</p>
        </div>

        <StatCallout value="+76%" label="Growth in Jihomoravsk&#253; kraj, 2015-2025" />

        <h3 className="section2-h3">Where the growth went</h3>

        <div className="section2-prose">
          <p>The geographic distribution has not been static. Praha held the largest absolute concentration in 2025 with 33,459 registered Slovaks, but Jihomoravsk&#253; kraj, centred on Brno, grew fastest: from 10,677 in 2015 to 18,771 in 2025, a 76 percent increase against Praha's 21 percent over the same decade. The St&#345;edo&#269;esk&#253; commuter belt (21,457) and Moravskoslezsk&#253; (9,473), bordering northeastern Slovakia, each grew at 17 percent. At the other end, Libereck&#253; kraj added fewer than 150 Slovaks across the entire period, a 2.6 percent change consistent with its orientation toward the German border rather than the Slovak one. Slovak settlement is following economic diversification within Czechia, not further concentration in the capital.</p>
        </div>

        <h3 className="section2-h3">The student pipeline</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section2-chart-wide">
              <StudentBreakdownChart data={studentData} animated={animated} />
              <p className="section2-caption">
                src: Eurostat educ_uoe_mobs02. ED6 = bachelor, ED7 = master, ED8 = doctoral.
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section2-prose">
          <p>The student pathway tells a counterintuitive story of resilience. In 2013, Eurostat recorded 24,300 Slovak students enrolled at Czech universities. By 2024, that figure stood at 22,401. An 8 percent stock decline over eleven years sounds modest, but set against demographic context it becomes remarkable: Slovakia's 15-to-19-year-old population shrank by 37 percent between 2004 and 2019 as the post-independence birthrate collapse worked through the education system. The share of available young Slovaks choosing Czech universities has not fallen; it has risen. The pipeline contracted in absolute terms only because its source population shrank dramatically beneath it.</p>
          <p>Within the student stock, bachelor enrolment fell from 13,396 to 11,645 while master programmes held near 9,000 and doctoral numbers remained stable around 1,800. The DZS 2023 survey of international students at Czech universities reports that Slovaks most often study information and communication technologies (15 percent of Slovak respondents), natural sciences (14 percent), and social sciences, journalism and information (13 percent). These are survey proportions from the 2023 DZS report, not administrative enrolment counts, and reflect the broad field distribution rather than precise headcounts.</p>
        </div>

        <h3 className="section2-h3">More than half stay</h3>

        <StatCallout value="54%" label="Slovak students planning to remain in Czechia after graduating, DZS 2023 survey" />

        <div className="section2-prose">
          <p>This is the closest available approximation of a stay rate. More than half of each graduating cohort feeds directly into the labour corridor rather than returning to Slovakia, transforming a student flow into a permanent population increment.</p>
        </div>

        <StayLeaveChart />

        <h3 className="section2-h3">Aging in place</h3>

        <div className="section2-prose">
          <p>The mean age of EU27 citizens in Czechia rose from 39.9 in 2015 to 40.9 in 2024, advancing at almost exactly one year per calendar year. This is the signature of a population aging in place rather than being refreshed by new arrivals: the same cohort that crossed the border in their twenties is now in their forties, with Czech careers and Czech mortgages.</p>
          <p>One anomaly warrants annotation. In 2021, the registered Slovak population in Czechia fell by 8 percent (from 124,544 to 114,630) before recovering to 117,265 the following year. This coincides with the first full year of COVID-19 restrictions and likely reflects temporary return migration. The recovery in 2022-2025 confirms this reading. The dip is marked on every time-series chart in this section; it should be read as a one-year disruption, not a trend reversal.</p>
        </div>

        <h3 className="section2-h3">A story about gravity</h3>

        <div className="section2-prose section2-closing">
          <p>The Czech corridor is, in the end, a story about gravity. Two countries close enough in language, culture, and institutional memory that the border between them functions less like a national boundary than a commute. The 125,000 Slovaks who have registered their residence in Czechia and the 240,000 who work there represent two measures of the same long-term settlement process. What began as a student flow in the mid-2000s has become a permanent demographic feature of both countries. Slovakia's population is smaller and older because of it. Czechia's labour market is larger and more Slovak because of it. Neither country's official statistics fully capture the scale, which is itself the most honest summary of how the corridor works: quietly, steadily, and mostly unremarked.</p>
        </div>

      </div>
    </>
  );
}

export default Section2App;

import React, { useEffect, useState, useMemo } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { query, registerParquet } from '../lib/db';
import { scaleLinear } from '@visx/scale';
import { LinePath, Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';

const IDN3_TO_SK: Record<number, string> = {
  101:"SK0101",102:"SK0102",103:"SK0103",104:"SK0104",105:"SK0105",106:"SK0106",107:"SK0107",108:"SK0108",
  201:"SK0211",202:"SK0212",203:"SK0213",204:"SK0214",205:"SK0215",206:"SK0216",207:"SK0217",
  301:"SK0221",302:"SK0222",303:"SK0223",304:"SK0224",305:"SK0225",306:"SK0226",307:"SK0227",308:"SK0228",309:"SK0229",
  401:"SK0231",402:"SK0232",403:"SK0233",404:"SK0234",405:"SK0235",406:"SK0236",407:"SK0237",
  501:"SK0311",502:"SK0312",503:"SK0313",504:"SK0314",505:"SK0315",506:"SK0316",507:"SK0317",508:"SK0318",509:"SK0319",510:"SK031A",511:"SK031B",
  601:"SK0321",602:"SK0322",603:"SK0323",604:"SK0324",605:"SK0325",606:"SK0326",607:"SK0327",608:"SK0328",609:"SK0329",610:"SK032A",611:"SK032B",612:"SK032C",613:"SK032D",
  701:"SK0411",702:"SK0412",703:"SK0413",704:"SK0414",705:"SK0415",706:"SK0416",707:"SK0417",708:"SK0418",709:"SK0419",710:"SK041A",711:"SK041B",712:"SK041C",713:"SK041D",
  801:"SK0421",802:"SK0422",803:"SK0423",804:"SK0424",805:"SK0425",806:"SK0426",807:"SK0427",808:"SK0428",809:"SK0429",810:"SK042A",811:"SK042B",
};

const SK_TO_IDN3 = Object.fromEntries(Object.entries(IDN3_TO_SK).map(([k, v]) => [v, Number(k)]));

function colorByPctChange(pct: number): [number, number, number, number] {
  const clamped = Math.max(-25, Math.min(25, pct));
  if (clamped > 0) {
    const t = clamped / 25;
    return [Math.round(245 - t * 205), Math.round(245 + t * 10), Math.round(240 - t * 165), 220];
  } else {
    const t = Math.abs(clamped) / 25;
    return [Math.round(245 + t * 10), Math.round(245 - t * 185), Math.round(240 - t * 175), 220];
  }
}

function colorByValue(value: number, min: number, max: number): [number, number, number, number] {
  if (max === min) return [220, 220, 220, 200];
  const t = (value - min) / (max - min);
  return [Math.round(252 - t * 115), Math.round(245 - t * 178), Math.round(235 - t * 195), 215];
}

const VIEW = { latitude: 48.73, longitude: 19.7, zoom: 7.1, pitch: 0, bearing: 0 };

interface TrendRow { year: number; value: number; }

function NationalTrendChart() {
  const [data, setData] = useState<TrendRow[]>([]);
  useEffect(() => {
    async function load() {
      const rows = await query(`
        SELECT year, SUM(value) as value FROM 's1.parquet'
        WHERE metric='population' AND geo_level='kraj' AND geo_code LIKE 'SK0_'
          AND age_bracket='all' AND education='all'
        GROUP BY year ORDER BY year
      `) as TrendRow[];
      setData(rows);
    }
    load();
  }, []);

  if (data.length === 0) return null;
  const w = 400, h = 160, m = { top: 10, right: 10, bottom: 25, left: 55 };
  const iW = w - m.left - m.right, iH = h - m.top - m.bottom;
  const xScale = scaleLinear({ domain: [2004, 2025], range: [0, iW] });
  const yScale = scaleLinear({ domain: [Math.min(...data.map(d => d.value)) * 0.99, Math.max(...data.map(d => d.value)) * 1.01], range: [iH, 0] });

  return (
    <svg width={w} height={h} style={{ width: '100%', height: 'auto' }}>
      <Group left={m.left} top={m.top}>
        <LinePath data={data} x={d => xScale(d.year)} y={d => yScale(d.value)} stroke="#1a1a1a" strokeWidth={2} />
        <AxisBottom scale={xScale} top={iH} numTicks={5} tickFormat={v => String(v)} tickLabelProps={{ fontSize: 10 }} />
        <AxisLeft scale={yScale} numTicks={4} tickFormat={v => `${(Number(v)/1000000).toFixed(2)}M`} tickLabelProps={{ fontSize: 10 }} />
      </Group>
    </svg>
  );
}

function RegionCompareChart() {
  const [data, setData] = useState<{year: number; geo_code: string; geo_name: string; value: number}[]>([]);
  useEffect(() => {
    async function load() {
      const rows = await query(`
        SELECT year, geo_code, geo_name, value FROM 's1.parquet'
        WHERE metric='population' AND geo_level='kraj' AND geo_code IN ('SK01','SK02','SK03','SK04')
          AND age_bracket='all' AND education='all'
        ORDER BY year
      `) as any[];
      setData(rows);
    }
    load();
  }, []);

  if (data.length === 0) return null;
  const regions = [...new Set(data.map(r => r.geo_code))];
  const colors: Record<string, string> = { SK01: '#c44d2b', SK02: '#264653', SK03: '#2d6a4f', SK04: '#e9c46a' };
  const names: Record<string, string> = { SK01: 'Bratislava', SK02: 'West', SK03: 'Central', SK04: 'East' };

  const w = 400, h = 180, m = { top: 10, right: 80, bottom: 25, left: 55 };
  const iW = w - m.left - m.right, iH = h - m.top - m.bottom;
  const xScale = scaleLinear({ domain: [2004, 2025], range: [0, iW] });
  const allVals = data.map(d => d.value);
  const yScale = scaleLinear({ domain: [Math.min(...allVals) * 0.95, Math.max(...allVals) * 1.02], range: [iH, 0] });

  return (
    <svg width={w} height={h} style={{ width: '100%', height: 'auto' }}>
      <Group left={m.left} top={m.top}>
        {regions.map(r => {
          const rData = data.filter(d => d.geo_code === r).sort((a, b) => a.year - b.year);
          const last = rData[rData.length - 1];
          return (
            <g key={r}>
              <LinePath data={rData} x={d => xScale(d.year)} y={d => yScale(d.value)} stroke={colors[r] || '#888'} strokeWidth={2} />
              {last && <text x={iW + 6} y={yScale(last.value)} fill={colors[r] || '#888'} fontSize={10} dominantBaseline="middle">{names[r] || r}</text>}
            </g>
          );
        })}
        <AxisBottom scale={xScale} top={iH} numTicks={5} tickFormat={v => String(v)} tickLabelProps={{ fontSize: 10 }} />
        <AxisLeft scale={yScale} numTicks={4} tickFormat={v => `${(Number(v)/1000000).toFixed(1)}M`} tickLabelProps={{ fontSize: 10 }} />
      </Group>
    </svg>
  );
}

export default function MapVariantB() {
  const [geojson, setGeojson] = useState<any>(null);
  const [data2004, setData2004] = useState<Record<string, number>>({});
  const [data2024, setData2024] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'2004' | '2024' | 'change'>('change');

  useEffect(() => {
    fetch('/data/sk_okresy.geojson').then(r => r.json()).then(data => {
      setGeojson(data);
      const nameMap: Record<string, string> = {};
      for (const f of data.features) {
        const skCode = IDN3_TO_SK[f.properties?.IDN3];
        if (skCode) nameMap[skCode] = f.properties.NM3;
      }
      setNames(nameMap);
    });
  }, []);

  useEffect(() => {
    async function load() {
      await registerParquet('s1.parquet', '/data/section1_internal.parquet');
      const [r04, r24] = await Promise.all([
        query(`SELECT geo_code, value FROM 's1.parquet' WHERE metric='population' AND year=2004 AND geo_level='okres' AND age_bracket='all' AND education='all'`),
        query(`SELECT geo_code, value FROM 's1.parquet' WHERE metric='population' AND year=2024 AND geo_level='okres' AND age_bracket='all' AND education='all'`),
      ]) as [{ geo_code: string; value: number }[], { geo_code: string; value: number }[]];
      const m04: Record<string, number> = {};
      const m24: Record<string, number> = {};
      for (const r of r04) m04[r.geo_code] = r.value;
      for (const r of r24) m24[r.geo_code] = r.value;
      setData2004(m04);
      setData2024(m24);
    }
    load();
  }, []);

  const changeData = useMemo(() => {
    const result: Record<string, number> = {};
    for (const code of Object.keys(data2024)) {
      const old = data2004[code] || 0;
      const now = data2024[code] || 0;
      result[code] = old > 0 ? ((now - old) / old) * 100 : 0;
    }
    return result;
  }, [data2004, data2024]);

  const activeData = mode === '2004' ? data2004 : mode === '2024' ? data2024 : changeData;
  const values = Object.values(activeData);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [new GeoJsonLayer({
      id: 'choropleth',
      data: geojson,
      filled: true,
      stroked: true,
      getFillColor: (f: any) => {
        const skCode = IDN3_TO_SK[f.properties?.IDN3];
        if (!skCode) return [235, 235, 232, 150] as any;
        const value = activeData[skCode];
        if (value === undefined) return [235, 235, 232, 150] as any;
        if (mode === 'change') return colorByPctChange(value) as any;
        return colorByValue(value, minVal, maxVal) as any;
      },
      getLineColor: [100, 100, 95, 35],
      getLineWidth: 0.4,
      lineWidthMinPixels: 0.2,
      pickable: true,
      updateTriggers: { getFillColor: [activeData, mode, minVal, maxVal] },
    })];
  }, [geojson, activeData, mode, minVal, maxVal]);

  const topGrowers = useMemo(() =>
    Object.entries(changeData).sort(([,a], [,b]) => b - a).slice(0, 5), [changeData]);
  const topShrinkers = useMemo(() =>
    Object.entries(changeData).sort(([,a], [,b]) => a - b).slice(0, 5), [changeData]);

  const totalPop2024 = useMemo(() => Object.values(data2024).reduce((s, v) => s + v, 0), [data2024]);
  const totalPop2004 = useMemo(() => Object.values(data2004).reduce((s, v) => s + v, 0), [data2004]);
  const netChange = totalPop2024 - totalPop2004;

  return (
    <div>
      {/* Hero stat */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <p style={{ fontSize: '3rem', fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
          {netChange > 0 ? '+' : ''}{Math.round(netChange).toLocaleString()}
        </p>
        <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.25rem 0 0 0' }}>
          net population change, 2004-2024
        </p>
      </div>

      {/* Map mode toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        {(['2004', '2024', 'change'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none',
            background: mode === m ? '#1a1a1a' : '#f0f0f0',
            color: mode === m ? 'white' : '#333',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
            transition: 'all 0.15s',
          }}>
            {m === 'change' ? '% Change' : m}
          </button>
        ))}
      </div>

      {/* Map */}
      <div style={{ width: '100%', height: '480px', position: 'relative' }}>
        <DeckGL
          initialViewState={VIEW}
          controller={false}
          layers={layers}
          getTooltip={({ object }: any) => {
            if (!object) return null;
            const skCode = IDN3_TO_SK[object.properties?.IDN3];
            const name = object.properties?.NM3 || '';
            if (!skCode) return null;
            if (mode === 'change') {
              const pct = changeData[skCode];
              return { text: `${name}\n${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% since 2004` };
            }
            const value = activeData[skCode];
            return value !== undefined ? { text: `${name}: ${Math.round(value).toLocaleString()}` } : null;
          }}
          style={{ background: '#fafaf8' }}
        />
      </div>

      {/* Growers / shrinkers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '2.5rem', maxWidth: '680px', margin: '2.5rem auto 0' }}>
        <div>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2d6a4f', marginBottom: '0.75rem', fontWeight: 600 }}>
            Fastest growing
          </h3>
          {topGrowers.map(([code, pct]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' }}>
              <span>{names[code] || code}</span>
              <span style={{ color: '#2d6a4f', fontWeight: 600 }}>+{pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#c44d2b', marginBottom: '0.75rem', fontWeight: 600 }}>
            Fastest shrinking
          </h3>
          {topShrinkers.map(([code, pct]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' }}>
              <span>{names[code] || code}</span>
              <span style={{ color: '#c44d2b', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editorial bridge */}
      <div style={{ maxWidth: '640px', margin: '3rem auto', lineHeight: 1.7, fontSize: '1rem' }}>
        <p>
          The pattern is not simply east-versus-west. The five fastest-shrinking districts share a profile: poor rail connections to Bratislava, dependence on a single declining industry, and average wages below 900 EUR monthly. Medzilaborce, the worst-hit, has lost nearly one in seven residents in two decades.
        </p>
        <p style={{ marginTop: '1rem' }}>
          Meanwhile, Senec and Pezinok (both within commuting distance of Bratislava) grew by absorbing the capital's suburban overflow. This is not a story of one city winning. It is a story of concentration: opportunity, infrastructure, and young people all flowing toward a single urban core.
        </p>
      </div>

      {/* National trend */}
      <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#555', marginBottom: '0.5rem' }}>
          Total population, 2004-2025
        </h3>
        <NationalTrendChart />
        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
          Slovakia's total population peaked in 2020 and has since declined.
        </p>
      </div>

      {/* Region comparison */}
      <div style={{ maxWidth: '640px', margin: '3rem auto', lineHeight: 1.7, fontSize: '1rem' }}>
        <p>
          The regional divergence becomes clearer when the four NUTS-2 regions are plotted individually. Bratislava has added 135,000 residents since 2004. The other three regions have stagnated or declined, with Central Slovakia losing the most in absolute terms.
        </p>
      </div>

      <div style={{ maxWidth: '500px', margin: '2rem auto' }}>
        <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#555', marginBottom: '0.5rem' }}>
          Population by region
        </h3>
        <RegionCompareChart />
      </div>

      {/* Second editorial bridge */}
      <div style={{ maxWidth: '640px', margin: '3rem auto', lineHeight: 1.7, fontSize: '1rem' }}>
        <p>
          What the population numbers do not capture is the composition of who leaves. Census data from 2011 and 2021 shows that districts losing population are disproportionately losing university-educated residents aged 25-34. The drain is not uniform across skill levels. It is precisely the people these districts need most who are most likely to go.
        </p>
        <p style={{ marginTop: '1rem' }}>
          The next section follows the largest single channel of that outflow: the 240,000 Slovaks who chose Czechia.
        </p>
      </div>

      {/* Source */}
      <div style={{ maxWidth: '640px', margin: '3rem auto', padding: '1rem', background: '#f8f9fa', borderRadius: '6px', fontSize: '0.8rem', color: '#888' }}>
        <p style={{ margin: 0 }}>
          Data: SU SR DataCube (om7011rr, om7102rr), 2004-2025. Census 2011 and 2021 for education breakdowns. Figures are permanently resident population as of 1 January each year.
        </p>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { query, registerParquet } from '../lib/db';
import { scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';

interface MapData {
  [geoCode: string]: number;
}

interface TrendRow {
  year: number;
  metric: string;
  value: number;
}

const INITIAL_VIEW = {
  latitude: 48.7,
  longitude: 19.7,
  zoom: 6.8,
  pitch: 0,
  bearing: 0,
};

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

const METRICS = [
  { value: 'population', label: 'Population' },
  { value: 'total_change', label: 'Total change' },
  { value: 'intl_net', label: 'Net international migration' },
  { value: 'intl_out', label: 'Emigration (international out)' },
  { value: 'intl_in', label: 'Immigration (international in)' },
  { value: 'births', label: 'Births' },
  { value: 'deaths', label: 'Deaths' },
];

const COLOR_SCALE_POS = [
  [254, 235, 226],
  [251, 180, 174],
  [247, 104, 100],
  [197, 57, 43],
  [139, 30, 20],
] as const;

const COLOR_SCALE_DIV = {
  negative: [[178, 24, 43], [214, 96, 77], [244, 165, 130], [253, 219, 199]],
  zero: [245, 245, 245],
  positive: [[209, 229, 216], [146, 197, 139], [67, 147, 78], [27, 120, 55]],
} as const;

function interpolateColor(value: number, min: number, max: number, isDivergent: boolean): [number, number, number, number] {
  if (max === min) return [220, 220, 220, 200];

  if (isDivergent) {
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    if (value === 0) return [...COLOR_SCALE_DIV.zero, 200] as any;
    if (value > 0) {
      const t = Math.min(1, value / absMax);
      const scale = COLOR_SCALE_DIV.positive;
      const idx = t * (scale.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.min(scale.length - 1, Math.ceil(idx));
      const frac = idx - lower;
      return [
        Math.round(scale[lower][0] + (scale[upper][0] - scale[lower][0]) * frac),
        Math.round(scale[lower][1] + (scale[upper][1] - scale[lower][1]) * frac),
        Math.round(scale[lower][2] + (scale[upper][2] - scale[lower][2]) * frac),
        200,
      ];
    } else {
      const t = Math.min(1, Math.abs(value) / absMax);
      const scale = COLOR_SCALE_DIV.negative;
      const idx = t * (scale.length - 1);
      const lower = Math.floor(idx);
      const upper = Math.min(scale.length - 1, Math.ceil(idx));
      const frac = idx - lower;
      return [
        Math.round(scale[lower][0] + (scale[upper][0] - scale[lower][0]) * frac),
        Math.round(scale[lower][1] + (scale[upper][1] - scale[lower][1]) * frac),
        Math.round(scale[lower][2] + (scale[upper][2] - scale[lower][2]) * frac),
        200,
      ];
    }
  }

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const idx = t * (COLOR_SCALE_POS.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const frac = idx - lower;
  const c0 = COLOR_SCALE_POS[lower];
  const c1 = COLOR_SCALE_POS[upper];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * frac),
    Math.round(c0[1] + (c1[1] - c0[1]) * frac),
    Math.round(c0[2] + (c1[2] - c0[2]) * frac),
    200,
  ];
}

function TrendPanel({ geoCode, geoName, onClose }: { geoCode: string; geoName: string; onClose: () => void }) {
  const [trends, setTrends] = useState<TrendRow[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await query(`
        SELECT year, metric, value
        FROM 's1.parquet'
        WHERE geo_code = '${geoCode}'
          AND age_bracket = 'all'
          AND education = 'all'
          AND metric IN ('population', 'intl_net', 'total_change', 'births', 'deaths')
        ORDER BY year
      `) as TrendRow[];
      setTrends(rows);
    }
    load();
  }, [geoCode]);

  if (trends.length === 0) return <div style={panelStyle}><p>Loading...</p></div>;

  const popData = trends.filter(r => r.metric === 'population').sort((a, b) => a.year - b.year);
  const migData = trends.filter(r => r.metric === 'intl_net').sort((a, b) => a.year - b.year);

  const width = 320;
  const height = 140;
  const margin = { top: 10, right: 10, bottom: 25, left: 50 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{geoName}</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#666' }}>x</button>
      </div>

      {popData.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: '0 0 4px 0', color: '#555' }}>Population trend</p>
          <MiniChart data={popData} width={width} height={height} margin={margin} color="#c44d2b" />
        </div>
      )}

      {migData.length > 0 && (
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: '0 0 4px 0', color: '#555' }}>Net international migration</p>
          <MiniChart data={migData} width={width} height={height} margin={margin} color="#2d6a4f" showZero />
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, width, height, margin, color, showZero = false }: {
  data: TrendRow[]; width: number; height: number; margin: any; color: string; showZero?: boolean;
}) {
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const years = data.map(d => d.year);
  const values = data.map(d => d.value);
  const yMin = showZero ? Math.min(0, ...values) : Math.min(...values);
  const yMax = Math.max(...values);

  const xScale = scaleLinear({ domain: [Math.min(...years), Math.max(...years)], range: [0, innerW] });
  const yScale = scaleLinear({ domain: [yMin, yMax * 1.05], range: [innerH, 0] });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {showZero && <line x1={0} x2={innerW} y1={yScale(0)} y2={yScale(0)} stroke="#ccc" strokeDasharray="3,3" />}
        <LinePath
          data={data}
          x={d => xScale(d.year)}
          y={d => yScale(d.value)}
          stroke={color}
          strokeWidth={2}
        />
        <AxisBottom scale={xScale} top={innerH} numTicks={4} tickFormat={v => String(v)} tickLabelProps={{ fontSize: 9 }} />
        <AxisLeft scale={yScale} numTicks={4} tickFormat={v => {
          const n = Number(v);
          if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`;
          return String(n);
        }} tickLabelProps={{ fontSize: 9 }} />
      </Group>
    </svg>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  width: '350px',
  maxHeight: '450px',
  overflowY: 'auto',
  background: 'white',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  padding: '1rem',
  zIndex: 10,
};

export default function SlovakiaMap({ metric = 'population', year = 2023 }: { metric?: string; year?: number }) {
  const [geojson, setGeojson] = useState<any>(null);
  const [mapData, setMapData] = useState<MapData>({});
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMetric, setSelectedMetric] = useState(metric);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/data/sk_okresy.geojson')
      .then(r => r.json())
      .then(setGeojson);
  }, []);

  useEffect(() => {
    async function loadData() {
      await registerParquet('s1.parquet', '/data/section1_internal.parquet');
      const rows = await query(`
        SELECT geo_code, value
        FROM 's1.parquet'
        WHERE metric = '${selectedMetric}'
          AND year = ${selectedYear}
          AND geo_level = 'okres'
          AND age_bracket = 'all'
          AND education = 'all'
      `) as { geo_code: string; value: number }[];

      const dataMap: MapData = {};
      for (const r of rows) {
        dataMap[r.geo_code] = r.value;
      }
      setMapData(dataMap);
    }
    loadData();
  }, [selectedYear, selectedMetric]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setSelectedYear(y => {
          if (y >= 2025) {
            setPlaying(false);
            return 2025;
          }
          return y + 1;
        });
      }, 600);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const isDivergent = ['total_change', 'intl_net', 'intl_out', 'intl_in'].includes(selectedMetric);

  const { minVal, maxVal } = useMemo(() => {
    const values = Object.values(mapData);
    if (values.length === 0) return { minVal: 0, maxVal: 1 };
    return { minVal: Math.min(...values), maxVal: Math.max(...values) };
  }, [mapData]);

  const layers = useMemo(() => {
    if (!geojson) return [];
    return [
      new GeoJsonLayer({
        id: 'slovakia-choropleth',
        data: geojson,
        filled: true,
        stroked: true,
        getFillColor: (f: any) => {
          const idn3 = f.properties?.IDN3;
          if (!idn3) return [230, 230, 230, 150] as any;
          const skCode = IDN3_TO_SK[idn3];
          if (!skCode) return [230, 230, 230, 150] as any;
          const value = mapData[skCode];
          if (value === undefined) return [230, 230, 230, 150] as any;
          return interpolateColor(value, minVal, maxVal, isDivergent) as any;
        },
        getLineColor: (f: any) => {
          const idn3 = f.properties?.IDN3;
          const skCode = IDN3_TO_SK[idn3];
          if (selected && skCode === selected.code) return [0, 0, 0, 255] as any;
          return [80, 80, 80, 80] as any;
        },
        getLineWidth: (f: any) => {
          const idn3 = f.properties?.IDN3;
          const skCode = IDN3_TO_SK[idn3];
          if (selected && skCode === selected.code) return 3;
          return 1;
        },
        lineWidthMinPixels: 0.5,
        pickable: true,
        onClick: ({ object }: any) => {
          if (!object) return;
          const idn3 = object.properties?.IDN3;
          const name = object.properties?.NM3 || '';
          if (!idn3) return;
          const skCode = IDN3_TO_SK[idn3];
          if (!skCode) return;
          setSelected(prev => prev?.code === skCode ? null : { code: skCode, name });
        },
        updateTriggers: {
          getFillColor: [mapData, minVal, maxVal, isDivergent],
          getLineColor: [selected],
          getLineWidth: [selected],
        },
      }),
    ];
  }, [geojson, mapData, minVal, maxVal, isDivergent, selected]);

  const handlePlayPause = useCallback(() => {
    if (!playing && selectedYear >= 2025) setSelectedYear(2004);
    setPlaying(p => !p);
  }, [playing, selectedYear]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #e5e5e5' }}>
        <button
          onClick={handlePlayPause}
          style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #ccc', background: playing ? '#c44d2b' : 'white', color: playing ? 'white' : '#333', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <input
            type="range"
            min={2004}
            max={2025}
            value={selectedYear}
            onChange={e => { setSelectedYear(Number(e.target.value)); setPlaying(false); }}
            style={{ flex: 1, minWidth: '120px' }}
          />
          <span style={{ fontWeight: 600, minWidth: '2.5rem' }}>{selectedYear}</span>
        </label>
        <select
          value={selectedMetric}
          onChange={e => setSelectedMetric(e.target.value)}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
        >
          {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '540px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e5e5' }}>
        <DeckGL
          initialViewState={INITIAL_VIEW}
          controller={true}
          layers={layers}
          getTooltip={({ object }: any) => {
            if (!object) return null;
            const idn3 = object.properties?.IDN3;
            const name = object.properties?.NM3 || '';
            if (!idn3) return null;
            const skCode = IDN3_TO_SK[idn3];
            if (!skCode) return null;
            const value = mapData[skCode];
            if (value === undefined) return { text: `${name}\nNo data` };
            return { text: `${name}\n${METRICS.find(m => m.value === selectedMetric)?.label || selectedMetric}: ${Math.round(value).toLocaleString()}` };
          }}
          style={{ background: '#f8f9fa' }}
        />
        {selected && (
          <TrendPanel
            geoCode={selected.code}
            geoName={selected.name}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

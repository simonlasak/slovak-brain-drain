import React, { useEffect, useState } from 'react';
import { query, registerParquet } from '../lib/db';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';

interface DiasporaRow {
  destination: string;
  value: number;
}

const COUNTRY_NAMES: Record<string, string> = {
  CZE: 'Czechia', '203': 'Czechia',
  GBR: 'United Kingdom', '826': 'United Kingdom',
  DEU: 'Germany', '276': 'Germany',
  AUT: 'Austria', '40': 'Austria',
  CHE: 'Switzerland', '756': 'Switzerland',
  USA: 'United States', '840': 'United States',
  HUN: 'Hungary', '348': 'Hungary',
  IRL: 'Ireland', '372': 'Ireland',
  ITA: 'Italy', '380': 'Italy',
  NLD: 'Netherlands', '528': 'Netherlands',
  CAN: 'Canada', '124': 'Canada',
  AUS: 'Australia', '36': 'Australia',
  DNK: 'Denmark', '208': 'Denmark',
  SWE: 'Sweden', '752': 'Sweden',
  NOR: 'Norway', '578': 'Norway',
  FRA: 'France', '250': 'France',
  ESP: 'Spain', '724': 'Spain',
  BEL: 'Belgium', '56': 'Belgium',
  POL: 'Poland', '616': 'Poland',
};

function BarChart({ data, width, height }: { data: DiasporaRow[]; width: number; height: number }) {
  const margin = { top: 10, right: 20, bottom: 60, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = scaleBand({ domain: data.map(d => d.destination), range: [0, innerW], padding: 0.3 });
  const yScale = scaleLinear({ domain: [0, Math.max(...data.map(d => d.value)) * 1.1], range: [innerH, 0] });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {data.map(d => (
          <Bar
            key={d.destination}
            x={xScale(d.destination)}
            y={yScale(d.value)}
            width={xScale.bandwidth()}
            height={innerH - yScale(d.value)}
            fill="#c44d2b"
          />
        ))}
        <AxisBottom
          scale={xScale}
          top={innerH}
          tickLabelProps={{ fontSize: 10, angle: -35, textAnchor: 'end', dy: '-0.2em' }}
        />
        <AxisLeft
          scale={yScale}
          tickFormat={v => `${(Number(v) / 1000).toFixed(0)}k`}
          numTicks={5}
          tickLabelProps={{ fontSize: 11 }}
        />
      </Group>
    </svg>
  );
}

function Section3() {
  const [data, setData] = useState<DiasporaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await registerParquet('s3.parquet', '/data/section3_diaspora.parquet');
        const rows = await query(`
          SELECT destination_iso3 as destination, MAX(value) as value
          FROM 's3.parquet'
          WHERE metric = 'stock' AND sex = 'all'
          GROUP BY destination_iso3
          ORDER BY value DESC
          LIMIT 15
        `) as DiasporaRow[];

        const merged: Record<string, number> = {};
        for (const r of rows) {
          const name = COUNTRY_NAMES[r.destination] || r.destination;
          merged[name] = Math.max(merged[name] || 0, r.value);
        }
        const sorted = Object.entries(merged)
          .map(([destination, value]) => ({ destination, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 12);

        setData(sorted);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p>Loading Section 3 data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (data.length === 0) return <p>No data returned.</p>;

  return (
    <div>
      <h2>Top Destinations for Slovaks Abroad</h2>
      <div style={{ width: '100%', height: 380 }}>
        <ParentSize>
          {({ width }) => <BarChart data={data} width={width} height={380} />}
        </ParentSize>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        Maximum recorded stock per country (any year). Source: OECD + UN DESA bilateral. 87 countries total.
      </p>
    </div>
  );
}

export default Section3;

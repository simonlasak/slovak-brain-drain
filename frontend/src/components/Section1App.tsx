import React, { useEffect, useState } from 'react';
import { query, loadParquet } from '../lib/db';

interface PopRow {
  year: number;
  geo_code: string;
  geo_name: string;
  metric: string;
  value: number;
}

function Section1() {
  const [data, setData] = useState<PopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await loadParquet('s1.parquet', '/data/section1_internal.parquet');
        const rows = await query(`
          SELECT year, geo_code, geo_name, metric, value
          FROM 's1.parquet'
          WHERE metric = 'population'
            AND geo_level = 'kraj'
            AND geo_code LIKE 'SK0_'
            AND age_bracket = 'all'
            AND education = 'all'
          ORDER BY year, geo_code
        `) as PopRow[];
        setData(rows);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p>Loading Section 1 data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  const regions = [...new Set(data.map(r => r.geo_code))];
  const years = [...new Set(data.map(r => r.year))].sort();

  return (
    <div>
      <h2>Population by NUTS-2 Region, 2004-2025</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Region</th>
            {years.filter(y => y % 5 === 0 || y === 2025).map(y => (
              <th key={y} style={{ padding: '4px 8px' }}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map(code => {
            const regionData = data.filter(r => r.geo_code === code);
            const name = regionData[0]?.geo_name || code;
            return (
              <tr key={code}>
                <td style={{ padding: '4px 8px' }}>{name}</td>
                {years.filter(y => y % 5 === 0 || y === 2025).map(y => {
                  const row = regionData.find(r => r.year === y);
                  return <td key={y} style={{ padding: '4px 8px', textAlign: 'right' }}>
                    {row ? Math.round(row.value).toLocaleString() : '-'}
                  </td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        Source: SU SR DataCube om7011rr. {data.length} rows loaded.
      </p>
    </div>
  );
}

export default Section1;

import React, { useEffect, useState } from 'react';
import { query, loadParquet } from '../lib/db';

interface DiasporaRow {
  destination_iso3: string;
  metric: string;
  value: number;
  year: number;
}

function Section3() {
  const [data, setData] = useState<DiasporaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await loadParquet('s3.parquet', '/data/section3_diaspora.parquet');
        const rows = await query(`
          SELECT destination_iso3, metric, value, year
          FROM 's3.parquet'
          WHERE metric = 'stock' AND sex = 'all'
          ORDER BY value DESC
          LIMIT 50
        `) as DiasporaRow[];
        setData(rows);
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

  return (
    <div>
      <h2>Top Destinations for Slovaks Abroad (stock)</h2>
      <table style={{ width: '100%', maxWidth: '500px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Destination</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Year</th>
            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Stock</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 8px' }}>{r.destination_iso3}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.year}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{Math.round(r.value).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        Source: OECD + UN DESA bilateral. 87 destination countries total.
      </p>
    </div>
  );
}

export default Section3;

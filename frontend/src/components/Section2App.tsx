import React, { useEffect, useState } from 'react';
import { query, loadParquet } from '../lib/db';

interface CorridorRow {
  year: number;
  pathway: string;
  metric: string;
  value: number;
}

function Section2() {
  const [data, setData] = useState<CorridorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await loadParquet('s2.parquet', '/data/section2_corridor.parquet');
        const rows = await query(`
          SELECT year, pathway, metric, value
          FROM 's2.parquet'
          WHERE sex = 'all' AND cz_geo_code = 'CZ'
          ORDER BY year, pathway
        `) as CorridorRow[];
        setData(rows);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p>Loading Section 2 data...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

  const pathways = [...new Set(data.map(r => r.pathway))].sort();
  const years = [...new Set(data.map(r => r.year))].sort();

  return (
    <div>
      <h2>Slovaks in Czechia by Pathway</h2>
      {pathways.map(pathway => {
        const pData = data.filter(r => r.pathway === pathway && r.metric === 'stock');
        if (pData.length === 0) {
          const studData = data.filter(r => r.pathway === pathway && r.metric === 'students_enrolled');
          if (studData.length > 0) {
            return (
              <div key={pathway} style={{ marginBottom: '1.5rem' }}>
                <h3>{pathway} (students enrolled)</h3>
                <p>
                  {studData.slice(-3).map(r => `${r.year}: ${Math.round(r.value).toLocaleString()}`).join(' | ')}
                </p>
              </div>
            );
          }
          return null;
        }
        return (
          <div key={pathway} style={{ marginBottom: '1.5rem' }}>
            <h3>{pathway} (stock)</h3>
            <p>
              {pData.slice(-5).map(r => `${r.year}: ${Math.round(r.value).toLocaleString()}`).join(' | ')}
            </p>
          </div>
        );
      })}
      <p style={{ fontSize: '0.8rem', color: '#666' }}>
        Source: CSU foreigners data + Eurostat education mobility. {data.length} rows loaded.
      </p>
    </div>
  );
}

export default Section2;

import React, { useEffect, useState } from 'react';
import { query, registerParquet } from '../lib/db';
import { CorridorMapWave } from './charts/CorridorMapWave';

interface RegionRow {
  cz_geo_code: string;
  value: number;
  year: number;
}

function CorridorWaveApp() {
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
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  return <CorridorMapWave data={regionData} years={regionYears} />;
}

export default CorridorWaveApp;

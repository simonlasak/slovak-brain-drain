/**
 * Loads a precomputed chart series.
 *
 * This replaces src/lib/db.ts, which booted DuckDB-WASM in the browser and ran
 * SQL against the Parquet files. That cost every visitor roughly 8 MiB over the
 * wire for a 34 MiB WASM module, to read 400 KB of Parquet, and made every chart
 * depend on jsDelivr being reachable. All sixteen series together are 68 KB.
 *
 * The SQL now lives only in pipeline/analysis/chart_data.py, which writes one
 * file per series into public/data/charts/. There is no SQL engine on the client
 * any more, so a component cannot drift from the query that produced its data:
 * there is no second copy of the query to drift from.
 *
 * Each file also carries its own `sql`, `note` and `consumer` fields, so a
 * rendered series can be traced to a query with one fetch and no build tooling.
 */

interface SeriesPayload<T> {
  key: string;
  consumer: string;
  note: string;
  sql: string;
  row_count: number;
  rows: T[];
}

// Shared across islands: /internal has five components and some ask for the same
// key, so this collapses those into one request. Keyed on the series name.
const inFlight = new Map<string, Promise<unknown[]>>();

export async function loadSeries<T = Record<string, unknown>>(key: string): Promise<T[]> {
  const cached = inFlight.get(key);
  if (cached) return cached as Promise<T[]>;

  const request = (async () => {
    const res = await fetch(`/data/charts/${key}.json`);
    if (!res.ok) {
      // Loud, not silent. A 404 here used to render as an empty chart frame with
      // nothing in the console, which is how a wrong asset path hides.
      throw new Error(`chart series "${key}": HTTP ${res.status} from /data/charts/${key}.json`);
    }
    const payload = (await res.json()) as SeriesPayload<T>;
    if (!Array.isArray(payload.rows)) {
      throw new Error(`chart series "${key}": payload has no rows array`);
    }
    return payload.rows;
  })();

  inFlight.set(key, request as Promise<unknown[]>);
  // Do not cache a rejection: a transient failure should not poison every later
  // mount of every component that wants this series.
  request.catch(() => inFlight.delete(key));
  return request;
}

/** Load several series at once. Rejects if any one of them fails. */
export function loadAll<T = Record<string, unknown>>(keys: string[]): Promise<T[][]> {
  return Promise.all(keys.map(k => loadSeries<T>(k)));
}

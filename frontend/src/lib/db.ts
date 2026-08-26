import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
const registeredFiles = new Set<string>();

let dbInitPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * The WASM binary and its worker are fetched from jsDelivr rather than from
 * this site's own public/ directory.
 *
 * WHY, and it is not a preference: duckdb-eh.wasm is 34.1 MiB, and Cloudflare
 * Pages refuses any single file over 25 MiB at upload time. Serving it from
 * public/ makes the deploy fail before the site exists. GitHub Pages would
 * accept it (100 MB limit) but caps bandwidth at 100 GB/month, which this file
 * alone would burn through in a few thousand visits.
 *
 * The URLs are not hardcoded. getJsDelivrBundles() builds them from the
 * PACKAGE_VERSION compiled into the installed library, so they always point at
 * the exact version package-lock.json pins, and a dependency bump cannot leave
 * a stale URL behind. selectBundle() then probes the browser and picks the
 * exception-handling build where it is supported and the MVP build where it is
 * not, which is a capability the old single hardcoded path did not have.
 *
 * The long-term fix is to stop shipping a database engine to the browser at
 * all: the three Parquet files total 400 KB and every query on this site is
 * known at build time, so they could be precomputed to JSON in the pipeline.
 * Until then, this keeps 34 MiB off our own origin and onto a CDN built for it.
 */
export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    if (!bundle.mainWorker) {
      throw new Error('duckdb-wasm: no worker in the selected bundle');
    }

    // A Worker cannot be constructed directly from a cross-origin URL, so the
    // CDN worker script is wrapped in a same-origin blob that importScripts it.
    // This is the pattern duckdb-wasm's own documentation prescribes for CDN
    // delivery. The blob URL is revoked once the worker holds it.
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
    );

    try {
      const worker = new Worker(workerUrl);
      // VoidLogger, not ConsoleLogger: the console logger narrates every query
      // to the browser console on a published site.
      const instance = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);
      db = instance;
      return instance;
    } catch (err) {
      // Let a later mount retry rather than caching a rejected promise forever.
      dbInitPromise = null;
      throw err;
    } finally {
      URL.revokeObjectURL(workerUrl);
    }
  })();

  return dbInitPromise;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const database = await getDB();
  conn = await database.connect();
  return conn;
}

export async function registerParquet(name: string, url: string): Promise<void> {
  if (registeredFiles.has(name)) return;
  const database = await getDB();
  const response = await fetch(url);
  if (!response.ok) {
    // A silent failure here renders an empty chart frame with no error, which
    // is how a wrong asset path hides. Fail loudly instead.
    throw new Error(`registerParquet: ${url} returned ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  await database.registerFileBuffer(name, new Uint8Array(buffer));
  registeredFiles.add(name);
}

export async function query(sql: string): Promise<Record<string, unknown>[]> {
  const c = await getConnection();
  const result = await c.query(sql);
  return result.toArray().map((row: any) => {
    const obj = row.toJSON();
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'bigint') {
        obj[key] = Number(obj[key]);
      }
    }
    return obj;
  });
}

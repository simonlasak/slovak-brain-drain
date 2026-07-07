import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
const registeredFiles = new Set<string>();

let dbInitPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    console.log('DuckDB: creating worker...');
    const worker = new Worker('/duckdb/duckdb-browser-eh.worker.js');
    const logger = new duckdb.ConsoleLogger();
    const instance = new duckdb.AsyncDuckDB(logger, worker);
    console.log('DuckDB: instantiating wasm...');
    await instance.instantiate('/duckdb/duckdb-eh.wasm');
    console.log('DuckDB: ready');
    db = instance;
    return instance;
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

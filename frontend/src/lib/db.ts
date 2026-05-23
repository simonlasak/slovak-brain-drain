import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export async function getDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;

  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return db;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const database = await getDB();
  conn = await database.connect();
  return conn;
}

export async function query(sql: string): Promise<Record<string, unknown>[]> {
  const c = await getConnection();
  const result = await c.query(sql);
  return result.toArray().map((row: any) => row.toJSON());
}

export async function loadParquet(name: string, url: string): Promise<void> {
  const database = await getDB();
  await database.registerFileURL(name, url, duckdb.DuckDBDataProtocol.HTTP, false);
}

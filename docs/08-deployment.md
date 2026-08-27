# Deployment

Target: **Cloudflare Workers Static Assets**, free tier, on the project subdomain
`slovak-brain-drain.simonlasak4.workers.dev`. No custom domain, no paid plan.

Note the product: Cloudflare's "Create > import a repository" flow builds a
Workers project rather than a Pages project, so the build ends in
`npx wrangler deploy` against `frontend/wrangler.jsonc` instead of taking a build
output directory from the dashboard. Both serve this site identically at the root
path. Pages remains a drop-in alternative and needs no file in the repo.

The site is a static Astro build (`output: 'static'`), so there is no adapter and
no server code. The Worker is assets-only: `wrangler.jsonc` carries no `main` key,
so Cloudflare simply serves `frontend/dist/` as files.

---

## Why Cloudflare and not GitHub Pages

Both were evaluated. The deciding constraint is the path prefix.

A GitHub project page publishes at `https://<user>.github.io/slovak-brain-drain/`,
and this site has around 25 root-absolute paths with no use of
`import.meta.env.BASE_URL`: six nav hrefs in `Base.astro`, and sixteen asset paths
inside React islands such as `fetch('/data/sk_okresy.geojson')` and
`registerParquet('s1.parquet', '/data/section1_internal.parquet')`. Astro's `base`
config rewrites the links it generates but **not** string literals inside island
components, so those sixteen would 404. The failure is silent: the build stays
green and the chart renders an empty frame. Fixing it means touching sixteen call
sites and re-verifying every figure.

Cloudflare Pages serves the project subdomain at the **root path**, so every URL
matches local development exactly and none of that work is needed.

Secondary reasons: unlimited bandwidth on the free tier against GitHub's 100 GB
per month soft limit, Brotli rather than gzip, and support for a `_headers` file.

GitHub Pages remains viable if the repo is ever renamed to `<user>.github.io`,
which also serves at the root path. That option needs zero code changes.

---

## Dashboard settings

Connect the GitHub repo, then set exactly this:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` |

Root directory is `frontend` because there is no `package.json` at the repo root,
and because `wrangler.jsonc` sits beside it with paths relative to itself. Leaving
it at `/` was the first deploy's failure: npm looked for `package.json` at the
repo root, and `.nvmrc` was never read.

On a Pages project instead of a Workers one, there is no deploy command and you
give it a **Build output directory** of `dist` (relative to the root directory, so
`dist` and not `frontend/dist`).

No environment variables are required. `frontend/.nvmrc` pins Node 22, which
Cloudflare reads automatically. If it ever does not, set `NODE_VERSION=22`
manually; Astro 6 requires Node ^20.19.0 or >=22.

`frontend/.npmrc` sets `legacy-peer-deps=true`. This is load-bearing: visx
declares a peer dependency on React <=18 and this project runs React 19, so a
clean `npm ci` fails to resolve the tree without it. `package-lock.json` was
generated under the same setting.

---

## The 34 MiB problem, and how it was retired

Kept as a record, because the first fix was a workaround and the second was not.

`duckdb-eh.wasm` is 34.1 MiB. **Cloudflare rejects any single file over 25 MiB at
upload time**, so with the binary vendored into `frontend/public/duckdb/` the very
first deploy failed before the site could exist.

**First fix, since replaced.** `src/lib/db.ts` fetched the module and its worker
from jsDelivr instead, with the URLs derived by `duckdb.getJsDelivrBundles()` from
the `PACKAGE_VERSION` compiled into the installed library so they tracked
`package-lock.json`. It unblocked the deploy, and it introduced a hard runtime
dependency: if jsDelivr was unreachable, DuckDB never instantiated and every chart
rendered an empty frame, because no island had a load-failure state. That was
observed for real in a browser with no external egress, where `fonts.googleapis.com`
and `cdn.jsdelivr.net` both failed while every same-origin asset served 200. The
fonts fell back to a system face; the charts went blank.

**Second fix, current.** DuckDB is gone from the browser entirely.
`pipeline/analysis/chart_data.py` runs the same sixteen queries against the Parquet
files and writes one JSON file per series into `frontend/public/data/charts/`.
`src/lib/chartData.ts` fetches them. `src/lib/db.ts` is deleted, and
`@duckdb/duckdb-wasm` and `apache-arrow` are out of `package.json`.

What it bought:

| | Before | After |
|---|---|---|
| Engine download, first chart page | ~34 MiB, about 8 MiB over the wire | none |
| All chart data | 400 KB of Parquet | **68 KB of JSON**, 16 files |
| Landing page transfer | dominated by the WASM fetch | **456 KB** |
| External runtime dependencies | jsDelivr, Google Fonts | Google Fonts |
| Largest remaining asset | the WASM | `sk_okresy.geojson`, 1.28 MB |

Proved data-neutral rather than assumed: every rendered mark and every character of
visible text was captured in a headless browser before and after the change, across
all five chart-bearing routes, and the two snapshots are identical. 1,267 SVG marks,
no differences.

The SQL now lives in exactly one place. The frontend has no SQL engine, so a
component cannot diverge from the query behind its data; there is no second copy to
diverge from. Each generated file also carries its own `sql`, `note` and `consumer`
fields, so a series can be traced to a query with one fetch.

Re-run `python -m pipeline.analysis.chart_data` after any transform change. It fails
loudly on a series that comes back empty rather than writing one.

The Parquet files stay in `public/data/`: `/methodology` links them for download
under CC BY 4.0. They are published output now, not a runtime dependency.

### The boundary files, done next

Removing DuckDB made `sk_okresy.geojson` the largest asset on the site, so
`pipeline/transform/boundaries_web.py` now optimises the three GeoJSON files on the
way into `frontend/public/data/`. They had been copied byte-identical to what the
fetchers pulled down.

| File | Before | After |
|---|---|---|
| `sk_okresy.geojson` | 1284.9 KB | **581.6 KB** |
| `cz_kraje.geojson` | 428.0 KB | **205.2 KB** |
| `world_countries.geojson` | 199.8 KB | 199.8 KB (already lean) |

Two changes, both invisible at render scale. Coordinates are rounded to five
decimal places, about 1.1 m, against a rendered pixel of roughly 480 m on the §1
map: the upstream files carried up to 15 decimals, which is sub-nanometre. And only
the properties the frontend actually reads are kept, which is two of the 17
Eurostat attributes on `cz_kraje` and two of the five on `sk_okresy`.

Rounding is safe for shared borders because it is deterministic: neighbours store
the same coordinates along a shared edge, and equal inputs round to equal outputs,
so edges that met still meet. Verified rather than assumed: feature counts, key
values and names are preserved in order, and the bounding-box drift is 0.54 m,
inside the half-step the rounding permits.

It deliberately does NOT simplify geometry. Dropping vertices would save more but
moves borders, and doing it without topology awareness opens gaps between
neighbours. That needs mapshaper and a visual check.

### Still worth doing

The largest asset is now `dist/_astro/geojson-layer.*.js` at 691 KB, which is
deck.gl's GeoJSON layer. Both scroll maps hydrate on load, so it sits on the
critical path of `/internal` and `/corridor` whether or not the reader scrolls to
the map.

## Verification after the first deploy

1. `curl -I https://slovak-brain-drain.simonlasak4.workers.dev/` returns 200.
2. `curl -I https://slovak-brain-drain.simonlasak4.workers.dev/data/section1_internal.parquet`
   returns 200. If this 404s, the output directory is set wrong.
3. Open `/internal` and confirm the charts render. This exercises the whole chain:
   blob worker, jsDelivr WASM, Parquet fetch, DuckDB query.
4. Open `/diaspora` and `/people`. Neither has ever been checked in a browser by a
   human as of this writing.
5. Check the SK/EN toggle persists across a navigation.
6. `curl -I .../nonexistent` returns 404 and serves the project's own 404 page.
7. Confirm `robots.txt` is being served. Crawling was opened on 27 August 2026;
   the file records what an indexed snapshot still misrepresents, namely the
   stubbed Slovak.

### Observed on the first live deploy

Routes resolve with one redirect hop: `/internal` returns 307 to `/internal/`,
which returns 200. That is Workers' default `auto-trailing-slash` handling meeting
Astro's directory build format, where the page is written as
`internal/index.html`. It is correct and browsers follow it, and the canonical
tags already use the trailing-slash form so the two agree. It does cost one extra
round trip per nav click. Removing it would mean either `build.format: 'file'` in
`astro.config.mjs` or `html_handling` in `wrangler.jsonc`; neither is worth doing
before the Parquet-to-JSON change lands.

## Local equivalent

`npm run preview` from `frontend/` serves the real production build at the root
path on `localhost:4321`, which is the closest available match to the deployed
site. `npm run dev` does not exercise the built asset paths. Use
`npm run preview -- --host` to reach it from a phone on the same network.

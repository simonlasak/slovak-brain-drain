# Deployment

Target: **Cloudflare Pages**, free tier, on the project subdomain
`slovak-brain-drain.pages.dev`. No custom domain, no paid plan.

The site is a static Astro build (`output: 'static'`), so there is no adapter, no
server runtime and no Worker. Cloudflare serves `frontend/dist/` as files.

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
| Framework preset | Astro |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Production branch | `main` |

Root directory is `frontend` because there is no `package.json` at the repo root.
The output directory is relative to the root directory, so it is `dist` and not
`frontend/dist`.

No environment variables are required. `frontend/.nvmrc` pins Node 22, which
Cloudflare reads automatically. If it ever does not, set `NODE_VERSION=22`
manually; Astro 6 requires Node ^20.19.0 or >=22.

`frontend/.npmrc` sets `legacy-peer-deps=true`. This is load-bearing: visx
declares a peer dependency on React <=18 and this project runs React 19, so a
clean `npm ci` fails to resolve the tree without it. `package-lock.json` was
generated under the same setting.

---

## The 34 MiB problem, and what was done about it

`duckdb-eh.wasm` is 34.1 MiB. **Cloudflare Pages rejects any single file over
25 MiB at upload time**, so with the binary vendored into `frontend/public/duckdb/`
the deploy failed before the site could exist.

Resolved in `frontend/src/lib/db.ts` by fetching the WASM module and its worker
from jsDelivr instead. The URLs are derived by `duckdb.getJsDelivrBundles()` from
the `PACKAGE_VERSION` compiled into the installed library, so they always point at
the version `package-lock.json` pins and cannot go stale on a dependency bump.
`selectBundle()` additionally probes the browser and selects the
exception-handling build where supported and the MVP build where not, which the
previous single hardcoded path could not do.

Verified before adoption:

```
$ curl -sI https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev45.0/dist/duckdb-eh.wasm
200, content-type: application/wasm
```

A cross-origin URL cannot be passed to `new Worker()`, so the CDN worker script is
wrapped in a same-origin blob that `importScripts` it. This is the pattern
duckdb-wasm's own documentation prescribes for CDN delivery.

`frontend/public/duckdb/` was deleted from the working tree. It remains in git
history and in `node_modules`, so nothing is lost.

### Known risk this introduces

Every chart on the site now has a hard runtime dependency on jsDelivr. If that CDN
is unreachable, DuckDB never instantiates and the chart islands render an empty
frame rather than a message, because no component has a load-failure state.

The site already depended on one third party at runtime, Google Fonts in
`Base.astro`, but that one degrades gracefully to a fallback typeface. This one
does not degrade: it removes the data.

Observed for real while finishing the WIP. A sandboxed browser with no external
egress failed identically on both hosts, `fonts.googleapis.com` and
`cdn.jsdelivr.net`, while every same-origin asset still served 200. The fonts
merely fell back; the charts went blank.

Two mitigations, neither done:
- Cheap: give the chart islands a visible failure state, so an unreachable CDN
  reads as "could not load the data" rather than as an empty chart.
- Real: precompute the JSON, per the section below, and the dependency is gone.

### This is a workaround, not the right answer

Every visitor still downloads a 34 MiB database engine, roughly 8 MiB over the
wire after Brotli, to query 400 KB of Parquet. The landing page boots it to render
one number it already has server-rendered as a fallback.

The real fix is to stop shipping DuckDB to the browser: every query on this site
is known at build time, so the pipeline can precompute one JSON file per chart and
the islands can fetch those. That removes the CDN dependency, the blob-worker
trick and the 8 MiB, and it makes the host question moot. Estimated at half a day.
It is deliberately deferred past the WIP launch.

---

## Verification after the first deploy

1. `curl -I https://slovak-brain-drain.pages.dev/` returns 200.
2. `curl -I https://slovak-brain-drain.pages.dev/data/section1_internal.parquet`
   returns 200. If this 404s, the output directory is set wrong.
3. Open `/internal` and confirm the charts render. This exercises the whole chain:
   blob worker, jsDelivr WASM, Parquet fetch, DuckDB query.
4. Open `/diaspora` and `/people`. Neither has ever been checked in a browser by a
   human as of this writing.
5. Check the SK/EN toggle persists across a navigation.
6. `curl -I .../nonexistent` returns 404 and serves the project's own 404 page.
7. Confirm `robots.txt` is being served. It currently **disallows all crawling**,
   deliberately, because `/resources` holds placeholder content and Slovak is
   untranslated. Change it at launch.

## Local equivalent

`npm run preview` from `frontend/` serves the real production build at the root
path on `localhost:4321`, which is the closest available match to the deployed
site. `npm run dev` does not exercise the built asset paths. Use
`npm run preview -- --host` to reach it from a phone on the same network.

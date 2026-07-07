# Checkpoints — Slovak Brain Drain case study

This file is the audit trail of every meaningful decision made while building
the project. The agent writes each checkpoint summary; Šimon writes the
decision back. New entries go at the bottom.

---

## Checkpoint 0 — Stage 0 setup complete

Date: 2026-05-23

### What I did

1. Read all six specification documents in order
   (`docs/01-research-architecture.md` through `docs/06-sources-page.md`).
2. Asked the six Stage 0 pre-flight questions; Šimon answered. Decisions
   captured in agent memory under `project_brain_drain` and
   `feedback_workflow`. Headline overrides:
   - Single global EN ⇄ SK language toggle, **not** the Slovak-primary +
     English-subtitle bilingual treatment shown in `docs/05-design.md`.
     One language at a time.
   - Cloudflare Pages as the default hosting target (Šimon open to
     alternatives that minimise cost; self-hosting ruled out).
   - Mobile-responsive option (a) — full responsive down to ~375px with
     simplified mobile fallbacks for maps and Sankeys.
   - License: permissive ("anyone can quote and use anything"). Site code
     MIT-equivalent, processed data outputs CC-BY-4.0.
   - Section 4 notable-people longlist deferred until later.
   - Solo on `main`, no PRs, one commit per stage gate.
3. Built the Slovak diacritic test page at
   `frontend/public/diacritic-test.html` covering Source Serif 4, Inter Tight,
   and JetBrains Mono at weights 400 / 500 / 600, with the required
   `ä č ď ô ľ ŕ š ť ž` string at 72px, a Slovak pangram-style context
   phrase at 24px, the 14px ALL-CAPS section eyebrow stress test
   (`§2 · ČESKÝ KORIDOR`), a 96px hero number `240 000`, and a
   side-by-side SK / EN section title comparison. Šimon viewed the page
   and approved all three families on first look. Inter Tight is locked
   in as the production UI sans — **no need to license Pangram Sans**.
4. Created `frontend/src/styles/tokens.css` with the full design-token CSS
   variable block from `docs/05-design.md`, plus the data-viz scale
   variables and a `prefers-reduced-motion` block.
5. Wrote `pipeline/config.yaml` — single source of truth for endpoints,
   paths, and rate limits, sourced from `docs/02-data-manifest.md`.
6. Wrote `pipeline/fetch/susr.py` — a real, idempotent ŠÚ SR DataCube fetch
   module with sidecar manifest writing, SHA-256 hashing, and a
   `CorporateProxyError` exception that surfaces SSL / connection
   failures rather than retrying silently. Companion runner at
   `pipeline/run_smoke.py`.
7. Ran the smoke test against `om7102rr` (Population by Sex — okres). Result:
   - HTTPS to `data.statistics.sk` works from this AWS machine — **no
     corporate proxy issue**.
   - Output: `data/raw/susr_datacube/om7102rr.json-stat.json` (15,565 bytes)
     plus `.manifest.json` sidecar with provenance.
   - Sanity: example cell `M (City) → 2,841,499 persons` matches Slovakia's
     urban population for 2024.

### Data findings (early, narrow)

- DataCube paths require the **exact** dimension count for the cube — the
  spec example `?type=csv` redirects to a download HTML page (302) and is
  not usable programmatically. The format that actually works inline is
  `type=json` (which serves JSON-stat 2.0). Updated `02-data-manifest.md`
  is the right reference long-term; for now I've baked the gotcha into
  `pipeline/fetch/susr.py` docstring so the next person doesn't trip on it.
- The `om7102rr` cube has 4 dimensions: `vuc` (geo) × `obd` (year) ×
  `ukaz` (indicator) × `poh` (sex). For the smoke test I narrowed to one
  year × one indicator × total sex, leaving geos open. That returns ~96
  cells for the SR + 8 kraje + 79 okresy + a few NUTS aggregates.
- The collection listing at `/api/v2/collection?lang=en` is a 559 KB JSON
  document with all 666 cubes, their dimensions, and labels. This is the
  authoritative discovery endpoint — any cube we want is in there. Useful
  for Stage 1 fetch fan-out.

### What I'm uncertain about

1. **Hosting & headers for DuckDB-Wasm.** Cloudflare Pages supports COOP /
   COEP headers for SharedArrayBuffer (which DuckDB-Wasm wants for
   threading), but it's worth confirming we can serve cross-origin
   isolated headers without breaking the Google Fonts CDN load. Worst
   case: self-host the three fonts, which is straightforward but adds a
   step.
2. **DataCube CSV redirect.** I disabled programmatic CSV fetching in
   `pipeline/fetch/susr.py` because the API serves CSVs through a 302
   redirect to an HTML page rather than returning bytes inline.
   `02-data-manifest.md` recommends JSON-stat as the preferred format for
   tooling anyway, so this isn't a blocker — but if any downstream user
   wants CSV we'll have to use an Excel-export route or transform from
   JSON-stat ourselves.
3. **Pipeline orchestrator design.** The spec calls for `pipeline/run_all.py`
   that runs every fetch idempotently and writes a per-source log. I have
   not yet built this; the smoke test stands alone. Stage 1 plan: wrap the
   `fetch_cube()` primitive in a per-table loop that respects the manifest
   hash to skip unchanged data, with explicit per-source logging.

### Recommended next step

Move into **Stage 1 — Fetch**, in priority order from `docs/04-spec.md`:

1. Boundaries first (small, fast, blocks visualisation prep).
2. UN DESA bilateral migrant stock (small, blocks Section 3).
3. ŠÚ SR DataCube — fan out from the smoke test to the full Section 1 table
   set (population, migration, age, wage, demographic balance).
4. Eurostat (medium — `migr_pop1ctz`, `migr_emi1ctz`, `educ_uoe_mobs02`,
   regional unemployment, regional GDP).
5. Zenodo IZ Bratislava LAU1 panel (one download, ~20 MB).
6. Census 2021 hyperkocky (large — ~200 MB; defer obec-level until needed).
7. ČSÚ "Foreigners in the Czech Republic" PDFs (extract last so we have a
   stable codebase before debugging table layouts).
8. OECD DIOC (5-yearly snapshots; check whether 2020/21 round is published
   yet — if not, fall back to 2015/16 with a clear caveat).

Each fetch produces `data/raw/<source>/<artifact>` plus a sidecar
`.manifest.json` per the pattern set in the smoke test.

### Questions for you

1. **Hosting confirmation.** Cloudflare Pages it is, unless you'd like me to
   compare against alternatives. If we go Cloudflare Pages, I'll also set
   up a `wrangler.toml` and the `_headers` file for COOP / COEP at the
   start of frontend work — neither blocks Stage 1.
2. **Boundary file granularity for Section 1.** The obec layer is the heavy
   one — 2,891 polygons, ~50 MB raw, ~10–15 MB simplified. I propose to
   ship simplified-to-okres as the default for the kraj/okres choropleth,
   and lazy-load obec polygons only on a deep-zoom drill into a single
   selected okres. Confirm or override.
3. **DataCube refresh cadence.** Pipeline can rerun fully on each push, or
   we can pin to a snapshot (the smoke test already records SHA + fetch
   timestamp in the sidecar manifest). My recommendation: pin per release
   and rebuild quarterly to keep audit trails clean. Confirm or override.

### Your decision (Šimon to fill in)

[ ]

---

## Checkpoint 1 — Stage 1 Fetch complete

Date: 2026-05-23

### Summary

All 10 data sources acquired: 442 files, 738 MB total.

| Source | Files | Size | Coverage |
|--------|-------|------|----------|
| ŠÚ SR DataCube | 243 | 12.6 MB | 11 cubes, 2004–2025 |
| Eurostat | 8 | 44.3 MB | 8 bulk TSV datasets |
| Census 2021 | 10 | 529 MB | 9 indicators, 2,927 obec |
| Census 2011 | 148 | 4.3 MB | Education at 78 okres |
| OECD | 5 | 19.8 MB | Migration flows + DIOC |
| ČSÚ Foreigners | 4 | 10.8 MB | Slovaks in CZ (stock, region, employment, age) |
| UN DESA | 1 | 6.1 MB | Bilateral migrant stock 2020 |
| IZ Bratislava | 20 | 109.5 MB | LAU1 panel (Zenodo) |
| Boundaries | 2 | 1.4 MB | SK okresy GeoJSON + world TopoJSON |
| Notable people | 1 | 0.0 MB | Template for manual curation |

### Constraint: 2011→2021 education comparison

Census 2011 data is at **okres level only**. The education change map
(2011 vs 2021) must display at okres granularity and must NOT offer
obec-level zoom for the historical comparison layer. Obec-level detail
is available for 2021-only views.

### Verification

- Census 2021 education total: 5,449,270 (exact match)
- Census 2011 okres education total: 5,197,565 (15+ pop, correct)
- ISCED crosswalk built: data/processed/education_isced_crosswalk.csv
- ČSÚ contains Slovak-specific data (101k+ Slovaks in CZ from 2015)

### Decision

Approved. Before Stage 2, fetch Czech MSMT student data (Slovak students
at Czech universities). Constraint on 2011 okres-level noted.

---

## Checkpoint 4 - Stage 4 Frontend v0 scaffold

Date: 2026-05-23

### What was done (Stages 1-4 in one session)

**Stage 1 (Fetch):** 10 sources, 442 files, 738 MB raw data
**Stage 2 (Transform):** 3 parquet outputs + notable_people.json
  - section1_internal: 124,680 rows (12 metrics, 2004-2025, kraj/okres/obec)
  - section2_corridor: 620 rows (stock + students, 2012-2025)
  - section3_diaspora: 5,708 rows (87 countries, 1990-2024)
  - notable_people.json: 9 verified entries + section_caveats
**Stage 3 (Validate):** 5 checks passed (0 red, 4 yellow)
**Stage 4 (Frontend v0):** Astro + React islands scaffold, 7 routes

### Known issues in v0 (fix next session)

1. DuckDB-Wasm worker fails to load from CDN due to CORS (Worker
   constructor blocks cross-origin scripts from localhost). Fix:
   self-host the worker file in public/ or use inline worker.
2. Locale toggle (SK/EN) button does nothing yet.
3. Section 4 (/people) shows an age histogram of notable people only,
   not the overall population age structure. The histogram should
   show age-at-leaving distribution from the 9 people (which is the
   correct intent per spec - it visualizes the pattern that most
   leave before completing tertiary). But the page needs editorial
   framing to make this clear.
4. Sections 1-3 show error state because DuckDB fails (see #1).
5. No charts built yet (just tables/text once DuckDB works).
6. No MDX editorial content integrated.
7. No MapLibre maps.
8. No Visx charts.

### Next session priorities (in order)

1. Fix DuckDB-Wasm worker loading (self-host .wasm + worker files)
2. Get data rendering on all 3 interactive sections
3. Build first real Visx chart (population trend line for Section 1)
4. Draft editorial content (English first) for Section 1 opening
5. Submit editorial draft for approval before building remaining charts

### Architectural decisions locked in

- Framework: Astro 6 + React islands
- Data layer: DuckDB-Wasm querying static parquet files
- Fonts: Source Serif 4 + Inter Tight + JetBrains Mono (loaded from Google Fonts)
- Charts: Visx (React)
- Maps: MapLibre GL
- Routing: 7 pages (/, /internal, /corridor, /diaspora, /people, /resources, /methodology)
- Hosting target: Cloudflare Pages (static output)
- No em-dashes anywhere in frontend

---

## Section 2 - Data analysis self-correction

Date: 2026-05-27

The initial exploratory analysis of section2_corridor.parquet concluded that "the student pipeline is collapsing while the labour pipeline accelerates," framing the corridor as a behavioural shift from education to direct labour migration. Three verification checks disproved this causal claim. First, Slovakia's 15-19 cohort shrank 37% between 2004 and 2019, matching the 41% student decline almost exactly (demographic, not behavioural). Second, the mean age of EU27 foreigners in CZ rose at 1 year per calendar year from 2015-2024, consistent with a stable cohort aging in place rather than young arrivals refreshing the distribution. Third, OECD annual inflows to CZ have been stable at 6,000-7,000/year since 2012, showing no acceleration. The revised narrative: the corridor is a story of successful retention (people came and stayed) combined with demographic headwinds (fewer young Slovaks available to send), not a behavioural shift or acceleration. This correction is documented in data/processed/sources_report.json and the editorial draft has been rewritten accordingly.

---

## Section 2 - Parquet enrichment and schema fixes

Date: 2026-05-28

### What was fixed

1. **Labour pathway triple-count bug.** The CIZ03 raw data has three
   indicator types per year/sex (total employment, employees,
   self-employed) but the transform script ignored the Ukazatel column,
   producing three indistinguishable rows per year/sex. Any SUM or
   GROUP BY query would triple-count. Fix: added `employment_status`
   column with values 'total', 'employed', 'self_employed'. All other
   pathway rows get 'n/a'.

2. **Labour 2012-2014 false discontinuity.** These rows appeared to be
   annual flows (~12-14k) vs stock (150k+). Investigation revealed they
   are self-employed stock only (the total and employee indicators do
   not exist in CIZ03 before 2015). Not a flow/stock discontinuity but
   a coverage gap. The `employment_status` column makes this visible:
   2012-2014 has only 'self_employed' rows, 2015+ has all three types.
   No `is_stock` column needed.

### What was added

- **Age structure proxy (EU27).** CIZ004T002 provides age distribution
  of EU27 citizens in CZ by 5-year bands, sex, and year (2015-2024).
  540 rows added with `metric = 'age_structure_proxy'`, `is_proxy = True`,
  and `proxy_note` explaining the proxy. Slovak-specific age data does
  not exist in CSU open data.

### What remains unavailable

- **NACE sector breakdown:** CSU publishes this in the annual
  "Foreigners in the Czech Republic" report but the table is not in the
  open-data download (CIZ03 has only total/employed/self-employed).
  Requires manual extraction from annual PDF or a different CSU table
  code. Deferred.
- **Field-of-study for Slovak students:** Confirmed permanent gap.
  Eurostat educ_uoe_mobs02 has ISCED level only (no subject field).
  MSMT DSIA files (f21_ciz, f22_ciz) aggregate all foreigners with no
  nationality dimension. DZS PDFs have field data only for all
  foreigners combined, not Slovak-specific. Student chart stays as
  ISCED level split (ED5/6/7/8) only.
- **Slovak regional origin (SK side of Sankey):** Does not exist in any
  CSU source. Permanent gap. Sankeys dropped from the visualisation set.

### Row counts

- Before: 620 rows
- After: 1,160 rows (+540 age structure proxy rows)

### What is now unblocked for frontend work

1. CZ destination map (ArcLayer + ScatterplotLayer, year scrubber 2015-2025)
2. Stock trend line chart (all/labour/student, with employment_status
   filter to avoid triple-counting)
3. Age structure bar chart (EU27 proxy, clearly labelled)
4. Student ISCED level breakdown over time (ED5/6/7/8 stacked or
   small multiples)

---

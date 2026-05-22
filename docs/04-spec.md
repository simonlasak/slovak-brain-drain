# Claude Code Spec — Slovak Brain Drain Case Study Website

This is a complete handoff document for a Claude Code agent. It assumes the agent has the three companion documents (`01-research-architecture.md`, `02-data-manifest.md`, `03-methodology.md`) in the same project.

## Project goal

Build an interactive case-study website that explores Slovak brain drain through four sections (three interactive with maps and filters, one static narrative). The user (Šimon) is a third-year CS student at UCD with strong data-engineering chops, who wants to publish this as a portfolio-quality project.

**Two goals carry equal weight:**

1. **Fundamental quality of data and methodological honesty** — the data must be sourced from primary records, joins must be auditable, interpolations must be flagged, and the methodology page must let any reader reconstruct any chart.

2. **An immersive, distinctive user experience** — the site must read as a serious editorial publication, not a generic AI-generated dashboard. Every visual decision follows `docs/05-design.md`, which locks in the Folk-modern aesthetic (Source Serif 4 + Pangram Sans + JetBrains Mono, terracotta primary, Tatra blue secondary, harvest gold tertiary, Čičmany-derived geometric motifs used sparingly and functionally). The agent must read `05-design.md` before generating any UI and reference it in every iteration.

## Tech stack (recommendation, not mandate)

The Claude Code agent should consider and propose changes, but defaults are:

**Data pipeline (Python):**
- `httpx` for HTTP fetching with proper rate limiting (max 4 concurrent, 200ms delay between calls for the ŠÚ SR API)
- `pydantic` for typed data schemas
- `polars` for transformation (faster than pandas, handles wide migration matrices well)
- `pyarrow` for parquet I/O
- `geopandas` for boundary processing
- `pdfplumber` + `camelot-py` for PDF extraction
- Output: parquet files in `data/processed/` + a single SQLite database `data/processed/brain_drain.db` for the frontend to query

**Frontend (TypeScript):**
- `React` + `Vite` for app framework
- `Maplibre GL JS` for the base map tile rendering (free, no token needed) with a custom style tuned to the design palette — not Mapbox defaults
- `deck.gl` (Uber's WebGL visualization library) for all interactive map layers — ChoroplethLayer for the kraj/okres maps, ScatterplotLayer with custom diamond markers for cities, ArcLayer for migration flows, HeatmapLayer for the world diaspora map. This is what NYT, Pew, The Pudding, and most award-winning data journalism uses in 2025-2026.
- `@visx/*` for custom charts in React — Airbnb's low-level D3 building blocks (axes, scales, shapes, scales). Drop to raw `d3` only when visx lacks a primitive.
- `@tanstack/react-table` for the data table view (methodology page lets users browse raw data).
- `framer-motion` for component transitions and layout animations.
- `gsap` for sequenced scrollytelling timelines.
- `react-scrollama` for scroll-trigger management on the Section 4 timeline and any scrollytelling moments.
- `shadcn/ui` for utility components (dialogs, dropdowns, comboboxes) — themed to the design system, not used at defaults.

**Explicitly NOT used:**
- Vega-Lite (too inflexible for the custom interactions we need)
- Recharts or Nivo (too generic, undermines the distinctive aesthetic)
- Plotly (scientific-software feel doesn't fit editorial direction)
- Tailwind defaults (every utility class still goes through the design tokens)

**Database serving the frontend:**
- SQLite served via static `.db` file + `sql.js-httpvfs` for client-side queries (no backend needed; the site can be static-hosted on Vercel or Netlify)
- Alternative: Parquet files served statically and queried client-side via DuckDB-Wasm — probably the cleaner option given the data shapes

**Deployment:**
- Static hosting (Vercel / Cloudflare Pages / GitHub Pages)
- No backend required → no infra costs

## Project structure

```
slovak-brain-drain/
├── docs/
│   ├── 01-research-architecture.md      # the plan
│   ├── 02-data-manifest.md              # data sources
│   ├── 03-methodology.md                # definitions, caveats
│   └── 04-spec.md                       # this file
├── data/
│   ├── raw/                             # untouched fetched data, never edited
│   │   ├── susr_datacube/
│   │   ├── scitanie_2021/
│   │   ├── csu_foreigners/
│   │   ├── un_desa/
│   │   ├── oecd_dioc/
│   │   ├── eurostat/
│   │   ├── upsvar_iz/
│   │   ├── geographic/
│   │   └── notable_people/
│   ├── interim/                         # half-processed, for inspection
│   └── processed/                       # final tidy parquet + DuckDB
│       ├── section1_internal.parquet
│       ├── section2_corridor.parquet
│       ├── section3_diaspora.parquet
│       ├── notable_people.json
│       ├── boundaries_sk_kraj.geojson
│       ├── boundaries_sk_okres.geojson
│       ├── boundaries_sk_obec.geojson  # simplified for web
│       ├── boundaries_world.geojson
│       └── manifest.json                # describes every column of every file
├── pipeline/
│   ├── fetch/                           # one module per source
│   │   ├── susr.py
│   │   ├── scitanie.py
│   │   ├── csu.py
│   │   ├── un_desa.py
│   │   ├── oecd.py
│   │   ├── eurostat.py
│   │   └── boundaries.py
│   ├── transform/                       # one module per output table
│   │   ├── section1_internal.py
│   │   ├── section2_corridor.py
│   │   ├── section3_diaspora.py
│   │   └── notable_people.py
│   ├── validate/                        # data quality checks
│   │   ├── schemas.py                   # pydantic models
│   │   ├── invariants.py                # cross-source sanity checks
│   │   └── report.py                    # generates HTML data-quality report
│   ├── run_all.py                       # the orchestrator
│   └── config.yaml                      # all URLs, paths, params
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── routes/
│   │   │   ├── Section1.tsx
│   │   │   ├── Section2.tsx
│   │   │   ├── Section3.tsx
│   │   │   └── Section4.tsx
│   │   ├── components/
│   │   │   ├── FilterBar.tsx            # the shared filter at top
│   │   │   ├── MapSK.tsx
│   │   │   ├── MapWorld.tsx
│   │   │   ├── Sankey.tsx
│   │   │   └── TimeSeries.tsx
│   │   ├── data/
│   │   │   └── duckdb-client.ts         # DuckDB-Wasm queries
│   │   └── content/
│   │       ├── notable_people.json
│   │       └── methodology.mdx
│   ├── public/
│   │   └── data/                        # symlink to ../data/processed
│   ├── package.json
│   └── vite.config.ts
├── feedback/
│   └── checkpoints.md                   # human-in-the-loop checkpoints
└── README.md
```

## Pipeline stages

### Stage 0: Setup and verification (Claude Code: confirm with Šimon)

Before writing any fetch code, the agent should:

1. **Read all five docs in order** — `01-research-architecture.md`, `02-data-manifest.md`, `03-methodology.md`, `04-spec.md` (this file), `05-design.md`.
2. **Confirm the tech stack choices** above. If Šimon prefers something else (Next.js? Astro? plain Vue?), adapt — but Vega-Lite is explicitly not coming back.
3. **Confirm storage location.** Default: relative to repo. Alternative: external `data/` directory if Šimon prefers to keep raw data outside git.
4. **Set up the repo skeleton** with empty modules and an honest README.
5. **Drop the design tokens into a real stylesheet** before any UI code — the `:root` CSS variables block from `05-design.md` becomes `frontend/src/styles/tokens.css`. Load the three fonts (Source Serif 4 + Pangram Sans + JetBrains Mono) and verify they render Slovak diacritics correctly with a single test page showing "ä č ď ô ľ ŕ š ť ž" in all weights.
6. **Run a "smoke test"** — fetch one small DataCube table end-to-end (try `om7102rr` for one year), and confirm the pipeline shape works before scaling up.

**Human checkpoint 0:** Show Šimon the smoke test output and the design-token test page. Wait for confirmation to proceed.

### Stage 1: Fetch (parallel, with manifest)

Each fetch module:
- Takes source URLs from `config.yaml`
- Writes raw output to `data/raw/<source>/`
- Writes a `_manifest.json` next to each file: source URL, fetch timestamp, content hash, byte size
- Is **idempotent** — re-running checks the manifest and skips if hash matches
- Logs to `pipeline/logs/fetch-{date}.log`

**Order of priority** (so that early failures don't block later ones):
1. Boundaries (small, fast, blocks visualisation prep)
2. UN DESA bilateral (small, blocks Section 3)
3. ŠÚ SR DataCube migration & population tables (largest single source)
4. Eurostat (medium)
5. IZ Bratislava LAU1 panel from Zenodo (one Zenodo download)
6. Census 2021 hyperkocky (large)
7. ČSÚ Foreigners publications (PDF extraction)
8. OECD DIOC (large, but only needed for education breakdowns)
9. Notable-people research (qualitative, partly manual)

**Human checkpoint 1:** After all fetches complete, show Šimon:
- Total bytes fetched
- Any failed sources with error messages
- A spot-check sample (5 random rows from 3 random tables)
- The `_manifest.json` files

### Stage 2: Transform

Each section's transform module reads from `data/raw/` and writes one parquet to `data/processed/`. Schemas are defined as Pydantic models in `pipeline/validate/schemas.py` and the writer validates every row.

**Output schemas:**

`section1_internal.parquet`:
```
year:           int16     # 2004..latest
geo_level:      enum      # 'kraj' | 'okres' | 'obec'
geo_code:       string    # NUTS/LAU code
geo_name:       string    # display name
age_bracket:    enum      # '0-14' | '15-19' | ... | '65+' | 'all'
sex:            enum      # 'M' | 'F' | 'all'
education:      enum      # 'isced_0-2' | 'isced_3-4' | 'isced_5-8' | 'all'
metric:         enum      # see below
value:          float64
is_interpolated: bool
source:         string
```
Metrics: `population`, `births`, `deaths`, `internal_in`, `internal_out`, `internal_net`, `intl_in`, `intl_out`, `intl_net`, `total_change`, `avg_wage_eur`, `unemployment_rate`, `tertiary_outbound_rate` (share of local 18-19 year olds enrolled at tertiary level abroad), `secondary_completion_rate`.

`section2_corridor.parquet`:
```
year:           int16
flow_direction: enum      # 'sk_to_cz' | 'cz_to_sk'
pathway:        enum      # 'student' | 'labour' | 'other' | 'all'
sk_geo_code:    string    # origin/destination on SK side
cz_geo_code:    string    # destination/origin on CZ side
age_bracket:    enum
sex:            enum
education:      enum
field_or_sector: string   # NACE letter for labour, ISCED-F field for student, 'all'
metric:         enum      # 'stock' | 'inflow' | 'students_enrolled' | 'students_graduated' | 'stay_rate' | 'wage_eur'
value:          float64
is_interpolated: bool
source:         string
```
The `pathway` dimension is critical — it lets the Section 2 visual switch between the student-pathway Sankey and the labour-pathway Sankey, and lets you join them via the stay-rate metric.

`section3_diaspora.parquet`:
```
year:           int16     # 1990..latest
slovak_def:     enum      # 'born' | 'citizen' | 'identified'
destination_iso3: string
sex:            enum
age_bracket:    enum
education:      enum
metric:         enum      # 'stock' | 'inflow' | 'emigration_rate'
value:          float64
is_interpolated: bool
source:         string
```

`notable_people.json`:
```json
[{
  "id": "karpathy",
  "name": "Andrej Karpathy",
  "name_sk": "Andrej Karpathy",
  "birth_year": 1986,
  "birth_place": "Bratislava",
  "left_year": 2001,
  "age_at_leaving": 15,
  "slovak_education_completed": "primary_only",
  "destination_path": ["Toronto, CA", "Vancouver, CA", "Stanford, US"],
  "current_location": "San Francisco, US",
  "field": "AI / machine learning",
  "trigger": "family migration",
  "narrative": "...",
  "impact": "...",
  "sources": ["wikipedia:Andrej_Karpathy", "..."],
  "photo_url": null
}]
```
The `slovak_education_completed` field — enum of `none` | `primary_only` | `secondary_only` | `tertiary` — lets the dashboard show the headline pattern that most high-impact emigrants left before completing Slovak tertiary education.

**Human checkpoint 2:** Show Šimon:
- A schema diagram of all four output files
- Row counts per file
- 10 random sample rows from each
- A list of any column where >5% of values are interpolated
- An honest "data confidence" rating per metric (e.g. "Slovak doctors abroad: low confidence; population: very high confidence")

### Stage 3: Validate

`pipeline/validate/invariants.py` runs cross-source sanity checks:

1. **Population consistency:** sum of okres populations should equal kraj population (within rounding); sum of kraj should equal SR total
2. **Migration accounting:** `population[t] = population[t-1] + births - deaths + intl_net + internal_net` should hold approximately
3. **Czech-Slovak corridor cross-check:** Slovaks in Czechia per ČSÚ should approximately equal Slovak emigrants to Czechia per ŠÚ SR (they won't match exactly; flag the discrepancy and quantify it — this IS one of the story's findings)
4. **UN DESA vs OECD DIOC for SK-born:** the two sources should be within ±15% of each other for the same year
5. **Eurostat vs ŠÚ SR:** SK national figures should match across both sources

Failures produce an HTML report in `pipeline/validate/report.html` with green/yellow/red severity. Yellow flags don't block; red flags require human decision.

**Human checkpoint 3:** Šimon reviews the data-quality report. Decides which discrepancies to feature in the methodology notes vs which need fixing.

### Stage 4: Frontend

The frontend is a SPA. DuckDB-Wasm queries the static parquet files. No backend.

**Routing:**
- `/` — landing page with summary stats and navigation
- `/internal` — Section 1
- `/corridor` — Section 2
- `/diaspora` — Section 3
- `/people` — Section 4
- `/methodology` — full sources and methodology audit trail (see `docs/06-sources-page.md` for the complete specification of this page — it is a first-class deliverable, not an afterthought)

**Shared filter bar (top of every interactive section):**
- Time range slider (start year — end year)
- Education level toggle (3 options)
- Age bracket select
- Slovak-definition toggle (Section 3 only)
- Net vs gross toggle
- Bratislava-included toggle (Section 1 only)

**Section 1 visualisation pattern:**
- Choropleth of Slovakia (Maplibre)
- Switchable geographic level (kraj → okres → obec on zoom)
- Animated through years with play/pause/scrub
- Click a region → side panel opens with:
  - Population trend chart
  - Net migration decomposition stacked bar
  - Top 5 destinations of leavers (Sankey snippet)
  - Wage and unemployment trend
- "Compare regions" mode: pick 2-3, side-by-side cards

**Section 2 visualisation pattern:**
- Two switchable Sankeys built with visx:
  - *Student view:* SK okres of origin → Czech university city → faculty/field
  - *Labour view:* SK okres of origin → CZ kraj of destination → sector (NACE)
- Stock line chart with wage-differential overlay, deck.gl arcs connecting SK and CZ on a small inset map
- Age pyramid of Slovaks in CZ (visx custom)
- University students sub-tab: bar chart by Czech university × year, stacked by faculty (visx)
- The bridge metric (stay-rate) visualised as a stream that "leaks" from the student sankey into the labour sankey

**Section 3 visualisation pattern:**
- World map (Maplibre with country boundaries) shaded by Slovak count
- Three-way toggle: born / citizen / identified
- Time slider 1990 → latest with play/pause
- Click country → side panel: trend chart, age & education breakdown if available, comparison with other definitions

**Section 4 visualisation pattern:**
- Vertical scrollable timeline (1860 → today)
- Each notable person rendered as a card pinned to their departure year, alternating left/right
- Card opens to full narrative on click
- Filter bar: by field (tech / science / arts / hockey / business), by destination region

**Performance budget:**
- Initial bundle < 500 KB gzipped
- Largest parquet file < 50 MB; load on demand per section
- Time-to-interactive < 3 seconds on average broadband

### Stage 5: Iteration

This is where most of the time goes. The agent should:

1. **Ship a "v0" within 1-2 sessions** — ugly but complete: all four sections render, filters wire up to data, no styling.
2. **Show Šimon the v0** — collect feedback on:
   - Which findings are surprising vs expected
   - Which visualisations work vs feel cluttered
   - Which filter combinations break or feel unhelpful
3. **Iterate in passes**, one section at a time, with explicit human-checkpoint gates.

## Feedback and verification loop

This is the core operating rhythm. After each stage above:

1. The agent writes a **checkpoint summary** to `feedback/checkpoints.md` with:
   - What was done
   - What it found (data findings, not just code completion)
   - What it's uncertain about
   - What it recommends doing next
   - 2-3 specific questions for Šimon

2. The agent **pauses** and explicitly asks Šimon to review the summary before proceeding.

3. After Šimon responds, the agent appends Šimon's decisions to the same checkpoints file and continues.

This file becomes the audit trail of every meaningful decision. If Šimon hands the project to another collaborator later, the checkpoints file tells the story.

**Sample checkpoint format:**
```markdown
## Checkpoint 1 — Data fetching complete
Date: 2026-MM-DD

### What I did
- Fetched 47 tables from DataCube (3.2 GB raw)
- Downloaded UN DESA 2024 bilateral matrix (8 MB)
- Skipped OECD DIOC 2020/21 because endpoint returned 404 — fallback to 2015/16

### Data findings
- Slovak population by okres 2004-2024 shows clear two-Slovakias pattern
- DataCube internal migration table `omXXXX` confirmed to exist with O-D matrix
- ČSÚ "Foreigners" PDF for 2024 has Slovak data split unevenly across tables 3.1 and 3.4

### Questions for you
1. The 2020/21 DIOC isn't published yet. Use 2015/16 with linear projection to 2024, or skip the DIOC dimension for Section 3 entirely?
2. The obec-level census 2021 data is 1.8 GB — too big for static hosting. Pre-aggregate to okres for default, allow obec drill-down via API?
3. Found 22 candidates for Section 4 longlist — review them now or after we have v0 of the data layer?

### Recommended next step
Proceed to Stage 2 (transform) using 2015/16 DIOC as the latest. Defer the Section 4 longlist review to after we have the world heatmap working.

### Your decision (Šimon to fill in)
[ ]
```

## Initial questions for Šimon to settle before deep work

Before the agent starts Stage 0, it should ask these:

1. **Repo location and Git workflow.** Where is the repo? Solo branch or PR workflow?
2. **Hosting target.** Vercel, Netlify, Cloudflare Pages, or self-hosted? (affects build config)
3. **Slovak vs English UI.** Bilingual, or English-only with Slovak source citations?
4. **Mobile responsive vs desktop-only.** Interactive maps work but degrade on small screens.
5. **License.** What license is the final published site under? (MIT? CC-BY-SA?)
6. **Notable-people scope.** Confirm the 10-card longlist after seeing the agent's initial suggestions; agree on inclusion/exclusion criteria.

## Risk register

The agent should track and surface these risks as work progresses:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ŠÚ SR DataCube table codes change | medium | medium | Cache fetched data; pin to specific snapshot; rebuild quarterly |
| ČSÚ PDF extraction fails on table structure | high | medium | Fallback to manual transcription of key tables only |
| OECD DIOC 2020/21 not published in time | medium | medium | Use 2015/16 as latest, mark clearly |
| Obec-level data too large for static hosting | medium | high | Pre-aggregate to okres for default; lazy-load obec |
| Notable-people inclusion is subjective | low | low | Document criteria explicitly; let Šimon make final calls |
| 2024 Census redesign breaks comparability | low | medium | Stick to 2011 and 2021 as anchor points |
| Maplibre obec polygon count slows rendering | medium | low | Simplify geometries to ~10m resolution; supercluster small obce |
| Slovak doctors abroad data is sparse | high | low | Position Section on healthcare as illustrative, not authoritative |
| Pangram Sans license cost | medium | low | Confirm cost upfront; if blocker, fall back to Inter Tight (still tested for Slovak diacritics); never fall back to plain Inter |
| Folk motif applications drift toward kitsch | medium | high | Strict adherence to `05-design.md` constraints (one motif type per page, opacity ≤8%, never decorative, never >280px); design-quality checkpoint at v0 |
| deck.gl WebGL performance on mid-tier mobile | medium | medium | Test early on real devices; provide simplified raster fallback for mobile if needed |

## Definition of done

The project is "v1 complete" when:

- [ ] All four sections render without errors with full datasets loaded
- [ ] Filter combinations have been tested for the cartesian product of common cases (e.g. each education level × each age bracket × each year)
- [ ] The `/methodology` page is complete per `docs/06-sources-page.md`: dataset register, metric derivation log, interpolation register, cross-source validation log, confidence grid, downloadable data, update log — all populated from the pipeline's `sources_report.json`
- [ ] Every chart and map on the site has an "About this data" button that opens the side panel with the relevant derivation and source entries
- [ ] Data-quality report shows no red flags or has explicit human-acknowledged justifications for each
- [ ] Each finding shown on the site has a citable source linked
- [ ] Šimon can describe the headline findings of each section in one sentence
- [ ] The site loads in under 5 seconds on a mid-tier mobile device
- [ ] A non-expert reader can navigate the four sections without a tutorial
- [ ] Slovak diacritics render correctly in all three fonts at all weights used (verify with the test page from Stage 0)

Beyond v1, future improvements (out of scope for initial spec):

- Comparison mode: Slovak brain drain alongside Bulgaria, Romania, Croatia
- Forecasting (would require an econometric model — explicit non-goal for now)
- API for researchers to query the data
- Mobile-first redesign of the maps

## Closing notes

The agent should default to honesty over polish. A messy chart with accurate data and clear caveats is better than a beautiful chart that misleads. When in doubt about a methodological choice, surface it as a human-checkpoint decision rather than picking silently.

The project has political and emotional weight — brain drain is a real loss for real communities, and the Slafkovský case shows it can become a personal story. Treat the subject matter with the seriousness it deserves; avoid clickbait framings or alarmist colouring on the maps.

Šimon owns the editorial voice. The agent owns the engineering and data fidelity. Both are accountable for the final product reflecting reality.

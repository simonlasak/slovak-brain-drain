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

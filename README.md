# Odchod / Departure

### An interactive case study of Slovak brain drain

A data-journalism site about emigration from Slovakia since EU accession in 2004: who the
official registers capture, who they miss, where people go, and how differently the same
diaspora looks depending on which definition you count.

The central problem the project is built around is that nobody knows how many Slovaks have
left. Slovak authorities recorded **64,855** departures between 2004 and 2025
(`registered_departures_2004_2025`). That is a floor, not a count: deregistering on
departure carries no penalty and no benefit, so it only counts people who filed. Read
against the registers of the 11 destination countries that counted Slovak citizens at both
ends of the period, the same window implies **222,321** departures against the **59,935**
Slovakia registered over it (`mirror_implied_departures_2004_2024`,
`mirror_registered_departures_2004_2024`, `mirror_panel_countries`). That second figure is
also a floor, because the panel omits the UK, Ireland, Spain, Switzerland and France.

The live URL is pending.

---

## What's inside

Four sections, plus a methodology page and a resources page.

**§1 `/internal` - Inside Slovakia**
A scroll-driven deck.gl choropleth of all 79 okresy, stepping through district population,
cohort retention, and total population change. Followed by four visx figures: a dot strip
of cohort retention across districts against the median of **88.6%**
(`cohort_retention_median`, defined as people aged 35-39 in 2024 over people aged 15-19 in
2004 in the same district), average gross monthly wage by kraj, ranked district population
change, and regional population trends indexed to 2004.

**§2 `/corridor` - The Czech corridor**
A choropleth of the 14 Czech kraje that advances one year per scroll step from 2015 to
2025. Then three co-plotted series for the same corridor on different definitions:
**125,280** Slovak citizens resident in Czechia in 2025 (`slovaks_in_cz_residents_2025`),
**241,428** Slovaks in the Czech labour market in 2024, which is larger because it counts
employment relationships including cross-border commuters
(`slovaks_in_cz_labour_2024`), and tertiary students enrolled. A breakdown of those
students by ISCED level follows, and a single stay-or-leave bar from a DZS 2023 survey,
which is the one figure in the section that comes from a survey rather than a register.

**§3 `/diaspora` - Global diaspora**
Not scrollytelling. A Europe-focused equal-area map with proportional discs, plus a world
locator for the tail, covering the **51** destinations reporting a Slovak-born stock in the
2020 UN DESA revision (`diaspora_destinations_un_desa_2020`). Clicking a destination opens
a readout with its value and its definitional caveats. Then ranked destinations shown twice,
by 2020 stock and by change since 1990; a log-axis dumbbell comparing Slovak-born against
Slovak-citizen counts for the **25** destinations that report both (`def_panel_countries`);
and annual arrivals into Germany, Czechia and Austria.

**§4 `/people` - Notable departures**
Nine hand-picked Slovak-born individuals who left after 1993, one of whom returned. A strip
plot of age at leaving, coloured by whether tertiary education was completed in Slovakia;
clicking a point opens that person's card on a timeline ordered by departure year. Each card
carries its own sources. An always-open note explains how the list was assembled and why it
is not a sample.

**`/methodology`** documents the sources, the registration gap, the cohort-retention
derivation and its sensitivity, and the known discrepancies between sources.
**`/resources`** covers diaspora networks and Slovak companies built at home.

---

## Data

Sources that feed a rendered figure:

| Source | Used for |
|---|---|
| ŠÚ SR DATAcube (`om7011rr`, `om7007rr`, `np3112qr`, `pr0204qs`) | §1 migration, population, cohort retention, wages |
| ČSÚ Foreigners in the Czech Republic (`CIZ002T002`, `CIZ003T003`, `CIZ004T002`, `CIZ03`) | §2 residents and labour market |
| Eurostat `educ_uoe_mobs02` | §2 students in Czechia |
| Eurostat `migr_pop1ctz` | §3 Slovak-citizen stock, mirror comparison |
| UN DESA International Migrant Stock, **2020 revision**, bilateral table | §3 Slovak-born stock |
| OECD international migration (`B11`, `B12`, `B16`, `mig_popf`) | §3 annual arrivals |

That is 4 ŠÚ SR cubes, 4 ČSÚ tables and 4 OECD extracts (`susr_cubes_used`,
`csu_tables_used`, `oecd_datasets_used`). Eurostat `migr_emi1ctz` is fetched for validation
only. Fetchers also exist for the 2021 census, the IZ Bratislava unemployment panel and the
US Census, but none of those currently feed a rendered figure.

The three processed Parquet files the site queries are committed to the repo under
`frontend/public/data/`, so the site builds and runs without re-running the pipeline, and
`/methodology` links each one for download with its size and contents. Raw sources are not
redistributed here and carry their own terms.

---

## How the numbers are checked

This is the part of the project worth reading the code for.

A five-gate audit found that several plausible-looking published figures were wrong, and
wrong in a way that ordinary spot-checking could not catch, because each was reproducible
from the same wrong filter that produced it. The landing page once showed a number that had
started life as an illustrative placeholder in a spec document and ended up as a hardcoded
character array in a React component. Two district-level migration metrics turned out not
to tile: summed over sub-national units they counted moves between Slovak districts as
international departures, and the sums were large enough to look plausible. A national
average wage was a first-quarter figure labelled as annual.

Three things changed as a result:

- **Tiling invariants that fail rather than render.** `pipeline/validate/invariants.py`
  holds nine cross-source checks, including `check_geo_levels_tile`, which asserts that a
  metric's sub-national sums reconcile with its national total. The rule it encodes is that
  an assertion which cannot fail is not a check: each one ties a metric to a different
  indicator, a different geographic level, or a different publisher. The §1 and §3
  transforms also refuse to write output if a rendered metric is missing, and unmapped
  geographic codes log and drop or raise, never pass through silently.
- **Headline figures are derived, not typed.** `pipeline/analysis/headline_figures.py`
  queries the processed Parquet and writes `frontend/src/data/headline_figures.json`. Every
  entry carries the SQL that produced it plus a note on what the number does and does not
  mean. The landing page and the methodology page import that file at build time, so a
  headline figure on either page cannot be a number someone typed. The landing hero goes
  further and re-runs its own query in the browser at mount, using the build-time figure
  only as a fallback while WASM loads.
- **Definitions are shown, not resolved.** Where two sources disagree because they count
  different things, the site shows both side by side rather than picking one. That is the
  organising idea of §2's three series and §3's dumbbell.

Every figure quoted in this README names the `headline_figures.json` key it came from.

---

## What this data cannot tell you

- **The Slovak emigration figure is a floor.** Emigration is recorded by municipal
  deregistration, which is unenforced. Most people who leave never file.
- **Sub-national migration series do not measure international migration.** At kraj or
  okres level the outflow metrics count moves out of the unit, including moves to other
  Slovak districts. Net migration is identical at every geographic level precisely because
  internal moves cancel, which is what shows it is not an international quantity.
- **UN DESA reference years are modelled, not counted.** Per the 2020 revision methodology
  report, all seven reference years are interpolated or extrapolated. Absolute levels
  survive with that caveat.
- **The diaspora cannot be counted on one definition.** UN DESA measures Czechia by
  citizenship and the other 50 destinations by place of birth, so the largest figure sits on
  a different definition from the rest. The United States is absent from UN DESA's Slovak
  origin rows entirely.
- **There is no field-of-study dimension for emigrants in any source.** No source used here
  carries subject of study for people who left, so no such breakdown exists on the site.
- **§4 is nine people, not a sample.** They were selected, not drawn. Nothing in that
  section supports a population inference.
- **§2's flow and stock accounting does not close.** The ČSÚ and OECD series are not a
  matched pair, so the site does not publish a persistence or return rate across them.

---

## Language

There is a SK/EN toggle in the nav. **Slovak is currently a stub.** Every Slovak content
bundle is a spread of the English one, marked `reviewed: false`, and each of the four
sections renders a visible notice when SK is selected saying the Slovak translation is in
preparation and English is being shown. Slovak authoring is deliberately deferred to a
single pass at the end rather than machine-translated section by section. Only the nav
labels are genuinely translated today.

---

## Running locally

Requires **Node 22** (Astro 6 needs Node 20.19+ or 22+). See `frontend/.nvmrc`.

```bash
git clone https://github.com/simonlasak/slovak-brain-drain.git
cd slovak-brain-drain/frontend
npm install     # frontend/.npmrc sets legacy-peer-deps: visx declares a peer
                # React <=18 and this project runs 19
npm run dev     # npm run dev:lan to expose on the LAN
```

The processed Parquet files are committed, so this is all you need to run the site.

### Re-running the pipeline (optional)

Python 3.9 or newer. There is no requirements file checked in; the pipeline needs `duckdb`,
`httpx`, `polars`, `pydantic`, `pyyaml` and `rich`. Copy `.env.example` to `.env` if you want
the US Census fetch, which needs a free API key. Every stage runs as a module from the repo
root:

```bash
python -m pipeline.run_smoke                    # one small cube, end to end
python -m pipeline.run_stage1                   # fetch all sources
python -m pipeline.transform.section1           # also section2, section3,
                                                # boundaries_world, diaspora_names
python -m pipeline.validate.invariants          # writes pipeline/validate/report.html
python -m pipeline.analysis.mirror_comparison
python -m pipeline.analysis.headline_figures    # regenerates headline_figures.json
```

`invariants.py` reads `data/processed/`, while the site serves from
`frontend/public/data/`, so copy the Parquet files across before running it.

---

## Tech

**Pipeline:** Python, httpx, Polars, DuckDB, Pydantic

**Frontend:** Astro 6 (static output) with React islands, TypeScript, visx for charts,
deck.gl and MapLibre GL for the §1 and §2 choropleths, d3-geo for the §3 projections,
DuckDB-WASM querying Parquet directly in the browser

**Hosting:** Cloudflare Pages, static, no backend

---

## Deployment

Static build on Cloudflare Pages. In the Pages project settings, root directory `frontend`,
build command `npm run build`, output directory `dist` (the output path is relative to the
root directory). Cache headers are set in `frontend/public/_headers`: hashed Astro assets are
immutable, and the Parquet and GeoJSON files revalidate hourly because the pipeline rewrites
them under the same names.

The WASM binary DuckDB needs is 34 MiB, which exceeds Cloudflare's 25 MiB per-file upload
limit, so it is fetched from jsDelivr at the version `package-lock.json` pins rather than
served from `public/`. `docs/08-deployment.md` records the full reasoning, the GitHub Pages
comparison, and the post-deploy verification steps.

---

## License

Code: [MIT](LICENSE)

Processed data outputs: [CC BY 4.0](LICENSE-DATA). Cite this project and you can use them
freely. The underlying raw sources carry their own open licenses and are not redistributed
here.

---

## Author

Šimon Lasák, CS student, University College Dublin

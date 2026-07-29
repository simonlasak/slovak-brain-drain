# Sources & Methodology Page Specification

> **Numeric claim convention.** Every numeric figure in this document carries a
> status marker: `verified` (reproducible, source named), `unverified` (plausible
> but not reproduced here), or `illustrative` (a placeholder showing format, NOT
> a measurement). **A figure with no marker is unusable.** Introduced July 2026
> after an illustrative 300,000 in `07-editorial-content.md` escaped into the
> landing page as fact.


## Purpose

The `/methodology` page is the audit trail for the entire project. Its job is to let any reader — a journalist, a researcher, a Slovak government official, another student — trace every number shown on the site back to a primary source. It is also where we are honest about what we do not know and what we had to estimate.

This page is not an afterthought. It is a core deliverable. Every chart and map on the site links directly to the relevant section of this page.

The page is partially auto-generated from the pipeline's `manifest.json` files and partially manually authored for the methodological choices that can't be captured in metadata. The pipeline's `validate/report.py` module produces the machine-readable input; this spec defines what the human-readable page looks like.

---

## Page structure

### 0. Introduction (hand-authored)

Two short paragraphs:

1. What data exists and what doesn't — the honest top-line: Slovak emigration is systematically undercounted by Slovak official sources because most movers don't deregister; this site triangulates across multiple sources and flags where that triangulation produces discrepancies.

2. How to interpret the confidence ratings — four levels: High (multiple independent sources agree), Medium (single reliable source, spot-checked), Low (one source, no cross-check, flagged), Estimated (derived from neighbouring data points by interpolation, formula shown).

---

### 1. Dataset register

One row per dataset used anywhere on the site. Auto-generated from `data/processed/manifest.json` which the pipeline writes and updates on every fetch run.

**Columns:**

| Field | Description |
|---|---|
| Dataset name | Human-readable name |
| Provider | The organisation that published it |
| URL | Direct link to the data portal, publication, or API endpoint |
| Date first accessed | When the pipeline first fetched it |
| Date last refreshed | When the pipeline last fetched it (updates on every pipeline run) |
| License | SPDX identifier or prose description |
| Sections used | Which site sections (§1, §2, §3, §4) use it |
| Metrics derived | Which named metrics in the output schema come from this source |
| Format | CSV, Excel, PDF, JSON-stat, API |
| Confidence | High / Medium / Low |
| Notes | Caveats, known limitations, known gaps |

**Render:** Sortable, filterable table (TanStack Table). Columns sortable by confidence, section, and provider. Filter by section chip (§1 / §2 / §3 / §4 / All). Each row expandable to show the full notes field.

**The datasets to list** (seed from `02-data-manifest.md`, populated by the pipeline at runtime):

1. ŠÚ SR DataCube — Population & migration tables
2. ŠÚ SR DataCube — Wage & labour tables
3. Sčítanie 2021 (Census) — Educational attainment by obec
4. ŠÚ SR "Zahraničné sťahovanie" annual publication (PDF)
5. IZ Bratislava LAU1 unemployment panel (Zenodo)
6. Slovak Medical Chamber AEMH 2025 national report (PDF)
7. ČSÚ "Foreigners in the Czech Republic" annual publication
8. ČSÚ 2021 Census — Slovak nationals cut
9. Czech MŠMT / DZS — Slovak students in Czech universities
10. UN DESA International Migrant Stock 2024
11. OECD DIOC (reference year 2015/16 or latest available)
12. OECD International Migration Database — annual flows
13. Eurostat — migr_pop1ctz, migr_pop3ctb, migr_emi1ctz
14. Eurostat — educ_uoe_mobs02, educ_uoe_mobg01
15. Eurostat — lfst_r_lfu3rt (regional unemployment), nama_10r_3gdp
16. World Bank Global Bilateral Migration Database
17. Slovak Geoportal ZBGIS — administrative boundaries
18. OpenStreetMap / Natural Earth — world country boundaries
19. Institute of Educational Policy (IVP) — outbound mobility estimates
20. Notable people: individual Wikipedia articles, press interviews (listed per card in §4)

---

### 2. Metric derivation log

One entry per named metric that appears anywhere on the site. This makes every computed number auditable.

**Format per entry:**

```
Metric name:         tertiary_outbound_rate
Definition:          Share of local 18–19 year olds enrolled in tertiary education abroad
                     in a given year, as a fraction of total 18–19 year olds in that okres
Formula:             Slovaks enrolled abroad in [year] from [okres] ÷ total population
                     aged 18–19 in [okres] in [year]
Numerator source:    Eurostat educ_uoe_mobs02 (destination-side enrolment, disaggregated
                     by Slovak origin) — limited to EU destinations
                     Czech MŠMT/DZS for CZ specifically
Denominator source:  ŠÚ SR DataCube om7007rr — population by age group by okres
Aggregation:         District of origin estimated from Census 2021 distribution (obec
                     of origin data not available from Eurostat); treated as constant
                     shares across years
Confidence:          Low — numerator is an undercount (non-EU destinations not covered;
                     students who don't register as foreign nationals in CZ are missed)
Interpolated:        No (annual)
Sections:            §1
```

**Render:** Accordion list grouped by section (§1 Metrics, §2 Metrics, §3 Metrics). Expandable per metric. Linked to from each chart's "About this data" button.

**Named metrics to document** (derived from `04-spec.md` output schema, expand as pipeline runs):

Section 1: `population`, `births`, `deaths`, `internal_in`, `internal_out`, `internal_net`, `intl_in`, `intl_out`, `intl_net`, `total_change`, `avg_wage_eur`, `unemployment_rate`, `tertiary_outbound_rate`

Section 2: `stock` (Slovaks in CZ), `inflow`, `students_enrolled`, `students_graduated`, `stay_rate`, `wage_eur`

Section 3: `stock` (diaspora per country), `emigration_rate`

---

### 3. Interpolation register

Every data point in the processed files that is estimated rather than directly observed, listed explicitly. Auto-generated from the `is_interpolated = true` rows in the parquet files, grouped by metric and time range.

**Format:**

> **ILLUSTRATIVE TEMPLATE.** `illustrative` The ±3%, ±15% and ±5% figures below
> are placeholders showing entry shape. No interpolation register has been built,
> and as of July 2026 `is_interpolated` was hardcoded and computed nowhere, so
> there are no measured uncertainties to report.

```
Metric:          population (obec-level, 18–24 age group)
Period:          2012–2020
Geography:       All municipalities (count `unresolved`, see 01-research-architecture.md)
Method:          Linear interpolation between Census 2011 and Census 2021
Anchor points:   2011-04-01 (Census 2011) and 2021-01-01 (Census 2021)
Cross-checked:   Against Eurostat lfst_r_lfu3rt regional aggregates
                 — passes within ±3% at kraj level
Uncertainty:     Municipalities with high internal migration may be off by ±15%;
                 stable rural municipalities within ±5%
Flagged in UI:   Hollow data markers; "est." suffix on axis labels
```

**Render:** Table with columns: Metric, Period, Geography scope, Method, Anchor points, Cross-check, Max uncertainty. Sortable. Downloadable as CSV.

---

### 4. Cross-source validation log

Where two independent sources measure the same thing and we compare them. This is the honest accounting of the discrepancies that section 2.3.6 of `03-methodology.md` flags.

**Format per entry:**

> **ILLUSTRATIVE TEMPLATE, NOT A FINDING.** The figures below show the shape of
> an entry. They are not measured values. The "23-38%" in particular was read as
> a documented result during the July 2026 audit and is not one: see the note
> after this block.

```
What was compared:   Slovaks registered as leaving Slovakia (ŠÚ SR) vs
                     Slovaks registered as arriving in Czechia (ČSÚ)
Period:              2004–2023
Expected direction:  ČSÚ > ŠÚ SR because not all movers deregister in SK
Observed discrepancy: [illustrative] ČSÚ stock is NN% higher than ŠÚ SR
                      cumulative outflow in [year].
Decision:            Display ČSÚ figure as primary stock estimate.
                     Show ŠÚ SR figure as a "formally registered" sub-series.
                     Difference displayed as the "unregistered/commuter" estimate.
UI treatment:        The two lines are shown together in §2 with the gap
                     shaded and labelled "estimated unregistered movers"
```

**Status: this comparison is NOT DERIVABLE and must not be published.** `unverified`

It requires ŠÚ SR emigration disaggregated by destination country. No such series
exists: all 668 datasets in the ŠÚ SR DATAcube API were checked (July 2026) and
none carries an emigration-by-destination dimension. `om7001rr` has 258 countries
but is country of *birth* for residents of Slovakia, an immigrant-stock cube, not
emigrant destinations. Comparing ČSÚ stock against cumulative outflow to *all*
destinations gives the opposite sign (ČSÚ runs 28-47% below it), which is not a
like-for-like comparison and should not be substituted.

A defensible mirror comparison does exist on the **citizen** definition, using
Eurostat `migr_pop1ctz` (destination-reported Slovak citizens) against ŠÚ SR
cumulative registered outflow. Feasibility confirmed July 2026: 25 reporting
countries for 2020 totalling 297,234, Germany included. Not yet implemented.

**Cases to document** (at minimum):

1. Slovak registration vs Czech registration (as above)
2. UN DESA vs OECD DIOC for Slovak-born abroad — total stock comparison for 2015
3. Eurostat educ_uoe_mobs02 vs Czech MŠMT/DZS for Slovak students in CZ
4. ŠÚ SR wage data vs ČSÚ wage data for the Czech-Slovak wage comparison
5. AEMH 2025 doctor counts vs SLK registry-based estimates (where available)
6. IVP outbound student estimates vs Eurostat mobile-student counts

---

### 5. Confidence summary

A visual "health map" of the entire data layer — one cell per metric per section, coloured by confidence level. Shows at a glance where the site is on solid ground and where it's estimating.

**Render:** Grid/heatmap table. Rows = metrics. Columns = sections (§1, §2, §3). Colour: green = High, amber = Medium, red = Low, striped = Estimated.

**Intent:** Forces the team to be honest about where data is thin before publishing, and gives readers a single scannable view of the site's epistemic standing.

---

### 6. Downloadable data

All processed output files available for direct download. Data re-use is encouraged.

**Files to offer:**

| File | Description | Format |
|---|---|---|
| `section1_internal.parquet` | Internal Slovak migration, population, wages, unemployment by district | Parquet |
| `section1_internal.csv` | Same in CSV | CSV |
| `section2_corridor.parquet` | Slovak-Czech migration flows, student data, wage differential | Parquet |
| `section2_corridor.csv` | Same in CSV | CSV |
| `section3_diaspora.parquet` | Global Slovak diaspora estimates 1990–latest | Parquet |
| `section3_diaspora.csv` | Same in CSV | CSV |
| `notable_people.json` | Notable-people card data | JSON |
| `manifest.json` | Full pipeline manifest: fetch dates, file hashes, row counts | JSON |

Each file shows: description, last updated date, row count, file size, license (CC-BY 4.0 for the derived output).

**License note:** The processed outputs are CC-BY 4.0 — cite this project and you can use the data. The underlying raw sources have their own licenses (mostly open, some CC-BY). The raw data itself is not redistributed; only the processed derivations.

---

### 7. Update log

A reverse-chronological list of when the pipeline was last run, what changed, and whether any methodology changed.

**Format:**

```
2026-05-23 | Initial data fetch. All Tier 1-3 sources fetched.
            | Notable exceptions: OECD DIOC 2020/21 not yet published;
            |   using 2015/16 as latest. Interpolated 2016–2023 linearly.
            | ČSÚ Foreigners 2024 PDF extraction succeeded for tables 3.1, 3.4.
            |   Table 3.2 failed — manually transcribed from page 47.

2026-MM-DD | [next run, auto-generated by pipeline]
```

---

## Implementation notes for the pipeline

The pipeline's `validate/report.py` module must produce a machine-readable `data/processed/sources_report.json` that the frontend reads to populate the dataset register and the interpolation register. This JSON has the schema:

```json
{
  "generated_at": "2026-05-23T14:00:00Z",
  "pipeline_version": "0.1.0",
  "datasets": [
    {
      "id": "susr_datacube_population",
      "name": "ŠÚ SR DataCube — Population & migration",
      "provider": "Štatistický úrad SR",
      "url": "https://data.statistics.sk/api/v2/...",
      "first_fetched": "2026-05-23T10:00:00Z",
      "last_fetched": "2026-05-23T10:00:00Z",
      "license": "CC-BY-4.0",
      "sections": ["s1"],
      "metrics": ["population", "births", "deaths", "internal_in", "internal_out"],
      "confidence": "high",
      "notes": "..."
    }
  ],
  "interpolations": [
    {
      "metric": "population",
      "geo_level": "obec",
      "period_start": "2012-01-01",
      "period_end": "2020-12-31",
      "method": "linear",
      "anchor_points": ["2011-04-01", "2021-01-01"],
      "row_count": 52248,
      "max_uncertainty_pct": 15
    }
  ],
  "cross_validations": [
    {
      "id": "sk_cz_registration_gap",
      "description": "ŠÚ SR outflow vs ČSÚ inflow comparison",
      "sources": ["susr_zahranicne_stahovanje", "csu_foreigners"],
      "result": "pass_with_known_discrepancy",
      "discrepancy_pct": 31,
      "decision": "Use ČSÚ as primary; display gap as unregistered estimate"
    }
  ],
  "confidence_grid": {
    "population_s1": "high",
    "tertiary_outbound_rate_s1": "low",
    "stock_s2": "high",
    "stay_rate_s2": "estimated"
  }
}
```

The frontend reads this JSON and renders the methodology page dynamically. The `manifest.json` files per raw file feed into the `datasets` array. The `is_interpolated` column in each parquet feeds the `interpolations` array.

---

## Linking from charts

Every chart and map on the site (§1, §2, §3) has an "About this data" button in its bottom-right corner. Clicking it opens a side panel (not a modal — no full-screen takeover) showing:

1. The metric derivation log entry for the primary metric being shown
2. The dataset register rows for the sources that feed it
3. Any interpolation register entries for the current filter selection
4. A direct link to `/methodology#metric-name` for the full page view

This panel should be dismissible with Escape or a close button, and should not scroll the main page when open.

---

## Tone

The methodology page is written plainly, not defensively. It is not marketing copy for the project. Where the data is thin, say so. Where two sources disagree, name both and explain the decision. Where an estimate is rough, say it's rough and give the uncertainty range.

The audience for this page includes people who will be critical of the project — academics, journalists, Slovak government statisticians. Write for them.

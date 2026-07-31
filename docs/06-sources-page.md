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

2. How to interpret the confidence ratings — four levels: High (multiple sources agree AND they do not share an upstream compiler), Medium (single reliable source, spot-checked), Low (one source, no cross-check, flagged), Estimated (derived from neighbouring data points by interpolation, formula shown).

> **Independence is not the same as being two datasets.** UN DESA, Eurostat and
> OECD all compile from the same national statistical offices. Two of them
> agreeing about Slovaks in Germany is one German register reported twice, not
> corroboration. The same applies to Eurostat `migr_emi1ctz` against ŠÚ SR: that
> series IS ŠÚ SR's own filing. Before calling anything "High", name the
> collecting authority on each side and check they differ.

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

Where two sources measure the same thing and we compare them. This is the honest
accounting of the discrepancies that section 2.3.6 of `03-methodology.md` flags.

Note that most pairs here are NOT independent: they share the national statistical
office that collected the data. A comparison between them tests our handling and
each compiler's adjustments, not the underlying measurement. The one genuinely
independent axis in this project is Slovak self-reporting against
destination-state reporting, which is what the mirror comparison in 4a uses.

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
cumulative registered outflow. **It is now implemented: see "The mirror
comparison" below.**

---

### 4a. The mirror comparison (implemented, reproducible)

**Code:** `pipeline/analysis/mirror_comparison.py`
**Run:** `PYTHONPATH=. .venv/bin/python -m pipeline.analysis.mirror_comparison`
**Output:** `data/processed/mirror_comparison.json` (every figure below, per country)

Takes about two minutes: it parses two 10 MB Eurostat bulk TSVs row by row.

> **This is the only evidence the site offers for the size of the registration
> gap.** A second line was sought and rejected: Slovakia's census residuals
> (-42,827 in 2011, -10,511 in 2021, total 53,338) look like a Slovak-only lower
> bound on unrecorded emigration and share no source with this comparison, but
> they are not decomposable into emigration versus enumeration error, and the two
> rounds behave inconsistently. Evaluated July 2026 and dropped rather than
> softened; the reasoning is in "Census residuals" below so the decision is on
> the record. If a decomposition is ever published, revisit it.

#### The question

Slovakia records emigration through municipal deregistration, which carries no
penalty for skipping and no benefit for doing. Destination countries have the
opposite incentive structure: residence registration gates healthcare, tax status
and employment. Comparing the two registers bounds how much Slovak registration
misses.

#### The formula

```
implied departures = rise in destination-reported Slovak citizens
                   + Slovaks naturalising in those countries
```

The naturalisation term is not optional. A Slovak who takes German citizenship
leaves the German count of Slovak citizens without leaving Germany, so omitting
it understates arrivals by exactly the number who naturalised.

#### The panel

15 countries, every one reporting Slovak citizens for the whole window with no
gaps: **AT BE CZ DE FI HU IS IT LT LV NL NO RO SE SI**.

Deliberately excluded, with reasons: **GB** (no post-Brexit Eurostat citizenship
data, and the single biggest omission), **IE** (series too sparse for clean
endpoints), **ES** (reports country of birth more completely than citizenship),
**CH** (non-EU reporting, gaps in the Slovak breakdown), **FR** (Slovak
breakdown not published for the full window).

#### Period alignment, which is where the earlier attempt went wrong

`migr_pop1ctz` stock is dated **1 January**. A stock at 1 Jan 2013 reflects
arrivals through 2012, so the change from 1 Jan 2013 to 1 Jan 2025 was produced
by the **calendar years 2013 to 2024**. Naturalisation flows and ŠÚ SR departure
flows must use that same 2013-2024 window, or the comparison divides quantities
measured over different periods.

#### Result `verified`

| Quantity | Value |
|---|---|
| Slovak citizens reported by the panel, 1 Jan 2013 | 175,880 |
| Slovak citizens reported by the panel, 1 Jan 2025 | 271,348 |
| Rise in reported stock | 95,468 |
| Plus Slovaks naturalising in the panel, 2013-2024 | 19,422 |
| **Implied departures** | **114,890** |
| **ŠÚ SR registered departures, 2013-2024** | **43,471** |
| **Ratio** | **2.64x** |

#### The accession-window panel, 2004 to 2025

The site's landing page counts registered departures over 2004-2025, so the
comparison is also run over that window. The widest panel whose members report
Slovak citizens at **both** endpoints is 11 countries: **AT CZ DE FI HU IT LV NL
NO SE SI**. Four of the 15 above drop out for having no 2004 observation (BE, IS,
LT, RO), but all three largest destinations survive.

Requiring both endpoints rather than every intervening year is the correct
condition here, because the quantity is a stock **difference**: only the
endpoints enter it. Germany is missing 2011 and Austria 2010-2011, neither of
which touches an endpoint.

| Quantity | Value |
|---|---|
| Slovak citizens reported by the panel, 1 Jan 2004 | 70,056 |
| Slovak citizens reported by the panel, 1 Jan 2025 | 262,301 |
| Rise in reported stock | 192,245 |
| Plus Slovaks naturalising in the panel, 2004-2024 | 30,076 |
| **Implied departures** | **222,321** |
| **ŠÚ SR registered departures, 2004-2024** | **59,935** |
| **Ratio** | **3.71x** |

**On the 59,935 against the hero's 64,855.** Both are correct and they reconcile
exactly: 59,935 + 4,920 (2025 alone) = 64,855. The mirror comparison must stop
its flow window at 2024 because a stock dated 1 January 2025 only reflects
arrivals through 2024. The hero states the full 2004-2025 registered total; the
mirror states the part of it that the destination endpoints can speak to.

#### Seven specifications

Each varies one judgement a reader could reasonably have made differently.

| Specification | Ratio | Implied | Registered |
|---|---|---|---|
| Accession window, 11 countries, 2004-2024 | **3.71x** | 222,321 | 59,935 |
| Accession window, excluding Czechia | 2.15x | 128,866 | 59,935 |
| Headline, 15 countries, 2013-2024 | **2.64x** | 114,890 | 43,471 |
| Top five destinations only | 2.30x | 100,180 | 43,471 |
| Shorter window, stock 2015-2023 | 2.28x | 63,952 | 28,110 |
| No naturalisation adjustment | 2.20x | 95,468 | 43,471 |
| 2013 window, excluding Czechia | **1.84x** | 79,827 | 43,471 |

**Range: 1.84x to 3.71x.**

#### Reading the Czechia-excluded rows

Czechia is by far the largest single destination: about 43% of the panel's stock
rise on the 2004 window. Removing it takes the ratio to 2.15x on the accession
window and 1.84x on the 2013 window.

**These are sensitivity checks on the largest destination, not rival estimates.**
Nobody argues Slovaks in Czechia should be excluded from a count of Slovaks who
left Slovakia; they are there, and Czech registration counts them. The rows exist
to answer a narrower question: is the finding an artefact of one country's
reporting? It is not. The gap persists at roughly 2x with the largest destination
removed entirely, which is the point of running the check.

The lowest row, 1.84x, is therefore the most conservative reading available and
not the best estimate. Even it says destination registers imply nearly twice the
registered figure.

#### The 2021 census re-basing sits inside this window, and it depresses the result

Every specification above spans 2021, and 2021 is not an ordinary year in this
panel. Both Slovakia and Czechia held censuses in spring 2021, and several other
reporting countries re-based population registers in the same round. The panel's
reported stock of Slovak citizens fell by **18,271** between 1 January 2020 and 1
January 2021, in a series that rose by roughly 8,700 in each adjacent year.

The fall is almost entirely Czech: Czechia alone accounts for **-25,952** of it,
partly offset by ordinary growth elsewhere. Read naively as a year of migration,
calendar 2020 contributes **-17,050** implied departures. A negative year is not
behaviour; it is a register being corrected.

This matters for the direction of the error, because the re-basing removes people
from the *end-of-period* stock who arrived *during* the period. It therefore
subtracts real arrivals from the numerator:

| | Implied | Registered | Ratio |
|---|---|---|---|
| Headline, spanning the re-basing | 222,321 | 59,935 | **3.71x** |
| Splicing out the affected transition | 239,371 | 57,507 | **4.16x** |

The spliced version sums two clean segments (1 Jan 2004 to 1 Jan 2020, and 1 Jan
2021 to 1 Jan 2025), dropping the single transition that straddles the census.

**Including 2021 costs 0.45 on the ratio, so the published 3.71x is conservative
on this axis too.** The headline deliberately keeps the re-basing in, because
splicing requires a judgement about which transition to drop, and a reader can
check an unspliced figure against the raw series. But the direction of the bias
should be stated rather than left implicit: correcting for it moves the estimate
up, not down.

This is the same event described in §2's Czech-corridor prose, where the Slovak
residence line falls 8% in 2021 while the Czech labour register rises. It is one
administrative event with consequences in three places: Slovakia's own population
series, Czechia's foreigner register, and this comparison.

#### Census residuals as a second line of evidence: tested and REJECTED

Slovakia's register exceeded its census count by 42,827 in 2011 and by 10,511 in
2021, a total of 53,338. Since a register accumulates people who left without
deregistering, and a census is the moment that gets corrected, this looked like it
could be a Slovak-only lower bound on the deregistration gap, sharing no source
with the mirror comparison. It cannot serve that purpose, for three reasons.

**It is not decomposable.** A census residual is `register count - census count`
and jointly absorbs at least five things: emigrants who never deregistered
(the quantity wanted), census undercount, late or missing vital registration,
duplicate and stale addresses, and any change in the definition of usual
residence between rounds. Nothing we hold splits them, and ŠÚ SR publishes no
decomposition.

**The two residuals behave inconsistently.** Measured against registered
departures in each preceding intercensal period, the 2011 residual is 3.4x the
registered flow and the 2021 residual is 0.4x. That is a factor of eight apart. If
both were chiefly unrecorded emigration they should bear a similar relation to the
recorded flow; they do not, which suggests the dominant component differs between
the two rounds.

**The 2021 census is not an independent observer of the register.** It was
conducted principally from administrative registers with online self-enumeration,
so its residual partly reflects register reconciliation rather than a fresh count
of people on the ground.

For the record, the magnitude is not absurd: 53,338 against the mirror's implied
gap of 162,386 over a comparable span. But agreement in order of magnitude between
one measured quantity and one undecomposable residual is not corroboration, and
presenting it as a second line of evidence would overstate what it is. **Dropped
rather than softened.** The hero rests on the mirror comparison alone.

#### Why every figure here is a floor

The panel omits the UK, Ireland, Spain, Switzerland and France, while the ŠÚ SR
denominator counts departures to **all** destinations. Missing destinations in
the numerator with none missing from the denominator biases the ratio **down**.
Two further effects push the same way: a rise in reported stock nets out deaths
and onward moves, both of which reduce the implied figure.

#### What it is not

Not a count of Slovaks abroad. Not a net migration figure. It measures one thing:
the gap between two registers, on the citizen definition.

#### Why the destination side is genuinely independent, and Eurostat's SK series is not

This distinction is easy to get wrong, and the project got it wrong once already.

**Eurostat is not a second observer of Slovak emigration.** It does not collect
migration data; member states file it. `migr_emi1ctz` for `geo=SK` is ŠÚ SR's own
IN010079, redistributed. Our national series matches it to the person for every
year 2004-2024, and that match proves only that we parsed the cube the way ŠÚ SR
filed it. It inherits the identical deregistration undercount, so it cannot
corroborate the level. Treating it as agreement between two sources would be
counting one source twice.

**The destination side is different in kind.** `migr_pop1ctz` for `geo=DE` is
Germany reporting Slovak citizens on German territory, from a German register,
under German registration incentives. Thirty-one reporting countries publish a
Slovak-citizen count. None of them is ŠÚ SR, which is precisely what makes the
comparison informative: the numerator and the denominator come from
administrations with opposite incentives to record a departure.

Note that Slovakia itself appears among those 31, reporting its own resident
Slovak citizens. It is excluded from every panel, and `compute()` raises if it is
passed in, because including it would count people who never left.

#### Load-bearing caveats

- Destination stock counts Slovak **citizens**, not Slovak-born. A Slovak-born
  person who never held Slovak citizenship is absent; a dual national is present.
- Destination registration is more complete than Slovak deregistration but is not
  a census. Its own undercount is unknown and unquantified here.
- `intl_out` is used at the **national level only**. Below that it counts moves
  out of the district including moves to other Slovak districts.

#### Supersedes, and corrects, the earlier figures

This replaces the dead "23-38%" template above. It also **does not reproduce**
the 111,256 / 45,621 / 2.4x figures recorded in the July 2026 handover. Those
came from three mismatched windows: a stock change measured 2013-2025, a
naturalisation sum over 2014-2023, and a ŠÚ SR denominator over 2014-2025
(45,621 is exactly ŠÚ SR 2014-2025). Aligning all three to the window the stock
endpoints actually imply gives 2.64x. The handover's "robust 2.1x to 3.9x across
five specifications" is not reproduced either, though the range here, 1.84x to
3.71x across seven specifications, is close to it in width.

**On copy that asserts a multiplier.** Only one of the seven specifications falls
below 2x, and it is the one that deletes the largest destination from a 2013-only
window. On the accession window that matches the landing hero, the same exclusion
still gives 2.15x. A claim of "at least twice as high" is therefore defensible,
but the site does not make it: the hero states the two figures and leaves the
arithmetic to the reader, and this page carries the range. That is the safer
construction, because a multiplier invites the reader to treat one specification
as the answer when the honest result is a range with a floor.

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

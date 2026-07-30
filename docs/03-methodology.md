# Methodological Notes

> **Numeric claim convention.** Every numeric figure in this document carries a
> status marker: `verified` (reproducible, source named), `unverified` (plausible
> but not reproduced here), or `illustrative` (a placeholder showing format, NOT
> a measurement). **A figure with no marker is unusable.** Introduced July 2026
> after an illustrative 300,000 in `07-editorial-content.md` escaped into the
> landing page as fact.


## Core definitional matrix

| Filter | Source | What it actually measures | Best dataset |
|---|---|---|---|
| **Slovak-born** | Place of birth | Anyone born in current Slovak territory | UN DESA, OECD DIOC, destination censuses |
| **Slovak-citizen** | Current citizenship | Holds Slovak passport (incl. dual) | Eurostat `migr_pop1ctz`, ČSÚ register |
| **Slovak-identified** | Self-declared ancestry/ethnicity | Cultural identification | US census ancestry, UK census national identity |
| **Educated** | Highest completed | Various ISCED levels | 2021 Census, Eurostat LFS, DIOC |

These don't agree on totals. Display the discrepancy as a feature, not a bug — the contradiction between definitions IS the story.

## Net vs gross

**Gross emigration** = number leaving the geographic unit in period.
**Net migration** = arrivals − departures.

For Section 1 (internal SK), both are meaningful: a district can lose people to other SK districts while gaining from rural surroundings.

For Section 2 (SK→CZ), gross outflow is the headline; return migration as a separate sub-metric.

For Section 3 (diaspora), stock-based metric is primary (because flow data has too many gaps). Show change in stock as proxy for net flow.

**Filter implementation:** the "include immigrant brains" toggle at the top of Sections 1-3 switches between:
- Gross outflow of educated Slovaks
- Net = gross outflow minus inflow of educated foreigners to SK (or, for Section 1, to that region)

The inflow comparator is needed because Slovakia gains immigrants each year (mostly Ukrainian, Hungarian, Czech labour) which partially offsets the educated outflow. The registered figure is **6,287 per year** on average, 2004-2025. `verified` (mean of `intl_in` at `geo_level='nation'`; total 138,321 over 22 years).

The "~21k per year" previously stated here, and its "23,562" verification, were both wrong. 23,561.5 is exactly the annual total of `intl_in` summed over the four NUTS2 **oblasti**, and at sub-national levels this series counts moves INTO the unit including moves from other Slovak districts, so it is internal plus international migration rather than immigration. Every geographic level gives a different plausible answer from the same metric (kraj: 29,279; okres: 55,838; urban/rural: 53,563), which is why the level must be stated: only `geo_level='nation'` measures immigration to Slovakia. The earlier check reproduced the document's own filter rather than testing it.

Note also that Ukrainians under temporary protection are EXCLUDED from this series per Eurostat ESMS, so it is not a total immigration figure.

**WARNING on netting:** do not present `intl_net` anywhere. `intl_in` and `intl_out` are collected through different institutions (municipal registration offices for nationals, Foreign Police for foreigners) with different enforcement, so the inflow register is near-complete and the outflow register is a severe undercount. Their difference is an artefact of that asymmetry, not a migration balance. Registered outflow is a lower bound and should be shown as a rate, not netted.

## Interpolation strategy

Where data exists annually, no interpolation. Where it doesn't:

- **DIOC (5-yearly):** linear interpolation between snapshots, marked "interpolated" in tooltips. Show actual snapshot years more prominently.
- **Census-based education levels (decennial):** linear interpolation between 2011 and 2021 censuses, cross-validated against Eurostat LFS regional aggregates which exist annually.
- **Wage data:** quarterly already, no interpolation needed.
- **Slovak doctors in country X:** AEMH 2025 report gives one point; SLK doesn't publish historical. Show as 2025 snapshot only.

When extrapolating beyond the last data point, don't. Cut off the line at the last actual observation.

## Cohort effects in age slicing

The "educated 25-44" cohort changes composition over time. Someone aged 30 in 2010 is a different person than someone aged 30 in 2024. When showing time series for an age bracket, two valid views:

1. **Period view** — what the bracket looked like in each year (default; comparable to other countries)
2. **Cohort view** — follow a specific birth cohort (e.g. people born 1990-1995) over time

Default to period view. Offer cohort view as a toggle on the trend chart.

## Bratislava effect

Bratislava captures most economic dynamism in Slovakia. This will dominate national averages and distort comparisons. Always:

1. Show "SK excluding Bratislava kraj" as a separate line/aggregate
2. Allow the user to deselect Bratislava in the map

This is especially important because Bratislava is a **net importer** of educated Slovaks from elsewhere in Slovakia (internal brain gain) at the same time as it's a **net exporter** to abroad. Both flows happen simultaneously.

## Adjusted persistence in the Czech corridor

How many Slovak arrivals in Czechia are still there some years later? The raw
calculation divides the change in registered Slovak residents by OECD-recorded
arrivals, and it understates, because two exits from the *count* are not exits
from the *country*: naturalisation and death.

Adjusting for both. Czech naturalisations of Slovak citizens are held
(Eurostat `migr_acq`, `geo=CZ`, `citizen=SK`). Mortality has no Slovak-specific
age profile in ČSÚ open data, so the **assumption** is stated rather than hidden:
the EU27-in-Czechia age distribution is used as the profile, the same proxy §2
already discloses, with broad-band age-specific death rates. That yields a crude
rate of **5.34 per 1,000 per year** on the resident stock. The population is young
(46% aged 25 to 44) so the term is modest, but it is not negligible: halving it
takes 2016-2020 persistence from 84.4% to 79.6%, and raising it by half takes it
to 89.2%. So the mortality assumption carries roughly ±5 percentage points, which
is why the figure below is given as an estimate and not a measurement.

| Window | Arrivals | Raw change | Raw | Naturalisations | Deaths | Adjusted |
|---|---|---|---|---|---|---|
| 2016-2020 | 25,500 | +17,293 | 67.8% | +1,793 | +2,442 | **84.4%** |
| 2022-2023 | 6,407 | +1,917 | 29.9% | +741 | +627 | **51.3%** |
| 2022-2024 | 12,919 | +4,206 | 32.6% | +1,666 | +1,263 | **55.2%** |

`unverified` for the mortality term specifically; the naturalisation term is
`verified`.

**The two windows are not comparable, and the reason is the 2021 census.** The
post-2022 window sits on a stock that Czechia re-based downward in 2021, removing
about 26,000 Slovak registrations at a stroke. A window beginning after a
downward re-basing starts from an artificially low base, so its stock *change*
measures partly the register refilling with people who were already present rather
than new arrivals persisting. The pre-census window has no such contamination.

The honest reading is therefore that **84.4% is a defensible pre-census estimate
and the post-census figures are not a measured decline in persistence.** The drop
from 84% to 55% should not be presented as behavioural. Two effects are entangled
in it and this data cannot separate them: any genuine change in persistence, and
the arithmetic consequence of re-basing the denominator's stock.

Per the standing constraint in the handover, no §2 copy asserts a persistence
rate. This entry exists so the number is documented rather than recomputed
casually later.

## Czech corridor as special case

For Section 2 specifically, do NOT treat Slovak→Czech as standard international migration. The two countries:

- Have free movement (EU + bilateral agreements)
- Have mutually intelligible languages
- Share most institutional history (1918-1992)
- Have cross-recognition of qualifications

Behaviourally, Slovaks in Prague are closer to Slovaks in Bratislava than to Slovaks in London. Frame Section 2 as "internal extension of the Slovak labour market into a higher-wage jurisdiction" rather than emigration in the classical sense.

## The Slafkovský narrative caveat

In Section 4, Slafkovský is included as an athlete because his case complicates the "athletes return" narrative. But the framing must be careful:

- He was 15 when he left (family decision + youth hockey development pipeline)
- His criticisms in The Athletic Oct 2024 were specifically about nepotism in Slovak ice hockey federation, not about Slovakia broadly
- He continues to represent Slovakia internationally
- Frame as: "the kind of structural complaint that drives young talent out", not "Slafkovský left and won't come back"

Source-attribute his quotes carefully — The Athletic article by Arpon Basu (Oct 8, 2024) is the primary; Hockey Slovakia's response on Šport.cz; Gáborík's rebuttal on the Boris a Brambor podcast.

## Display honesty principles

1. **Always show date of last update** on every chart
2. **Distinguish actual vs interpolated** points visually (solid dot vs hollow ring)
3. **Show data source as clickable link** below every chart
4. **Acknowledge undercounting** with a persistent banner in Section 1.
   The "~300k" figure previously given here has no source: it traces to the same
   illustrative example in `07-editorial-content.md` as the landing hero, not to
   any dataset. The undercount is now **derived**: over the full accession window
   2004-2024, destination registers imply 222,321 departures against 59,935
   registered, a ratio of 3.71x, and that is a floor. `verified` See
   `06-sources-page.md` section 4a for the derivation, the seven specifications
   (range 1.84x to 3.71x) and the caveats. Reproduce with
   `pipeline/analysis/mirror_comparison.py`.

   Do not state the multiplier in reader-facing copy. State both figures and let
   the reader do the arithmetic: a single ratio invites treating one
   specification as the answer when the result is a range with a floor.
5. **Compare definitions** in Section 3 — show side-by-side counts for "Slovak-born vs citizen vs identified" so users see the methodological gap
6. **Don't aggregate everything to a single Brain Drain Index** — the existing Fund for Peace HFBDI is one input but shouldn't be the headline number

## What we explicitly will NOT claim

- We will NOT claim to know how many Slovak doctors are abroad to within ±10% — the SLK register doesn't track that and destination data is fragmented
- We will NOT claim a single dollar figure for "cost of brain drain to Slovakia" — Blue Europe's €2.8M per graduate figure is a defensible estimate but range-bound `unverified` (source not fetched)
- We will NOT extrapolate trends past the last data point
- We will NOT compare Slovakia to "successful" or "unsuccessful" countries without showing the comparator's full distribution

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

## The born-versus-citizen divergences: what a mechanism explains

On the 25-country matched panel the two definitions agree within 3% in aggregate
while diverging sharply per country. The aggregate agreement is coincidence. What
matters is which divergences have a nameable cause.

Naturalisation is the testable one: a Slovak who acquires the local citizenship
leaves the destination's count of Slovak citizens without leaving the country, so
`born > citizen` should be partly explained by cumulative naturalisations.

Both sides must cover the same period. The stock gap is dated 1 January 2020, so
the naturalisations that produced it are those accumulated **through end-2019**.
Using every year the dataset holds (to 2024) inflates every share: Hungary would
read 48% instead of 33%, which is the hero window mismatch in another guise.

| Destination | Born | Citizen | Gap | Naturalisations to end-2019 | Share of gap |
|---|---|---|---|---|---|
| France | 5,560 | 3,999 | 1,561 | 1,248 | **80%** |
| Italy | 10,611 | 7,976 | 2,635 | 1,130 | **43%** |
| Hungary | 20,980 | 10,581 | 10,399 | 3,441 | **33%** |
| Ireland | 13,573 | 9,388 | 4,185 | 309 | 7% |

`verified`, Eurostat `migr_acq`, `agedef=COMPLET`, cumulative 2002-2019.

So naturalisation accounts for most of the French gap, a little under half of the
Italian one, and a third of the Hungarian one. It does not explain Ireland, which
stays unexplained and must not be presented as a mechanism.

**Accumulation window, and it differs by country.** Every naturalisation figure
above is cumulative through **end-2019**, set against a stock dated 1 January
2020. The start year is NOT the same across countries and is not the dataset's
own start:

| | First Slovak-citizen observation |
|---|---|
| `migr_acq` dataset overall | 1998 |
| Hungary | 2002 |
| Italy | 2003 |
| France | 2004 |
| Ireland | 2005 |

So each share is accumulated over a slightly different window, and none of them
reaches back to 1998. Prose must attribute the start year to the country's series
rather than to the dataset. The effect is small, since annual volumes in the early
2000s are in the tens, but the shares are not strictly comparable across the four
and must not be ranked as though they were.

**RESOLVED: Hungary's simplified procedure is NOT the operative mechanism.** This
was an open fork and the answer changes what the prose may claim.

Regulation 862/2007 defines `migr_acq` over the **usually resident population** of
the reporting state. Hungary's 2010 simplified procedure grants citizenship to
applicants with Hungarian ancestry or language *without* a residence requirement,
so those grants fall outside the statistical population. The scale test confirms
they are excluded: the programme granted on the order of 1.1 million citizenships
across 2011-2020, while Hungary's entire reported `migr_acq` total peaks at 20,554
in 2011 and runs at 1,700 to 3,000 a year recently. Two orders of magnitude apart.

**Consequences.** The 3,441 figure does **not** overstate. But it counts Slovak
citizens who were usual residents of Hungary when they naturalised, which is
ordinary naturalisation, the same mechanism as France. Prose must not present it
as capturing cross-border grants to ethnic Hungarians in southern Slovakia,
because by definition it cannot.

The series does step at the procedure's introduction, from 97 in 2010 to 414 in
2011, settling to roughly double the pre-2011 mean. That is consistent with the
procedure easing ordinary naturalisation for Slovaks *already resident* in
Hungary, and with a transitional cohort regularising. It is not evidence of
non-resident grants entering the count.

**Stated factually, because this is a live political dispute.** Hungary's 2010
amendment introduced the simplified procedure described above. Slovakia has a
substantial Hungarian-speaking minority, concentrated in the south. Slovakia
amended its own citizenship act in 2010 to provide for loss of Slovak citizenship
on voluntary acquisition of another. Both measures were, and remain, politically
contested in both countries. This project takes no position on either.

**The 2010 Slovak law does not produce a detectable break in the series.** If
voluntary acquisition of another citizenship systematically removed people from
the Slovak-citizen definition after July 2010, the destination-reported stocks
should fall or stall. They do not. Hungary's series falls once, by 592 in 2012,
then grows every year to 17,124 by 2025. Growth rates do slow after 2011 in most
destinations (Hungary -33pp, Slovenia -52pp, Norway -33pp comparing 2005-2010
against 2012-2020 CAGR), but the slowdown is near-universal and is better read as
post-accession maturation than as a legal shock: Germany's rate *rose*.

**The 2010 provision was relaxed in 2022.** `unverified` A February 2022 amendment
permits a Slovak citizen to retain Slovak citizenship on naturalising elsewhere
where they have lived in that country for at least five years. The 2010 rule also
never applied to citizenship acquired at birth or through marriage. Source: the
GLOBALCIT-style secondary literature and press summaries; the consolidated
statutory text on Slov-Lex could not be retrieved, and **the commencement date is
not confirmed**, so this is marked unverified and the prose does not date it
precisely.

Two consequences. First, prose must not describe the 2010 loss provision as if it
still operated unqualified, because for most of the period since 2022 it has not.
Second, it makes the tested null below more robust rather than less: a provision
that was already carve-out-ridden and then relaxed is even less able to explain a
structural gap.

**Consequence for the mirror comparison: none.** The 2.5 mirror adds
naturalisations back precisely because they are an exit from the count and not
from the country, so a legal change that accelerates naturalisation is already
neutralised there. It would matter only if the mirror used stock change alone,
which is the `no_naturalisation_adjustment` specification, reported separately.

**Netherlands and Belgium are the opposite case and are NOT a definitional
finding.** UN DESA reports 1,671 Slovak-born in the Netherlands against 6,856
Slovak citizens reported by the Netherlands itself. Citizens cannot exceed
Slovak-born fourfold in a country with no Slovak-descent population and no
dual-citizenship route. OECD puts Slovak-born in the Netherlands at 7,418 in 2021,
its nearest available year to the 2020 snapshot, so UN DESA's *born* figure is the
error. Note OECD is not an independent observer here: it compiles from the same
Dutch register. What it provides is a second compiler's reading of one register,
which is enough to locate a transcription-scale error but is not corroboration. Median
absolute divergence is 0.11 for stocks above 10,000 and 0.31 below 3,000, so the
small-stock tail is error-dominated throughout. Caveat layer, not prose.

## Country counts per definition: pin the basis, not the number

Four different citizen counts have circulated (31, 30, 25, and 25 again) and they
are all correct. They are one series counted four ways.

| Count | Basis |
|---|---|
| 31 | Reporting countries in Eurostat `migr_pop1ctz` with any Slovak-citizen observation in **any year**, including Slovakia's own self-report |
| 30 | Same, **excluding Slovakia**, which reports its own resident Slovak citizens and must never be counted as a destination |
| 25 | Countries reporting in the single year **2020** |

**Rule: state the basis, and use one basis per sentence.** A sentence comparing
definitions must put both on the same footing or it repeats the hero window
mismatch in a different column.

The section's default basis is the **2020 snapshot**, because the map and the
matched panel are both 2020:

| Definition | Countries, 2020 | Source |
|---|---|---|
| Born | **51** | UN DESA bilateral, 2020 revision |
| Citizen | **25** | Eurostat `migr_pop1ctz` |
| Identified | **1** | US ACS B04006 (the only ancestry count this project holds) |

On identified: Canada and Australia also ask census ancestry or ethnic-origin
questions, so Slovak self-identification counts exist for them. They are not held
here. The claim is about this project's coverage, not about what is collectible.

## Dissolution date convention

Czechoslovakia dissolved at midnight on 31 December 1992. Slovakia has existed as
an independent state since **1 January 1993**. Both dates are correct and they
describe different events, which is how a single site ends up using both and
looking inconsistent.

**The convention, applied everywhere:**

- **Use 1993** when the subject is Slovakia, independence, or a threshold applied
  to people: "born before 1993", "post-1993 departures", "the 1993 split". This is
  the dominant usage on the site already.
- **Use 1992** only when the subject is Czechoslovakia's own existence and the
  sentence needs an end date: "the federation existed from 1918 to 1992".
- **Never write** "Czechoslovakia, which stopped existing in 1992" next to a
  people-threshold in 1993 in the same passage. Pick the frame the sentence is
  about.

For the US Czechoslovakia birthplace code specifically, the correct frame is the
state: the code names a country that ceased to exist at the end of 1992, and the
people it counts were born before 1993.

## The unallocatable Czechoslovakia category

Both relevant US tables carry a Czechoslovakia line alongside the Slovak one, and
neither can be split.

| Table, 2023 ACS 5-year | Named Slovak | Czechoslovakia line | Ambiguous share |
|---|---|---|---|
| Birthplace, PUMS `POBP` | 19,700 (`149`) | 17,993 (`105`) | 26.6% of the three codes |
| Ancestry, B04006 | 615,823 | 242,907 | 28.3% of the two lines |

**The two ancestry lines are NOT disjoint.** The ACS ancestry question accepts up
to two write-in responses per person, so someone reporting both Slovak and
Czechoslovakian ancestry appears in both lines. Across all 108 ancestry lines the
values sum to 412,695,237 against a universe total of 332,387,540, a ratio of
1.24, which is the multiple-response overlap made visible. So 242,907 is not
"242,907 more people" on top of 615,823, and the two figures cannot be added even
in principle. The birthplace codes in PUMS *are* mutually exclusive, one per
person, so the two tables fail in different ways.

**These are not plausible ranges and must never be written as one.** Adding the
whole Czechoslovakia figure to the Slovak one assumes every Czechoslovakia-born
resident and every self-declared Czechoslovakian is Slovak, which cannot be true:
the Czech population of both categories is certainly larger, since PUMS records
29,926 Czech-Republic-born against 19,700 Slovakia-born. The arithmetic ceiling is
therefore not a candidate value.

The honest statement is that the category is **unallocatable**: the named figure
is a floor, an unknown share of the ambiguous figure belongs above it, and no
knowable rule divides it. **Do not present a midpoint, a split by any assumed
ratio, or a range implying the upper end is possible.** A midpoint would be an
invented number with a false precision worse than either bound.

## A tested null: Slovakia's 2010 citizenship law

**Hypothesis, and it was a reasonable one.** Slovakia's 2010 amendment provides for
loss of Slovak citizenship on voluntary acquisition of another. If that operated
at scale, it would systematically deflate the citizen definition after July 2010
for every destination, would explain the Hungarian born-versus-citizen gap as a
legislative artefact rather than migration, and would bias the 2.5 mirror
comparison, which is built on destination-reported Slovak-citizen stocks.

**The series refutes it. Recorded so nobody reopens it.**

- Hungary's Slovak-citizen stock falls exactly once after the law, by 592 in 2012,
  then grows every year to 17,124 by 2025. A citizenship-stripping provision
  operating at scale cannot coexist with a stock that nearly triples after it.
- Growth rates do slow comparing 2005-2010 against 2012-2020, but almost
  everywhere at once (Slovenia -52pp, Hungary -33pp, Norway -33pp, Italy -12pp,
  Finland -13pp) while **Germany's rate rose by 3pp**. A near-universal slowdown
  with an exception is post-accession maturation, not a legal shock traceable to
  one country's statute.
- Cumulative Hungarian naturalisations of Slovak citizens are 4,949, which is 48%
  of the 10,399 Hungarian gap. Substantial, but not enough to carry it, and it is
  a naturalisation effect rather than evidence of automatic loss.

**Consequence: none for the mirror.** It adds naturalisations back precisely
because they are an exit from the count and not from the country, so even a large
naturalisation effect is neutralised there by construction. It would matter only
to the `no_naturalisation_adjustment` specification, which is reported separately.

## US figures: vintage discipline

Four US figures circulate in this project and they are not all the same year.
Stating them together without the vintages repeats the hero window mismatch.

| Figure | Value | Vintage |
|---|---|---|
| PUMS `POBP=149` Slovakia | 19,700 | 2023 ACS 5-year |
| PUMS `POBP=105` Czechoslovakia | 17,993 | 2023 ACS 5-year |
| Published B05006 "Czechoslovakia" | 65,036 ±2,808 | 2023 ACS 5-year |
| B04006 Slovak ancestry | 615,823 ±8,391 | 2023 ACS 5-year |
| OECD Slovak-born in US | 18,243 | **2020** |
| OECD Slovak-born in US | 20,876 | 2023 (matched) |

Use the 2023 OECD figure when setting it beside a PUMS or ACS number. On matched
2023 data PUMS gives 19,700 against OECD's 20,876, a 6% difference.

`unverified` on OECD's derivation: 19,700 against 20,876 is *consistent with*
OECD deriving its US figure from ACS microdata rather than the published table,
but OECD's metadata has not been read and proximity is not provenance. Do not
write "derived from"; write "consistent with".

The PUMS codes sum to 67,619 against the published 65,036. The difference of 2,583
is inside B05006's ±2,808 margin, so the two are consistent. Prose that shows both
must say so, because otherwise a reader sees two different totals for one concept.

## Which flags are evidence and which restate a document

`is_interpolated` and `is_proxy` look like data. Two of their populations are not,
and copy must not cite them as if the file had discovered something.

| Population | Provenance | Citable as evidence? |
|---|---|---|
| OECD rows, §3 | Mapped from the file's own `OBS_STATUS` column (`E`, `I`, `L` → true) | **Yes.** Per-observation, from the publisher. |
| UN DESA rows, §3 | **Constant `True`.** The bilateral matrix has no per-observation status column. Set because the 2020 revision Methodology Report section 6 says every reference year is interpolated or extrapolated. | **No.** Cite the report directly. |
| §1 and §2 rows | `None` throughout. No interpolation register was ever built. | No. Absence of a flag, not evidence of a direct observation. |
| `is_proxy`, §2 age structure | **Constant `True`**, with `proxy_note` explaining that EU27-in-CZ substitutes for a Slovak age profile that ČSÚ does not publish. | **No.** It records our own substitution. |

The rule: a flag set from a document is provenance-by-assertion. Writing "the data
flags all seven reference years as interpolated" would be circular, because we set
the flag from the claim we would be using it to support. Say instead that UN DESA
states this in its methodology report, and name the report.

`data_type` in §3 is different and **is** citable: it is read from column 4 of the
bilateral matrix, "Type of data of destination", where `B` is place of birth and
`C` is foreign citizenship.

**How the 47 / 3 / 1 split folds the flags, stated deliberately.** The column holds
compound values, because `R` is a separate flag meaning "includes refugees, asylum
seekers or Venezuelans displaced abroad" and can accompany any type letter:

| Raw value | Destinations | Sum | Folded to |
|---|---|---|---|
| `B` | 37 | 301,145 | birth-derived |
| `B R` | 10 | 1,544 | birth-derived |
| `C` | 1 | 113,773 | citizen-derived |
| `C R` | 2 | 24 | citizen-derived |
| `I R` | 1 | 3,165 | imputed |

The fold is on the **leading letter**, which is the definitional one. `R` is
orthogonal to it: a `B R` row is still a place-of-birth count. This is the same
fold as Bosnia's `I R` row, which is counted as imputed rather than as
birth-derived, and it is the fold that produced the earlier "forty-eight" error
when `I R` was mistakenly grouped with `B`.

For Slovak stocks the `R` flag is immaterial in size: all thirteen R-flagged rows
total 4,733 people, 1.13% of the 419,651. The `I R` row (Bosnia, 3,165) is most of
that, so the refugee flag proper covers about 1,568 people.

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

### Which way the mortality proxy is likely to be wrong

The proxy is the EU27-in-Czechia age distribution, mean age 40.9 in 2020. The
question that matters is not whether it is exact but which direction it errs, and
here the direction is knowable even though the magnitude is not.

**A mortality term that is too small makes persistence look too low.** Deaths are
added back to the numerator, because someone who died in Czechia left the register
without leaving the country. So if the true Slovak cohort is older than the proxy,
we are under-adding, and the real persistence is higher than 84.4%.

Three reasons to think the Slovak cohort is at least as old as the proxy, not
younger:

- Slovak arrivals have been flat at 6,000 to 7,000 a year since 2012 while the
  stock grew, which is the aging-in-place pattern §2 documents. A population that
  grows without proportionate fresh arrivals ages faster than one that does not.
- The Slovak presence in Czechia is the oldest of the EU27 cohorts there in
  historical terms: it predates EU accession entirely, since free movement between
  the two countries survived the 1993 split. Later-arriving EU27 nationalities
  have no comparable pre-2004 stock to have aged.
- §2's own measurement: EU27 mean age in Czechia rose from 39.9 to 40.9 across
  2015-2024, almost exactly one year per calendar year, meaning the distribution
  is barely refreshed at the young end.

Quantifying it: shifting the whole distribution one five-year band older raises
the crude rate from 5.34 to 8.21 per 1,000 and takes 2016-2020 persistence from
84.4% to **89.7%**.

**So 84.4% is conservative, and the error runs in the direction of understating
retention.** One caveat on how much comfort to take from that: Slovaks are roughly
51% of the EU27 stock in Czechia, so the proxy is already half Slovak by
construction. The true profile cannot diverge from it by more than the other half
diverges, which bounds the error well below the illustrative five-year shift above.

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

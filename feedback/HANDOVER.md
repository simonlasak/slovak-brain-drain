# Handover — Slovak Brain Drain, post-audit

Written 2026-07-30. Repo clean, all work pushed to `origin/main` at `5154563`.

Read `docs/03-methodology.md` and `docs/05-design.md` before writing code. Do not
implement from memory.

---

## Standing rules (these override defaults)

- **Commit per stage gate, and push automatically.** Šimon's name and email are
  already configured; no co-author trailers.
- **Šimon approves all copy.** Draft prose, never commit it unapproved. This
  includes `internal.ts`, `corridor.ts`, `diaspora.ts`, the landing page, and any
  caption.
- **Hard stop at every checkpoint.** Do not proceed past a gate because the next
  step looks obvious.
- **No em-dashes anywhere** in code, copy, or comments.
- **No green.** Gain is Tatra blue, loss is terracotta. No hardcoded hex outside
  `tokens.css`. No radius above 8px, no font-weight above 600.
- **Escalate an invalidating finding to the top of the report.** Do not append it
  under "corrections" or "not deployed". This was a repeated failure.
- **A figure in `docs/` is not sourced.** Every numeric claim now carries
  `verified` / `unverified` / `illustrative`. Unmarked means unusable.
- **Never present `intl_net`.** See "Contaminated metrics" below.
- Slovak is authored in **one pass at the end**. Every section ships `sk` as a
  spread of `en` with `reviewed: false`. Never machine-translate.

---

## Where the project is

Pipeline stages 1-3 done. Sections 1 and 2 built and deployed. Section 3 has a
frontend but its prose is **not publishable** (see below). A five-gate data audit
just completed and found substantial defects, all now fixed in the pipeline.

### What the audit established

**Contaminated metrics — do not use without a `geo_level` filter.**
`intl_out` and `intl_in` do NOT tile: at sub-national levels they count moves out
of that unit, including moves to other Slovak districts. `population`, `births`,
`deaths` and `intl_net` do tile.

| Metric | National (`geo_level='nation'`) | Sum of oblasti | Sum of okresy |
|---|---|---|---|
| `intl_out` 2004-2025 | **64,855** | 444,888 | 1,154,977 |
| `intl_in` 2004-2025 | **138,321** | 518,354 | 1,228,443 |

`intl_net` is identical at every level (+73,466) because internal moves cancel.
That means **`intl_net` is not international net migration** — it is total net
migration. It must never be presented as international.

Worse: `intl_net` is the difference between a near-complete inflow register
(Foreign Police, enforced) and a severely incomplete outflow register (municipal
offices, no enforcement). Its positive sign is an artefact. Never show it.

**Numbers that are dead:**
- The landing hero's 300,000 was a hardcoded char array in `HeroCounter.tsx`,
  traced to an *illustrative example* in `07-editorial-content.md:15`.
- "One in every 18 Slovaks" was derived by dividing into that fabricated number.
- The 23-38% registration gap in `06-sources-page.md` was also an illustrative
  template, not a finding. No ŠÚ SR emigration-by-destination series exists (all
  668 DATAcube datasets checked).
- All UN DESA growth percentages. Per the 2020 revision Methodology Report
  section 6, all seven reference years are interpolated or extrapolated, so a
  growth ratio divides two modelled quantities. Absolute levels survive with a
  caveat; ratios do not.
- "~21k immigrants/yr" in `03-methodology.md:29` is marked `verified` and is
  WRONG. The national figure is 6,287/yr. **Re-mark this when copy work is
  authorised.**

**The 2.5 mirror comparison (built, not yet written up in `docs/`).**
Constant 15-country Eurostat `migr_pop1ctz` panel (AT BE CZ DE FI HU IS IT LT LV
NL NO RO SE SI), 2013-2025. Implied departures = change in destination-reported
Slovak citizens + naturalisations in those countries. Result: **111,256 implied
against 45,621 ŠÚ SR registered, a ratio of 2.4x**. Robust 2.1x to 3.9x across
five specifications. The panel omits the UK, Ireland, Spain, Switzerland and
France while ŠÚ SR's denominator covers all destinations, so **2.4x is a floor**.
This replaces the dead 23-38% entry in `06-sources-page.md`.

---

## Next steps, in order

### 2.2 Cut §1 map step 4 (approved, partly copy)

`intl_net` correlates +0.778 with step 3's `total_change` and +0.754 with step 2's
`cohort_retention`, so it largely restates them, and its narrative job (the §2
handoff) is the one thing the metric cannot do. **Decision: cut to three steps.**

- Structural: remove the fourth entry from `STEPS` in `MapVariantA.tsx`.
- Copy (DRAFT, needs Šimon): remove `mapSteps[4]` from `internal.ts`, move the §2
  transition currently in `bridge4` into prose.
- Factual metadata (can just do): `sources.map` in `internal.ts` describes four
  steps and mentions `intl_net`; update for three.
- Šimon's earlier approval of "registered departures per 1,000" is **withdrawn**;
  `intl_out` is contaminated at district level too.

### 2.3 Hero number (copy approved verbatim)

Use **64,855**. Rebuild `HeroCounter` to a `{metric, source, asOf}` descriptor
resolved through the DuckDB layer at mount, so an unsourced hero becomes
impossible to render. Keep a server-rendered fallback so it never blanks while
WASM loads. Remove "one in every 18" entirely.

Approved copy:

> # 64,855
>
> **The number of people Slovak authorities recorded leaving the country between
> 2004 and 2025.**
>
> It is a fraction of the real figure. Deregistering on departure carries no
> penalty and no benefit, so most people who leave never do it: destination
> country registers imply the true number is at least twice as high.

### 2.4 Landing claims 3, 4, 5 — fetch in this order, report after each

1. **EU ranking of population share lost.** Eurostat `migr_pop1ctz` plus
   `demo_gind`. Build once, use twice: this also serves the §3 CEE comparator.
   State the same coverage gaps (no UK, ES, HR, BG, EL).
2. **18% studying abroad, highest after Luxembourg.** `educ_uoe_mobs02` wider
   slice plus `educ_uoe_enrt01` for the denominator. The SK-to-CZ slice is
   already held.
3. **40% returning.** Highest risk. If it cannot be sourced to a retrievable
   minedu.sk or IVP publication, **the sentence comes out**. Do not soften it
   into a vaguer claim to keep it.

### 2.5 Write up the mirror comparison

Built already (numbers above). Replace the dead entry in `06-sources-page.md`.
Its role is to quantify the gap the hero asserts, not to be the hero.

### 2.6 §3 rewrite — definitional framing

**`/diaspora` is currently live with prose we have agreed is not publishable**
(growth ratios, "87 countries"). Fixing this is urgent if the repo is
portfolio-facing.

The section's subject becomes: the diaspora cannot be counted cleanly. Evidence:

- UN DESA's own methodology report states origin estimates "are likely to
  underestimate the size of transnational populations, especially for smaller
  countries or areas of origin".
- Czechia is the single type-`C` (foreign citizens) row among 51 destinations,
  so the site's largest figure is on a different definition from the other 50.
  Now queryable as `data_type` in the parquet.
- Italy at 10,611 against its own national count of 1,095, a factor of 9.7.
- The United States at **zero**, against 10,345 Slovaks naturalising there.
- All seven reference years interpolated or extrapolated, not counted.
- **The triangulation, which is the strongest card:** UN DESA `born` at 419,651
  and Eurostat `citizen` at 297,234 converge once each source's known coverage
  gaps are accounted for. Two independent sources on two different definitions
  agreeing in magnitude is stronger than either alone.

Absolute levels survive with a modelled-estimate caveat. **No growth ratios.**
Prose first per `07-editorial-content.md`, charts only after approval.

Also pending for §3: `slovak_def` has `born` (stock) and `citizen` (flows only),
and `identified` is empty. `03-methodology.md` principle 5 wants side-by-side
counts for all three. Needs Eurostat `migr_pop1ctz` for citizen stock and US
census B04006 for ancestry.

---

## Blockers

- **US ACS B05006 / B04006** need a free Census API key, which Šimon is
  obtaining. B04006 (ancestry) matters more: it makes the definitional contrast
  land, roughly 18,000 born against several hundred thousand claiming ancestry.
- **UK Slovak citizens**: absent from Eurostat post-Brexit. Needs ONS or EU
  Settlement Scheme. The UK is §3's central case, so this matters.
- **Official obec count `unresolved`**: 2,891 vs 2,924 vs 2,927. Register
  unreachable. Do not pick one.
- **`young_share` definition unrecoverable.** Dropped, not guessed. Nothing
  renders it.
- **DIOC never fetched**, so §3 has no education profile. The one education file
  (`mig_emp_edu_svk.csv`) is SDMX XML mislabelled `.csv` and covers immigrants
  INTO Slovakia, the wrong direction.
- **§2 flow/stock accounting does not close.** OECD B11/B12 and ČSÚ CIZ003T003
  are not a matched pair, births to Slovak parents in CZ are unheld, and the age
  profile is an EU27 proxy. Any persistence rate across them carries error of the
  same order as the quantity. §2's framing survives; do not recompute persistence
  and treat it as a finding. A note in the §2 `stock` About panel that the
  accounting cannot be reconciled is proposed but unapproved.

---

## Gotchas

- `npm install` needs `--legacy-peer-deps` (visx declares peer React <=18, project
  runs 19).
- `npm run dev:lan` for phone testing over LAN; Astro binds localhost by default.
- Astro is local-only: `npx astro ...` from `frontend/`.
- The §1 transform has a **hard guard**: it refuses to write if
  `cohort_retention` or other rendered metrics are missing. `cohort_retention`,
  `young_change_pct` and `young_share` were originally derived outside version
  control and lost; the derivation is now recovered and committed. Definition:
  `100 * (aged 35-39 in 2024) / (aged 15-19 in 2004)`, averaging the mid-year and
  31-December indicators for both numerator and denominator.
- `check_geo_levels_tile` in `pipeline/validate/invariants.py` is the invariant
  that finally caught the SK_CAP double-count. Run the suite after any transform
  change: `.venv/bin/python -m pipeline.validate.invariants`. Note it reads
  `data/processed/`, but §1 and §2 live in `frontend/public/data/`, so copy them
  in first.
- Aggregate codes are **labelled, not deleted**: `SK_CAP` and `SK0422_0425` are
  `geo_level='okres_aggregate'`. `M`/`V` are `urban_rural` and must never be
  summed with the territorial hierarchy. An urban/rural split of migration is
  directly relevant to §1's concentration thesis and may earn a chart later.
- Unmapped codes **log and drop, or raise**. Never silent pass-through. This
  pattern caught GBR missing from the M49 map, which would have dropped the
  second-largest destination.

---

## The pattern worth carrying forward

Every contaminated number in this project survived because a plausible figure was
reproducible from a wrong filter. 444,888 looked right because the same filter
gave correct population totals. 88.65 looked right because the recomputation
reproduced the deployed value exactly, and both carried the same SK_CAP
contamination. "~21k immigrants/yr" looked verified because the check reproduced
the doc's own error.

The tiling invariant is what finally broke it, and it should have existed before
any chart did. Verifying a number against the file is not verifying the file.

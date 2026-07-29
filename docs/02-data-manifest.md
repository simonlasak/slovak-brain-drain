# Data Manifest — Sources, Endpoints, Coverage

> **Numeric claim convention.** Every numeric figure in this document carries a
> status marker: `verified` (reproducible, source named), `unverified` (plausible
> but not reproduced here), or `illustrative` (a placeholder showing format, NOT
> a measurement). **A figure with no marker is unusable.** Introduced July 2026
> after an illustrative 300,000 in `07-editorial-content.md` escaped into the
> landing page as fact.


Every dataset Claude Code should fetch, in priority order. All licences confirmed open / public.

## Tier 1 — Slovak primary sources

### 1.1 ŠÚ SR DataCube API ★ CORE

- **Base URL:** `https://data.statistics.sk/api/v2/dataset/{cube_code}/{params}?lang=en&type=csv`
- **Format:** JSON-stat (preferred for tooling), CSV, XML, XLSX, ODS
- **License:** CC-BY 4.0
- **Auth:** none
- **Update cadence:** every weekday 10:00 and 22:00 CET
- **Help page:** https://data.statistics.sk/api/html/help-en.html
- **Migration to STATdata:** ŠÚ SR is migrating to a new portal in 2024-2025; data available in both during transition. Use DataCube until STATdata stabilises.

**Key tables to pull:**

| Code | Title | Granularity | Time | Section |
|---|---|---|---|---|
| `om7011rr` | Stock and Change of Population | SR/oblasť/kraj/okres/urban/rural | annual | 1 |
| `om7013rr` | Stock and Change by Sex | same | annual | 1 |
| `om7101rr` | Population by Sex - obec | obec | annual | 1 |
| `om7102rr` | Population by Sex - okres | okres | annual | 1 |
| `om7104rr` | Population Change | SR/oblasť/kraj/okres/urban/rural | annual | 1 |
| `om7007rr` | Age Groups | SR-okres | annual | 1 |
| `om7009rr` | Age Structure | SR-okres | annual | 1 |
| `om7004rr` | Demographic Balance by Marital Status, Sex, Age | SR/oblasť/kraj | annual | 1 |
| `om7014rr` | Population Density - obec | obec | annual | 1 |
| `om5001rr` | Base Characteristics | obec | annual | 1 |
| `pr0204qs` | Average Monthly Wage - Economy | SR | quarterly | 1, 2 |
| `pr0205qs` | Average Monthly Wage by Industry | SR, NACE | quarterly | 1, 2 |
| `od0008ms` | Wage in Selected Industries (monthly) | SR, NACE | monthly | 1, 2 |

**Tables to discover (likely exist; explore programmatically):**
- Internal migration flow (sťahovanie) O-D matrix at okres level — confirmed by 2024 GeoKARTO paper that used it
- International migration (zahraničné sťahovanie) by destination country
- Population by educational attainment by region (annual estimates between censuses)

**Discovery method:** Crawl `https://data.statistics.sk/api/v2/collection/all_datasets?lang=en` (verify endpoint) for the full table catalogue, filter for `migr`, `population`, `obyvateľstvo`, `sťahovanie` keywords.

### 1.2 Sčítanie 2021 (Population & Housing Census) ★ CORE

- **Portal:** https://www.scitanie.sk
- **Open data hypercubes:** https://www.scitanie.sk/otvorene-data (verify path)
- **Coverage:** every obec; richer than DataCube for socio-economic detail
- **Time:** point-in-time 1.1.2021 (with 1950–2021 time series for some dimensions)
- **Format:** CSV downloads of "hyperkocky"
- **License:** open data

**Variables needed:**
- Population by highest educational attainment × obec × age × sex
- Population by economic activity × obec × education
- Population by mother tongue × obec (for diaspora baseline)
- Internal migration history (where lived 1, 5 years ago) × obec

### 1.3 ŠÚ SR "MY V ČÍSLACH - Zahraničné sťahovanie" annual publication

- **URL pattern:** https://slovak.statistics.sk/wps/portal/ext/products/informationmessages/inf_sprava_detail/{uuid}
- **Most recent:** 2023 edition (published 2024); 2024 edition expected mid-2025
- **Format:** PDF with embedded tables; some accompanying Excel
- **Time series:** 20-year (Section B of each publication)
- **What's in it:** Slovak nationals leaving (vysťahovaní), foreigners arriving (prisťahovalí), naturalisations, by destination country

**Strategy:** PDF table extraction with `pdfplumber` or `camelot-py`; cross-validate against DataCube where overlap exists.

### 1.4 UPSVAR — Labour Office monthly statistics

- **Portal:** https://www.upsvr.gov.sk/statistiky.html
- **Coverage:** unemployment by okres (monthly) and obec (monthly), with age and education breakdowns
- **Time:** 1997–latest, monthly
- **Format:** Excel files, posted monthly

**Easier alternative:**
- **IZ Bratislava LAU1 dataset on Zenodo:** https://zenodo.org/records/17549749
- DOI-cited, cleaned panel data for SK/CZ/PL/HU
- 1997-01 to 2025-12 (348 monthly periods × 79 okres × 14 columns)
- 228,310 SK data points alone
- Author: Michal Páleník (Employment Institute Bratislava)
- Use this as primary; UPSVAR raw scrape as fallback

### 1.5 Slovak Medical Chamber (SLK) registry

- **URL:** https://lekom.sk/register-lekarov-slk
- **Format:** web search interface; no bulk export
- **Use:** spot-checks; can't be scraped at scale
- **AEMH 2025 National Report (Slovakia)** is the practical alternative: https://www.aemh.org/images/AEMH_documents/2025/AEMH-25-017-National-Report-Slovakia.pdf
  - Concrete numbers: ~2,400 Slovak doctors in CZ, ~1,200 DE, ~300-350 AT, ~600 UK (2024-25) `unverified` (AEMH PDF never fetched; not in any parquet)

### 1.6 Centrálny register študentov (CRŠ) via portalvs.sk

- **URL:** https://www.portalvs.sk
- **Open data dataset:** https://data.gov.sk/dataset/centralny-register-studentov
- **Coverage:** Slovak HE students by okres of origin, faculty, year
- **Time:** annual aggregates published
- **Limitation:** doesn't track students *abroad* — for that, use Eurostat (1.6.2) and CZ-side data (Tier 2)

### 1.7 Slovak open data portal (data.gov.sk)

- **URL:** https://data.gov.sk/dataset
- **Use:** geographic codifiers (CL000024 okres list, CL000025 obec list), administrative reference data
- Authoritative codes for all geographic joins

---

## Tier 2 — Czech primary sources (for Section 2)

### 2.1 ČSÚ "Foreigners in the Czech Republic" annual publication

- **Hub:** https://csu.gov.cz/foreigners-in-the-czech-republic
- **24 editions** so far, time series back to early 2000s
- **2024 edition** (data for 2023): https://migrant-integration.ec.europa.eu/library-document/foreigners-czech-republic-2024_de
- **Most recent live data:** https://csu.gov.cz/number-of-foreigners-demographic-events
- **2025 figures:** 125,280 Slovak citizens, 11% of all foreigners
- **Format:** PDF + Excel time series

**What's in it:**
- Stock of foreigners by citizenship by year
- Demographic events (births, marriages, deaths)
- Economic activity / employment by sector
- Education
- Asylum and protection

### 2.2 ČSÚ open data portal

- **Portal:** https://csu.gov.cz/open-data
- **Catalogues:** NKOD (national, MoI) + LKOD (local, ČSÚ)
- **Foreigners-specific time series page:** https://csu.gov.cz/produkty-archiv/1414-03--time_series--1__demographic_aspects_of_the_foreigne_of_life

### 2.3 ČSÚ 2021 Census foreign-citizenship cuts

- 2021 Census recorded Slovaks by age, education, sector, region of residence in CZ
- Published in `13005322q4_digest_vachuska.pdf` and accompanying CSV/Excel
- This is the **gold standard** for the snapshot of "Slovaks living in Czechia and what they do"

### 2.4 MŠMT / DZS — Slovak students in Czech universities

- **Czech Statistical Office "Foreigners studying at Czech universities" annual release**
- **DZS comprehensive 2020 report:** https://www.dzs.cz/sites/default/files/2021-10/DZS_zprava_o_zahranicnich_studentech_EN_WEB.pdf
- **Key facts to validate:** Slovaks = 38% of foreign HE students in CZ `unverified` (no denominator fetched). Enrolment peaked at 24,300 in 2013, NOT ~22k in 2018-2019 `verified` (Eurostat educ_uoe_mobs02, in section2_corridor.parquet); declining since
- **Time series:** academic year 1997/98 onwards

---

## Tier 3 — International / multilateral sources (Sections 2, 3)

### 3.0 Student-emigration data ★ CORE for the "leaving for university" story

This category cuts across Tiers 1-3 because student emigration is itself a primary brain-drain channel — often THE primary channel, since the modal high-impact emigrant leaves before completing Slovak tertiary education.

**Eurostat `educ_uoe_mobs02`** — Tertiary students from abroad by country of origin
- For each EU country, gives Slovak student counts by year, ISCED level, field of education
- Time: 2013–latest (annual)
- Format: SDMX / CSV via Eurostat API
- This is the single most important source for "how many Slovaks left for university and where they went"
- 2017 snapshot for context: 11,472 Slovaks in CZ at bachelor level, 1,295 in UK, 1,211 in HU; ~17% of all Slovak HE students were enrolled abroad (vs EU average 4%)

**Eurostat `educ_uoe_mobg01`** — Mobile graduates by origin and destination
- Tracks completed degrees by mobility status — distinguishes "got a Slovak degree" from "got a foreign degree"
- Less granular than mobs02 but lets you trace whether students who left actually completed abroad

**Czech MŠMT student tables** — Slovak students at Czech universities
- Annual, by university × faculty × year of study × bachelor/master/PhD
- Full time series back to 1997/98 (when separation took effect)
- ČSÚ "Foreigners in the Czech Republic" annual publication has a chapter on education with these breakdowns
- DZS report from 2020 has the deepest single-year cut: motivations, fields, demographics

**Institute of Educational Policy (IVP) at Slovak Ministry of Education** — outbound mobility estimates
- 2012: 12% of secondary school graduates went abroad for tertiary
- 2018: 18% (Slovakia second-highest in OECD after Luxembourg)
- 2024-2025: not yet published consistently; may need to construct via Eurostat + UOE
- Source: https://www.minedu.sk/institut-vzdelavacej-politiky/
- These are the headline percentages — establish a time series

**Stay-rate data (the critical missing piece)** — share of Slovak graduates of Czech universities who remain in CZ
- No single authoritative source; must be constructed by combining:
  - DZS report data on intentions
  - Bahna (Slovak Academy of Sciences) survey: 60% of young Slovaks consider moving abroad; high proportion of Czech-graduating Slovaks don't return
  - Indirect proxy: cohort of Slovak HE entrants in CZ in year T vs Slovak working-age population in CZ in year T+5

### 3.1 UN DESA International Migrant Stock 2024 ★ CORE for Section 3

- **URL:** https://www.un.org/development/desa/pd/content/international-migrant-stock
- **Coverage:** 233 countries/areas, bilateral (origin × destination), 1990 → 2024
- **Frequency:** every ~5 years (1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024)
- **Format:** Excel workbooks
- **Definition:** "Foreign-born" (place of birth), with citizenship fallback for countries lacking POB data
- **Key tables to download:**
  - Table 1: Migrant stock at mid-year by sex and by region/country of destination AND origin
  - Table 2: Total population at mid-year
  - Table 3: Migrant stock as % of population

**Limitation:** doesn't include education or age breakdown — for that, use DIOC.

### 3.2 OECD DIOC (Database on Immigrants in OECD Countries) ★ CORE for Section 3

- **URL:** https://www.oecd.org/en/data/datasets/database-on-immigrants-in-oecd-countries.html
- **DIOC-E (extended to non-OECD destinations):** https://www.oecd.org/en/data/datasets/database-on-immigrants-in-oecd-and-non-oecd-countries.html
- **Reference years:** 2000/01, 2005/06, 2010/11, 2015/16, 2020/21
- **Format:** Stata, CSV bulk download
- **What it gives you:** for each origin × destination, breakdowns by sex × age × education × labour-force status × occupation × sector × duration of stay

This is the gold standard for **education-stratified emigration**.

### 3.3 OECD International Migration Database — annual flows

- **URL:** https://stats.oecd.org → International Migration
- **Coverage:** annual flows to OECD destinations by country of origin (citizenship)
- **Time:** 2000–latest
- **Frequency:** annual
- **Reports:** International Migration Outlook annual report (latest: 2025 covering 2024 data)
  - Slovak Republic country chapter: https://www.oecd.org/en/publications/2025/11/international-migration-outlook-2025_355ae9fd/full-report/slovak-republic_eb8278f9.html

### 3.4 Eurostat ★ CORE for Sections 2 and 3 EU cuts

- **API:** https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/{dataset_code}/...
- **Bulk download portal:** https://ec.europa.eu/eurostat/web/main/data/database
- **Format:** SDMX, TSV, JSON, CSV
- **License:** open

**Key tables:**

| Code | Title | Use |
|---|---|---|
| `migr_pop1ctz` | Population by citizenship, sex, age | Slovaks in each EU country |
| `migr_pop3ctb` | Population by country of birth, sex, age | Slovak-born in each EU country |
| `migr_imm1ctz` | Immigration by citizenship | Annual flows |
| `migr_emi1ctz` | Emigration by citizenship | Annual outflows from SK |
| `educ_uoe_mobs02` | Tertiary students from abroad by country of origin | Slovaks studying in EU |
| `lfst_r_lfu3rt` | Regional unemployment | SK regional drivers |
| `nama_10r_3gdp` | Regional GDP | SK regional drivers |
| `edat_lfse_01` / `_02` | Education indicators | Composition |

### 3.5 Migration Policy Institute Data Hub

- **URL:** https://www.migrationpolicy.org/programs/data-hub
- **Use:** pre-rendered visualisations of UN DESA data
- **Bilateral chart:** https://www.migrationpolicy.org/programs/data-hub/charts/immigrant-and-emigrant-populations-country-origin-and-destination

### 3.6 World Bank Global Bilateral Migration Database

- **URL:** https://data.worldbank.org → Bilateral Migration Matrix
- **Coverage:** 1960–2020, decennial
- **Format:** Excel
- **Use:** historical context for diaspora visualisation (pre-1990 fills gap UN DESA doesn't cover)

---

## Tier 4 — Geographic boundaries

### 4.1 Slovakia administrative boundaries

- **Free, immediate (GitHub):** https://github.com/drakh/slovakia-gps-data
  - GeoJSON for country, kraj, okres in WGS84 / Web Mercator
- **Official source (Slovak Geoportal):** https://www.geoportal.sk/sk/zbgis_smd/na-stiahnutie/
  - Shapefiles, GeoJSON
- **For obec-level shapes:** OpenStreetMap via Overpass API; or commercial dataset (Geolocet)

### 4.2 Czech regional boundaries

- ČSÚ provides them: https://csu.gov.cz/open-data
- Or use Natural Earth via geopandas

### 4.3 World country boundaries

- Natural Earth 10m / 50m via geopandas — for Section 3 world map
- Or `world-atlas` npm package for D3

---

## Tier 5 — Notable people (Section 4)

These aren't datasets per se — they're qualitative narrative cards. Sources:

- **Wikipedia categories:** `Category:Slovak emigrants`, `Category:People from Bratislava`, `Category:People from Košice`
- **Slovak Academy of Sciences alumni working abroad** — SAIA database https://www.saia.sk
- **Vilcek Foundation prize winners** — Slovak-American science laureates: https://www.vilcek.org
- **ERC grant database** filtered for Slovak nationality based outside SK: https://erc.europa.eu
- **Press interviews** specifically capturing the "why I left" testimony — Denník N, SME, Aktuality archives
- **The Athletic Slafkovský interview Oct 2024** for his quoted criticisms

For Slafkovský specifically, the key sources are:
- The Athletic interview by Arpon Basu (Oct 8, 2024) — paywalled but widely quoted
- Hockey Slovakia response (Šport.cz)
- Marián Gáborík rebuttal (Boris a Brambor podcast)

---

## Storage estimate

| Source | Approximate size |
|---|---|
| DataCube all migration/population tables | ~50 MB compressed CSV |
| Census 2021 hyperkocky | ~200 MB |
| UPSVAR / IZ Bratislava LAU1 | ~20 MB |
| ČSÚ Foreigners | ~30 MB |
| UN DESA bilateral | ~10 MB |
| OECD DIOC (all rounds) | ~150 MB |
| Eurostat tables | ~30 MB |
| World Bank bilateral | ~5 MB |
| Boundaries (GeoJSON multi-scale) | ~80 MB |
| Notable people text + photos (if used) | ~5 MB |
| **Raw total** | **~580 MB** |
| **Processed/derived parquet** | **~150 MB** |

Well under 1 GB. Storage-everything strategy is fine.

---

## Known data gaps that will need methodological caveats

1. **Census undercount.** `unverified` The "~300k" has no derivation and traces to the illustrative example in `07-editorial-content.md`. Slovaks not appearing in Slovak registers (commuters, weekly migrants, unreported emigrants) is a real phenomenon but the magnitude is unestablished. Display the Czech-side count alongside Slovak emigration register figures to flag the discrepancy.

2. **Pre-1993 ambiguity.** Slovak-born people abroad before 1993 are often coded as Czechoslovak in destination censuses. Display "Slovak / Czechoslovak born" merged for time series pre-2000.

3. **Student-vs-permanent ambiguity.** Slovak students in Czech universities often maintain official residence in SK throughout their studies and only some of them register the move with Slovak authorities. This means:
   - Eurostat `educ_uoe_mobs02` (sourced from destination universities) is the most reliable source for student-pathway counts
   - ŠÚ SR "Zahraničné sťahovanie" significantly undercounts student-pathway emigration
   - When showing total Slovak emigration to CZ, the student-pathway must be added explicitly rather than relying on Slovak-register data alone
   - The "did this person actually leave SK or are they just commuting for studies" question has no clean answer; show both interpretations side by side

4. **Stay-rate is partly modelled.** No source directly tracks "Slovak who got Czech university degree in year T, where are they in year T+5". The stay-rate metric must be constructed by combining stock at T+5 with cumulative graduate counts and reasonable assumptions about other inflows. Mark it clearly as a derived metric with confidence intervals where possible.

5. **Education timing.** Census 2021 captures education *as of 2021*. For 2004–2020 we have to interpolate using Eurostat LFS regional estimates (`edat_lfse_*` tables) — interpolation will be linear with explicit "estimated" flag.

6. **Internal migration flows below kraj level.** DataCube's obec-to-obec O-D matrix is huge (2891 × 2891 = 8.4 million cells × annual = unmanageable). Strategy: aggregate to okres-to-okres (79 × 79 = 6,241 cells) for default display; obec-resolution only as drill-down on a single selected obec.

7. **STEM vs non-STEM filter.** Field-of-study data only exists in:
   - DIOC (5-year snapshots)
   - Czech MŠMT for Slovak students in CZ (annual, by faculty)
   - Eurostat UOE for mobility flows (annual, by ISCED-F field)
   - 2021 Census (point-in-time)
   Don't promise a continuous time series for this filter for non-EU destinations.

8. **Slovak-identified abroad.** US census records ancestry; UK census records national identity; many countries don't ask. Display only where data exists, hide elsewhere with a tooltip explaining the gap.

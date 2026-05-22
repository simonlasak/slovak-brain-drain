# Slovak Brain Drain Case Study — Research Architecture

## The unifying thread

Every section follows the same protagonist: **an educated Slovak person**, traced through their life trajectory. The cross-cutting filters at the top of the site propagate into all three interactive sections (Section 4 is a static narrative dashboard):

- **Definition of "educated"** — toggle between:
  - Tertiary education (university degree, ISCED 5-8)
  - Tertiary + complete secondary with maturita (ISCED 3+ + 5-8)
  - By field (STEM vs other) — limited availability
- **Age bracket** — default 25–44 (post-graduation, pre-retirement), togglable: 18–24, 25–34, 35–44, 45–64
- **Definition of "Slovak"** — Slovak-born / Slovak-citizen / Slovak-identified
- **Net vs gross** — include immigrant inflow as offset, or just look at outflows
- **Time window** — 2004–latest (default 2010 onwards for cleanest comparability)

## The four sections

### Section 1 — Internal Slovakia: where does talent concentrate before anyone leaves?

**Question.** Before Slovaks leave the country, how does educated talent already redistribute geographically inside Slovakia? Which cities are net winners, which are net losers?

**Geographic unit.** Three-tier zoom:
- Kraj (8 regions) — default
- Okres (79 districts) — second tier
- Obec (~2,891 municipalities) — only on deep zoom, with selected indicators

**Core metrics.**
- Net internal migration by age bracket
- Population change decomposition: natural change vs migration
- **Outbound tertiary mobility rate** — share of local 18-19 year olds enrolled at universities abroad (the cleanest brain-drain signal, because it's a pure decision-point at age 18)
- Stayer rate of locally-born university graduates
- Educational attainment composition over time (from census 2011 & 2021)
- Average gross wage and unemployment rate by district (drivers)
- Median age, dependency ratio (consequences)

**Headline visual.** Slovakia choropleth, animated 2004→latest, coloured by net-migration-of-educated metric. Click a region/district to drill into its trend chart and into the Sankey of where its leavers go.

**Headline finding likely to emerge.** Bratislava and its hinterland (Senec, Pezinok, Malacky) gain; Košice city gains modestly; eastern rural districts (Sobrance, Snina, Medzilaborce), Banskobystrický kraj rural, and Gemer region bleed.

---

### Section 2 — The Czech corridor: the one-directional flow

**Question.** Why does Slovak-to-Czech mobility dominate, who is moving, into what sectors, and at what life stage?

**Two co-equal pathways within Section 2.** The data should make clear that the Slovak-to-Czech flow has two distinct entry points that often connect:
- **The student pathway** — leaving SK at 18-19 for Czech university (~22,000 Slovak HE students in CZ at peak, the largest single foreign-student community in the EU)
- **The labour pathway** — leaving SK already credentialed for a Czech job (~240,000 working-age Slovaks in CZ as of 2023)
The two pathways connect: a large share of labour-pathway Slovaks entered via the student pathway and stayed after graduating. The "stay-after-graduation rate" is itself a key metric.

**Geographic unit.**
- Slovak side: kraj of origin (where available) and okres of origin
- Czech side: kraj of destination

**Core metrics.**
- Stock of Slovak citizens in Czechia 2004–latest (ČSÚ register data)
- Annual flow of Slovak immigrants to Czechia (ČSÚ + OECD)
- Slovak students in Czech universities by year, by field, by university (MŠMT/DZS data) — full annual time series
- Stay-rate of Slovak Czech-university graduates (% remaining in CZ 1, 3, 5 years post-graduation)
- Slovak workers in Czechia by economic sector (NACE) — ČSÚ Foreigners report
- Wage differential SK vs CZ over time, by industry (ŠÚ SR pr0205qs + ČSÚ counterpart)
- Return rate (proxy via change in stock minus new flow)
- Age structure of Slovak residents in Czechia (ČSÚ 2021 Census)

**Headline visual.** Two parallel Sankeys, switchable:
- *Student view:* Slovak okres of origin → Czech university city → faculty/field
- *Labour view:* Slovak okres of origin → Czech kraj of destination → Czech sector of employment
With a connecting bridge visual showing what share of student-pathway Slovaks transition into the labour pathway.

**Headline finding likely to emerge.** The flow is overwhelmingly young (18-34), enters via universities in Prague and Brno, and roughly two-thirds of Slovak graduates of Czech universities stay in CZ rather than returning to SK. The labour pathway is largely the downstream consequence of the student pathway, not a separate phenomenon.

---

### Section 3 — Global diaspora

**Question.** Where do Slovaks end up worldwide, and how does the picture change depending on how we define "Slovak"?

**Geographic unit.** Destination country (~200 countries from UN DESA), bilateral.

**Core metrics.**
- Stock of Slovak-born / Slovak-citizen / Slovak-identified per destination, 1990–2024 (UN DESA bilateral + OECD DIOC + destination-country censuses)
- Education profile of emigrants (OECD DIOC, 5-year snapshots)
- Top destinations and their trajectories over time
- Comparison: gross outflow vs net (include third-country nationals coming to SK as offset)

**Headline visual.** Interactive world heatmap, switchable between the three definitions of Slovak. Bubble overlay sized by absolute count. Time slider 1990–latest. Side panel shows education profile of the diaspora in selected country.

**Critical caveats** (display prominently):
- "Slovak-born" before 1993 includes anyone born in Slovak territory but counted as Czechoslovak abroad — definitional mess
- "Slovak-identified" in US census peaks around 700k–800k but mostly reflects 1880s–1948 emigration waves, not current outflows
- "Slovak-citizen" is the cleanest modern measure but misses dual-citizens and those who naturalised

---

### Section 4 — Notable departures (static narrative dashboard)

**Question.** Who are the most impactful Slovak-born individuals shaping the world from outside Slovakia, and what drove their departure?

**Pattern to surface explicitly.** A strikingly large share of high-impact Slovak-born individuals left *before* tertiary education, not after. Karpathy: 15. Slafkovský: 15. Lowy: 16. The "left as a teenager because the family relocated, or to access better training abroad" pattern is the modal high-impact emigration story — not the "completed Slovak degree, then emigrated" pattern. The dashboard should make this visible through an age-at-leaving distribution chart at the top of the section.

**Selection criteria** (as agreed):
- Globally famous OR high-impact in their field
- Less known for being Slovak — the "wait, they were Slovak?" effect
- Made impact primarily outside Slovakia
- Not currently active in Slovakia
- Sports figures included sparingly and only when they fit the brain-drain narrative (Slafkovský yes; most others return)

**Format.** Card-per-person with: name, birth year/place, when left, **age at leaving (prominently displayed)**, **whether they had Slovak tertiary education before leaving** (a binary tag), destination(s), field, the trigger (where known), the impact, a short narrative paragraph.

**Initial candidate longlist** (for your review before final selection):
- Andrej Karpathy — AI (b. 1986 Bratislava, left 2001 age 15 to Toronto, family migration)
- Juraj Slafkovský — ice hockey (b. 2004 Košice, left 2019 age 15 to Finland, openly critical of SK federation 2024)
- Frank Lowy — retail magnate / Westfield (b. 1930 Fiľakovo, left during WWII, billionaire)
- Hugh David Politzer — physicist, Nobel 2004 (Slovak ancestry, born US — likely too distant)
- Marek Rosa — game dev / AGI (b. Bratislava, founder GoodAI Prague, Keen Software House)
- Ján Vilček — biomedical scientist (b. 1933 Bratislava, NYU professor, Vilcek Foundation supporting immigrant scientists)
- Štefan Banič — parachute inventor (b. 1870 Smolenice, emigrated 1907 to USA)
- Jozef Murgaš — wireless telegraphy pioneer (b. 1864 Tajov, emigrated to Pennsylvania)
- Maximilián Hell — astronomer at Vienna observatory (b. 1720)
- Add 5-10 more in the deep-research phase

**To find more candidates, search:**
- ERC grant recipients of Slovak nationality based abroad
- Slovak-born Y Combinator / Sequoia founders
- Slovak-born tenured professors at top-50 universities (LinkedIn + university directories)
- Slovak diaspora awards (Vilcek Prize, etc.)

---

## Cross-section data joins

Sections share these reference dimensions, so the database schema needs consistent codes:

- **Geographic codes:** NUTS3 (kraj), LAU1 (okres), LAU2 (obec) for SK; NUTS3 (kraj) for CZ; ISO-3166 alpha-3 for international destinations
- **Time:** annual, ranging 1990–latest (sections differ in start year)
- **Age bracket:** 5-year cohorts (15-19, 20-24, …, 65+)
- **Education:** ISCED 1997 then ISCED 2011 (with crosswalk)
- **Sex:** male/female
- **Industry:** NACE Rev. 2 (4-digit for finest, but rolled up to A-U sections for display)

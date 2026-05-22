# Slovak Brain Drain Case Study

## What this is

A deep-research data project exploring brain drain from Slovakia, designed as an interactive case-study website with three interactive sections and one narrative dashboard.

## What's in this folder

- `docs/01-research-architecture.md` — the high-level structure: four sections, shared filters, the unifying thread
- `docs/02-data-manifest.md` — every dataset, endpoint, format, license, and storage estimate
- `docs/03-methodology.md` — definitions (Slovak-born vs citizen vs identified), interpolation strategy, display honesty principles, the Slafkovský caveat
- `docs/04-spec.md` — the Claude Code agent handoff: tech stack, pipeline stages, feedback loop, definition of done
- `docs/05-design.md` — the locked design system: fonts, color palette, spacing, components, folk motif system, data viz styling
- `docs/06-sources-page.md` — full specification of the /methodology page: dataset register, metric derivation log, interpolation register, cross-validation log, confidence grid, downloadable data, the sources_report.json schema that the pipeline generates and the frontend renders

## How to use this

Hand the entire `docs/` folder to a Claude Code agent in a fresh session, along with this prompt:

> Read docs/01 through docs/06 in order — all six files. Then ask me your Stage 0 questions from docs/04-spec.md before doing anything else. Do not write any code, fetch any data, or create any files until I have confirmed the tech stack and answered your pre-flight questions.

The agent will work through the stages with explicit human-in-the-loop checkpoints documented in `feedback/checkpoints.md` (it will create this file itself).

## Headline findings the data should support

Based on the research conducted, the following findings are likely (but not guaranteed) to emerge once the data is built out. They are NOT to be assumed in the visualisations — the data needs to confirm them first:

1. **Inside Slovakia**, Bratislava + its hinterland (Senec, Pezinok, Malacky) are net winners of educated talent; eastern Slovakia (Prešov region, Košice rural, Gemer) is the biggest loser, with Banskobystrický kraj rural close behind.

2. **The Czech corridor** is not really "emigration" in the classical sense — it functions as a structural extension of the Slovak labour market into a higher-wage jurisdiction, dominated by 20-34 year olds in IT, healthcare, and manufacturing.

3. **The student pathway** is the dominant entry point — ~17-18% of Slovak HE students study abroad (vs EU average ~4%), most in Czechia, and many never return. The 18-year-old leaving for Charles University is the central brain-drain story, not the post-graduation emigrant.

4. **The diaspora picture** depends sharply on which definition of "Slovak" you use. By citizenship, the diaspora is concentrated in EU (CZ, DE, AT, UK). By ancestry, it's concentrated in the US and reflects 1880-1948 waves rather than current outflows. By place of birth, it's somewhere in between.

5. **Modern departures** (post-2004) skew young, educated, and disproportionately STEM. Family migration (the Karpathy case) and structural failure of domestic institutions (the Slafkovský case) are both visible drivers. Many high-impact emigrants left as teenagers, before completing Slovak tertiary education.

## Status of this document

This `docs/` package is the result of a focused research and design session that systematically mapped:

- Slovak primary sources (ŠÚ SR DataCube API confirmed working, Census 2021, UPSVAR, SLK)
- Czech primary sources (ČSÚ open data, MŠMT student data, Foreigners publications)
- International sources (UN DESA, OECD DIOC, Eurostat, World Bank)
- Geographic boundaries (Geoportal SK, GitHub mirrors)
- Notable-people candidates (initial longlist of 10)
- The visual identity and design system (Folk-modern direction, fully specified)

No data has actually been fetched yet, and no code has been written — those are Stages 1+ of the agent's work. The docs tell the agent exactly where to look and what the output should feel like.

## Decision log

Decisions made during the research and design sessions that informed these specs:

**Research scope:**
- **Time window:** Post-2004 (EU accession onwards) — clean data and policy-relevant era
- **Geographic resolution:** Kraj/okres default, obec on zoom
- **Education filter:** All three definitions (tertiary, tertiary+maturita, by field) as toggleable filters
- **Student emigration:** Treated as a first-class pathway (not a sub-pattern) — Section 1 has an outbound tertiary mobility metric; Section 2 has co-equal student and labour pathways
- **Storage:** No limit, store everything (~580 MB raw, ~150 MB processed)
- **Notable people:** Globally famous + impactful, less known for being Slovak, mostly non-athletes; Slafkovský included as a critical counter-example

**Design:**
- **Direction:** Folk-modern — editorial gravitas grounded in subtle Slovak visual heritage (Čičmany geometric primitives used functionally, never decoratively)
- **Type:** Source Serif 4 (headlines) + Pangram Sans (UI) + JetBrains Mono (numbers) — all chosen for excellent Slovak diacritic rendering
- **Color:** Cream `#FBF7F0` background, terracotta `#B83A1F` primary, Tatra blue `#2A6B8B` secondary, harvest gold `#D4A547` tertiary
- **Data viz stack:** deck.gl + Maplibre + visx + Framer Motion + GSAP + Scrollama — Vega-Lite explicitly removed
- **Bilingual:** Slovak primary headings, English subtitles in lighter weight

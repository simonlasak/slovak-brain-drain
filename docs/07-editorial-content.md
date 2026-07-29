# Editorial Content Specification

> **Numeric claim convention.** Every numeric figure in this document carries a
> status marker: `verified` (reproducible, source named), `unverified` (plausible
> but not reproduced here), or `illustrative` (a placeholder showing format, NOT
> a measurement). **A figure with no marker is unusable.** Introduced July 2026
> after an illustrative 300,000 in `07-editorial-content.md` escaped into the
> landing page as fact.


The interactive maps and charts are necessary but not sufficient. This project is a piece of data journalism, not a dashboard. Every section needs analytical prose that explains why the data matters, how it was sourced, what the surprising finding is, and what the limitations are.

The reference standard is articles like the Slovak Ministry of Education's piece on student return rates (minedu.sk), serious newspaper data investigations (FT, NYT, Reuters), and the long-form pieces on The Pudding. Not corporate dashboards, not marketing copy.

## Where editorial content appears

### Landing page (`/`)

A single-page introduction to the entire project. Roughly 800–1,200 words of prose. Slovak primary, English subtitle/translation toggle.

Structure:

1. **Opening hook** (one paragraph). The most surprising single finding from the data, stated plainly.

   > **ILLUSTRATIVE PHRASING ONLY, THE NUMBER IS NOT A FINDING.** `illustrative`
   > The example below escaped this document and became the hardcoded landing-page
   > hero (HeroCounter.tsx), then acquired a derived "one in 18" ratio, then was
   > reframed as a stock in §1 prose. No source was ever attached to it. Do not
   > lift a figure from this file into copy.

   Example shape: "Slovakia has lost more than [N] people to emigration since EU
   accession, a figure the official Slovak statistics undercount because most
   movers never deregister."

2. **Why this project exists** (one paragraph). What question prompted the work. Honest about author motivation.

3. **What you'll find** (one paragraph per section, four total). A sentence or two introducing each section's question and the headline finding, with a link to that section.

4. **Methodology in one line** (short paragraph). Where the data comes from, link to /methodology for full sourcing.

5. **A "how to read this site" note** (short). Filters, definitions, data confidence ratings.

### Section pages (`/internal`, `/corridor`, `/diaspora`)

Each section page has prose interleaved with the interactive elements, not isolated above or below.

Structure per section:

1. **Section opening** (200–300 words, prose, no charts). The question the section answers, the headline finding, the framing the reader needs to understand the visualisations that follow.

2. **First visualisation** with caption (1–2 sentences below it explaining what the reader is looking at).

3. **Analytical bridge paragraph** (100–200 words). Why this matters, what the pattern suggests, what to look for in the next visualisation.

4. **Second visualisation** with caption.

5. **Analytical bridge paragraph**.

6. (Continue alternating for as many visualisations as the section has)

7. **Section conclusion** (150–250 words). What this section establishes, what limitations the reader should keep in mind, what to look for in the next section.

Approximate total length per section: 800–1,200 words of prose, interleaved with 3–5 visualisations.

### Section 4 (`/people`)

This is already a narrative-driven section. Each notable-person card has its own narrative paragraph already specified in the schema. Add:

1. **Section opening** (200–300 words). The framing: who counts as "notable", why we restrict to post-1993 departures, the age-at-leaving pattern that emerges.

2. **The age-at-leaving histogram** with caption.

3. **The person cards** as already specified.

4. **Section conclusion** (150–250 words). What the pattern of departures tells us beyond the individual stories — the structural failures (Slafkovský's federation critique), the family migrations (Karpathy), the return cases (Tkáč).

### Methodology page (`/methodology`)

Already specified in `06-sources-page.md`. Has an introduction paragraph; the rest is structured tables and registers. No additional editorial copy needed there.

### Resources & counter-currents page (`/resources`)

The site's natural closing destination. A short version appears at the bottom of the landing page; the full version lives at its own route. The purpose is threefold:

1. Surface concrete resources for readers who now want to engage with the question (the slovaks.ai pattern — curated, annotated, opinionated)
2. Acknowledge the people and institutions working against the drain (the Tkáč return case writ large, with named examples)
3. Give the reader a "what now" — something to click, support, nominate, contribute to

Brain drain as a subject tilts grim. An ending that names the counter-currents makes the whole piece more honest, not less serious. The reader walks away with somewhere to go, not just somewhere they've been.

**Structure of the `/resources` page (~600 words of prose + structured links):**

1. **Opening paragraph** (150 words). The framing: the data shows real loss, but the picture is not uniformly grim. Throughout the research, the same names of institutions and individuals working against the drain kept surfacing. This section collects them.

2. **Useful links** (the slovaks.ai category). Curated, annotated, opinionated, not exhaustive. Each link gets one sentence explaining what it actually does and why a reader following this topic would care. Group into:
   - **Diaspora maps and networks** (slovaks.ai, KInIT Slovak Diaspora Project, regional Slovak-American organizations where relevant)
   - **Return programs and reverse-drain initiatives** (Návraty, ESET Science Award, EU Marie Curie reintegration grants used by Slovak researchers)
   - **Slovak research institutions actively countering drain** (KInIT, Slovak Academy of Sciences specific programs, SAIA)
   - **Investigative journalism that covers this story** (Denník N, Forbes Slovensko, SME features — link to specific recurring authors who cover the topic, not just publication homepages)
   - **Academic studies and reports** (IVP outbound mobility estimates, SAV sociology research, Bahna's work specifically)

3. **Counter-currents** (200 words of prose + 4-6 named examples). Specific cases that complicate the brain drain story. Not abstract optimism. Examples:
   - The Tkáč return case (already in notable_people.json as the return contrast)
   - KInIT itself (institute that didn't exist five years ago, now a serious AI research center in Bratislava — Mária Bieliková's project)
   - The Bratislava IT cluster (ESET, Sygic, Innovatrics, Pixel Federation, Vacuumlabs, Slido — Slovak tech built and headquartered at home, the counter-finding to Section 4)
   - Slovak academics returning with EU funding (specific named cases where surfaced)
   - Any institutional initiatives discovered during research

4. **A "what now" closing paragraph** (100 words). Concrete actions: nominate someone for the ESET Science Award (with link), suggest an addition to slovaks.ai, support a Slovak research institute, send the underlying data to a Slovak journalist who covers this beat. End with: the data on this site is CC-BY 4.0 and you can use it.

**Landing page closer (~150 words + 4-5 links).** A condensed version of the above that lives at the bottom of `/`. Two sentences acknowledging counter-currents, then 4-5 curated links with one-sentence annotations, then a link to the full `/resources` page.

**How the agent assembles this content:**

Resource discovery happens *during* the research and writing, not as a separate phase at the end. As the agent works through Stages 1-4, it should maintain a running file at `data/raw/notable_people/counter_currents.json` where it logs:

- Any Slovak institution, NGO, government program, or initiative actively working to retain or attract talent that surfaces in research
- Any Slovak journalist whose byline appears repeatedly on diaspora/brain-drain stories
- Any return-migration case beyond Tkáč that comes up in source materials
- Any academic researcher whose work is cited multiple times in the sources used

The criterion for inclusion is the same as everywhere else: verifiable, attributable, currently active. Every link must be checked at write time — dead URLs and abandoned projects get cut. Every claim about an institution needs at least one independent source (the institution's own website does not count alone).

When the agent reaches Stage 4 frontend writing, this accumulated file becomes the raw material for the `/resources` page. If the file is thin, the page is short. Better a focused 4-link list than a padded 20-link directory.

**What the resources page is NOT:**

- A startup directory (we are not listing every Slovak tech company)
- A "Slovakia is great actually" disclaimer that softens the data
- A donations or signup section
- Social media follow buttons
- A "Slovakia ranks Xth on [feel-good index]" factoid
- A government tourism promotion

The tone matches the rest of the site: serious, specific, restrained. The reader should finish this page with names of real people doing real work, not a warm glow.

## How the content is produced

The agent drafts; Šimon edits.

**Draft generation rules:**

1. The agent writes the first draft of every piece of editorial content based on the actual data findings — never on guessed or assumed findings. Every claim must be traceable to a row or query in the processed parquet files.

2. Drafts are written in a serious editorial register: plain language, no marketing tone, no rhetorical flourishes, no exclamation marks. Read like FT or Denník N, not like a startup blog.

3. Every statistic mentioned in prose is cross-referenced to the chart it appears in (use the same number; if the chart shows 240,000 the prose says 240,000, not "almost a quarter million").

4. Avoid the words "shocking", "surprising", "alarming", "stunning" — let the numbers speak. Avoid first-person ("I think") and second-person rhetorical questions ("Did you know?").

5. Use specific examples, not abstractions. "A doctor in Prešov earns 60% of what a Czech equivalent earns in Brno" beats "wages are lower in Slovakia."

6. The em-dash rule already in memory applies: no em-dashes (—) in any prose. Use commas, parentheses, or rewrite the sentence.

**Šimon's editing role:**

After the agent produces a draft, Šimon edits for voice, accuracy of nuance, and Slovak-language fluency in the bilingual version. The agent does not commit any editorial copy without explicit Šimon approval. This is the same human-checkpoint discipline as everything else in the project.

## Format and storage

All editorial copy is stored as MDX files (Markdown with embedded React components).

Directory structure:

```
frontend/src/content/
├── landing.{sk,en}.mdx           # The / page content
├── sections/
│   ├── internal.{sk,en}.mdx      # /internal section copy
│   ├── corridor.{sk,en}.mdx      # /corridor section copy
│   ├── diaspora.{sk,en}.mdx      # /diaspora section copy
│   └── people.{sk,en}.mdx        # /people section copy
├── resources.{sk,en}.mdx         # /resources page (curated links + counter-currents)
└── methodology.{sk,en}.mdx       # /methodology intro
```

MDX lets the agent place chart components inline:

```mdx
The pattern is starkest in eastern Slovakia.

<ChoroplethSK metric="net_migration" year={2024} />

The four districts losing the most working-age residents share a profile:
poor rail and road connections to Bratislava, declining heavy industry, and
the lowest average wages in the country.
```

## Bilingual handling

Slovak primary, English secondary. Implementation:

- Each `.mdx` file has a Slovak-language sibling: `landing.sk.mdx` and `landing.en.mdx`
- A locale toggle in the header switches between them
- The agent writes the English version first (its strongest writing language), then translates to Slovak as a second draft
- Šimon polishes the Slovak version since he is the native speaker

The agent should **never publish a Slovak draft without Šimon's review** — automated translation will be subtly wrong in tone, and the audience is Slovak readers who will notice.

## Word count guidance per section

| Section | English | Slovak | Charts |
|---|---|---|---|
| Landing page | 800–1,200 | 800–1,200 | 2 summary visuals |
| §1 Internal Slovakia | 800–1,200 | 800–1,200 | 4–5 |
| §2 Czech corridor | 800–1,200 | 800–1,200 | 4–5 |
| §3 Global diaspora | 800–1,200 | 800–1,200 | 3–4 |
| §4 Notable departures | 600–900 | 600–900 | 1 + cards |
| Resources & counter-currents | 600 | 600 | structured links |
| Methodology | 200 intro only | 200 intro only | (structured tables) |
| **Total** | **~5,600 words** | **~5,600 words** | ~17 charts |

Roughly the length of a Sunday newspaper feature in each language. Substantial enough to be a real read; not so long that nobody finishes it.

## What this is NOT

- Not a blog. There's no "latest posts" feed, no comments, no dates on individual pieces. The editorial content is integrated with the data exploration.
- Not marketing. No CTAs, no sign-ups, no "subscribe" prompts.
- Not opinion. The prose interprets the data but does not advocate for specific policies. The site presents what is, not what should be.
- Not exhaustive. We are not trying to cover every aspect of Slovak demography — only the brain drain question. Stay disciplined to scope.

## Drafting workflow for Claude Code

When Stage 4 (frontend) begins, before writing any React component for a section:

1. Read the parquet files for that section
2. Identify the 4-6 most significant findings (the patterns that would surprise an informed Slovak reader)
3. Draft the section opening, bridge paragraphs, and conclusion in English MDX
4. Insert chart component placeholders at the right narrative beats
5. Submit the draft to Šimon for review
6. After Šimon approves the English, translate to Slovak
7. Submit the Slovak draft for Šimon's polish
8. Only after both languages are approved, build the chart components themselves

This means the prose drives the chart selection, not the other way around. The question "what visualisation makes this paragraph land?" produces better charts than "what charts can we build from this data?"

import type { Locale } from '../lib/locale';
import type { SourcePanel } from './internal';

/**
 * Section 2 (/corridor) bilingual content.
 *
 * Single render source for all Section 2 prose, subheads, stat callouts, chart
 * captions, map/chart labels, and the source metadata behind each "About this
 * data" panel. Mirrors the structure of src/content/internal.ts, which is the
 * pattern for every section. It supersedes
 * src/content/sections/corridor.en.md as the render source (MDX cannot
 * interleave the year-stepped map + charts inside JSX cleanly).
 *
 * English (`en`) is authoritative: the prose here is the copy Simon approved,
 * lifted out of Section2App.tsx where it had been hardcoded.
 *
 * Slovak (`sk`) is a STUB awaiting Simon's authoring. Its `reviewed` flag is
 * false and every string still holds the English text as a fallback so the
 * toggle works today. Per the project workflow rule, no machine-translated
 * Slovak is published: while `reviewed` is false the page shows a notice that
 * the Slovak translation is in progress and renders the English text.
 *
 * To localise: translate the strings below in `sk`, then set
 * `sk.reviewed = true`. Search this file for `TODO(sk)` for the checklist.
 */

export interface Section2Content {
  reviewed: boolean;
  /** Shown as a slim banner when an unreviewed locale is active. */
  translationNotice: string;

  eyebrow: string;
  h1: string;

  intro: string[];
  callout1: { value: string; label: string };

  sub1: string;
  caption1: string;
  bridge1: string[];
  callout2: { value: string; label: string };

  sub2: string;
  bridge2: string[];

  sub3: string;
  caption3: string;
  bridge3: string[];

  sub4: string;
  callout3: { value: string; label: string };
  bridge4: string[];
  /** Labels for the stay/return/elsewhere survey split. */
  stayLeave: { stay: string; return: string; other: string; caption: string };

  sub5: string;
  bridge5: string[];

  sub6: string;
  closing: string[];

  /** Labels rendered inside the year-stepped Czech regions map. */
  map: {
    eyebrow: string;
    totalSuffix: string;
    tooltipUnit: string;
    sinceLabel: string;
    scrollHint: string;
  };

  /** Series names for the multi-line stock chart. */
  stockSeries: { all: string; labour: string; student: string };
  /** ISCED level names for the student breakdown chart. */
  studentLevels: { ED6: string; ED7: string; ED8: string };

  sources: {
    map: SourcePanel;
    stock: SourcePanel;
    student: SourcePanel;
    stayLeave: SourcePanel;
  };

  /** Reusable label for the "About this data" trigger. */
  aboutLabel: string;
}

const en: Section2Content = {
  reviewed: true,
  translationNotice: '',

  eyebrow: '§2 · Czech Corridor',
  h1: 'The Czech Corridor',

  intro: [
    'Two Czech statistical registers count Slovaks in Czechia, and they arrive at different totals. The foreigners’ residence register (ČSÚ CIZ002/CIZ003) recorded 125,280 Slovak citizens with a registered address in Czechia as of early 2025. The labour registry (ČSÚ CIZ03) recorded 240,297 Slovaks as economically active in Czechia in 2023. The gap reflects the nature of the corridor itself: under EU free movement, a Slovak citizen can work in Czechia on a Czech employment contract while maintaining official residence in Slovakia. Tens of thousands do, particularly along the Moravian border. Neither number is wrong. The residence figure counts people who live in Czechia. The labour figure counts people who work there. Together they describe a corridor where the boundary between "living abroad" and "commuting to a better-paying job" has dissolved for a significant share of the Slovak workforce.',
    'This corridor did not emerge in a surge. Both figures accumulated over two decades of stable departures, roughly 6,000 to 7,000 new arrivals per year since EU accession in 2004. The two countries share a language boundary so low it barely registers, mutual recognition of qualifications, and seventy-four years of shared institutional history. What the data describes is the internal extension of the Slovak labour market into a higher-wage jurisdiction, not emigration in the classical sense.',
    'The question this section answers is not "why do Slovaks leave?" but "what happened to the ones who left for Czechia twenty years ago?" The answer, visible in both the employment stock and the age structure, is that they stayed.',
  ],
  callout1: { value: '240,297', label: 'Slovaks economically active in Czechia, 2023' },

  sub1: 'Accumulated, not surged',
  caption1: 'Slovaks in Czechia by pathway, 2015 to 2024. src: ČSÚ CIZ003T003 (residence), CIZ03 (labour), Eurostat educ_uoe_mobs02 (students).',
  bridge1: [
    'The labour stock reached 240,297 in 2023: 216,239 on standard employment contracts and 24,058 operating as self-employed holders of a Czech trade licence. Growth from 164,710 in 2015 to 240,297 in 2023 represents a 46 percent increase over eight years, driven almost entirely by the retention of existing residents rather than acceleration of new arrivals. OECD annual inflow data confirms that the rate of new Slovak arrivals to Czechia has remained stable at approximately 6,000 to 7,000 per year throughout this period. The residence-registered population grew more slowly, from 101,589 in 2015 to 125,280 in 2025 (23 percent), suggesting that a portion of the labour growth came from Slovaks formalising work arrangements without changing their registered address.',
  ],
  callout2: { value: '+76%', label: 'Growth in Jihomoravský kraj, 2015 to 2025' },

  sub2: 'Where the growth went',
  bridge2: [
    'The geographic distribution has not been static. Praha held the largest absolute concentration in 2025 with 33,459 registered Slovaks, but Jihomoravský kraj, centred on Brno, grew fastest: from 10,677 in 2015 to 18,771 in 2025, a 76 percent increase against Praha’s 21 percent over the same decade. The Středočeský commuter belt (21,457) and Moravskoslezský (9,473), bordering northeastern Slovakia, each grew at 17 percent. At the other end, Liberecký kraj added fewer than 150 Slovaks across the entire period, a 2.6 percent change consistent with its orientation toward the German border rather than the Slovak one. Slovak settlement is following economic diversification within Czechia, not further concentration in the capital.',
  ],

  sub3: 'The student pipeline',
  caption3: 'Slovak students enrolled at Czech universities by degree level, 2013 to 2024. src: Eurostat educ_uoe_mobs02.',
  bridge3: [
    'The student pathway tells a counterintuitive story of resilience. In 2013, Eurostat recorded 24,300 Slovak students enrolled at Czech universities. By 2024, that figure stood at 22,401. An 8 percent stock decline over eleven years sounds modest, but set against demographic context it becomes remarkable: Slovakia’s 15-to-19-year-old population shrank by 37 percent between 2004 and 2019 as the post-independence birthrate collapse worked through the education system. The share of available young Slovaks choosing Czech universities has not fallen; it has risen. The pipeline contracted in absolute terms only because its source population shrank dramatically beneath it.',
    'Within the student stock, bachelor enrolment fell from 13,396 to 11,645 while master programmes held near 9,000 and doctoral numbers remained stable around 1,800. The DZS 2023 survey of international students at Czech universities reports that Slovaks most often study information and communication technologies (15 percent of Slovak respondents), natural sciences (14 percent), and social sciences, journalism and information (13 percent). These are survey proportions from the 2023 DZS report, not administrative enrolment counts, and reflect the broad field distribution rather than precise headcounts.',
  ],

  sub4: 'More than half stay',
  callout3: { value: '54%', label: 'Slovak students planning to remain in Czechia after graduating, DZS 2023 survey' },
  bridge4: [
    'This is the closest available approximation of a stay rate. More than half of each graduating cohort feeds directly into the labour corridor rather than returning to Slovakia, transforming a student flow into a permanent population increment.',
  ],
  stayLeave: {
    stay: 'Stay in Czechia',
    return: 'Return to Slovakia',
    other: 'Try another country',
    caption: 'src: DZS 2023 survey of international students at Czech universities (N approx. 3,200 Slovak respondents). Survey proportions, not administrative data.',
  },

  sub5: 'Aging in place',
  bridge5: [
    'The mean age of EU27 citizens in Czechia rose from 39.9 in 2015 to 40.9 in 2024, advancing at almost exactly one year per calendar year. This is the signature of a population aging in place rather than being refreshed by new arrivals: the same cohort that crossed the border in their twenties is now in their forties, with Czech careers and Czech mortgages.',
    // CHANGED FROM APPROVED COPY, awaiting Simon's confirmation. The previous
    // version attributed the 2021 dip to COVID-era return migration. Three
    // checks refute that:
    //   1. The Czech LABOUR register rose 2.8% in the same year (+6,286), and
    //      Slovaks cannot leave Czechia while taking more Czech jobs.
    //   2. SUSR recorded no arrivals spike; 2021 arrivals were LOWER than 2020.
    //   3. The drop hit the whole EU27 population in Czechia (-21,689, -8.9%),
    //      of which Slovaks were 45.7% while being 51.1% of the stock. It was
    //      not Slovak-specific.
    // Both countries censused in spring 2021 and both revised their registers
    // downward: Slovakia's own residual is -10,511 in the same year. So the
    // cause is a census re-basing, not behaviour. What cannot be separated is
    // how much of the -9,914 is correction of people who had already left
    // quietly over previous years versus any genuine 2021 movement, because a
    // re-basing collapses years of accumulated drift into a single step. The
    // paragraph now says that rather than naming a cause.
    'One anomaly warrants annotation. In 2021 the registered Slovak population in Czechia fell 8 percent, from 124,544 to 114,630, before resuming its climb to 125,280 by 2025. The fall is a statistical correction rather than a departure: Czechia held its census in March 2021, and a residence register that has been accumulating people who left without deregistering is revised downward when a census finally counts them. Slovakia censused the same spring and corrected its own population downward by a similar order. Two signs confirm that nobody actually went home: the Czech labour register rose that year rather than falling, and Slovak authorities recorded fewer arrivals in 2021 than in 2020. What the correction cannot tell us is which years the missing people actually left in, because a re-basing compresses a decade of quiet drift into one step. The dip is marked on every time-series chart in this section and should be read as the register catching up with reality, not as a change in behaviour.',
  ],

  sub6: 'A story about gravity',
  closing: [
    'The Czech corridor is, in the end, a story about gravity. Two countries close enough in language, culture, and institutional memory that the border between them functions less like a national boundary than a commute. The 125,000 Slovaks who have registered their residence in Czechia and the 240,000 who work there represent two measures of the same long-term settlement process. What began as a student flow in the mid-2000s has become a permanent demographic feature of both countries. Slovakia’s population is smaller and older because of it. Czechia’s labour market is larger and more Slovak because of it. Neither country’s official statistics fully capture the scale, which is itself the most honest summary of how the corridor works: quietly, steadily, and mostly unremarked.',
  ],

  map: {
    eyebrow: 'Slovaks registered in Czech regions',
    totalSuffix: 'total',
    tooltipUnit: 'Slovaks',
    sinceLabel: 'since',
    scrollHint: 'scroll to advance through years',
  },

  stockSeries: {
    all: 'Residence registered',
    labour: 'Labour (economically active)',
    student: 'Students enrolled',
  },
  studentLevels: { ED6: 'Bachelor', ED7: 'Master', ED8: 'Doctoral' },

  sources: {
    map: {
      title: 'Slovaks in Czech regions',
      source: 'ČSÚ table CIZ003T003 (foreigners by citizenship and region of registered residence). Boundaries: Czech kraje (14 regions, NUTS3), simplified for web.',
      derivation:
        'Each scroll step advances one year and recolours the 14 Czech regions by the number of Slovak citizens holding a registered address there. The percentage shown against a region is its growth since the first year in the series, not an annual rate.',
      caveat:
        // CHANGED FROM APPROVED COPY, awaiting Simon's confirmation: "a COVID-era
        // artefact" replaced. Same evidence as the §2 bridge5 paragraph.
        'Registered residence only. Slovaks working in Czechia while keeping Slovak residence do not appear here, which is why the labour figure is roughly twice as large. The 2021 drop is a census re-basing of the Czech register, not a departure wave: it hit the whole EU27 population in Czechia, and the Czech labour register rose the same year. It cannot be read as movement in 2021, and it cannot be attributed to the years the departures actually happened.',
    },
    stock: {
      title: 'Slovaks in Czechia by pathway',
      source: 'ČSÚ CIZ003T003 (residence-registered), ČSÚ CIZ03 (economically active), Eurostat educ_uoe_mobs02 (tertiary students, ISCED 5-8).',
      derivation:
        'Three independently collected series plotted on one axis. Residence and labour are national totals; students are Slovak-citizen enrolments at Czech tertiary institutions. Where the 2024 labour total was not published, it is summed from the employed and self-employed categories and marked as computed.',
      caveat:
        'These series count different things and must not be added together: a single person can appear in two of them at once. The residence and labour totals diverge precisely because EU free movement decouples where you live from where you work.',
    },
    student: {
      title: 'Slovak students in Czechia by level',
      source: 'Eurostat educ_uoe_mobs02 (students by level, citizenship and country of study).',
      derivation:
        'Slovak-citizen enrolments at Czech tertiary institutions, split into ISCED 6 (bachelor), 7 (master), and 8 (doctoral), 2013 to 2024. Stacked, so the top of the stack is the tertiary total.',
      caveat:
        'Enrolment stock, not intake: a five-year student is counted five times across five years. The absolute decline reflects Slovakia’s shrinking 15-to-19 cohort rather than falling interest in Czech universities. No field-of-study split by nationality exists in the source, so this chart stays at ISCED level.',
    },
    stayLeave: {
      title: 'Post-graduation intentions',
      source: 'DZS (Dom zahraničných Slovákov) 2023 survey of international students at Czech universities, approximately 3,200 Slovak respondents.',
      derivation:
        'Self-reported intention after finishing studies, grouped into staying in Czechia (work 26 percent plus further study 27 percent), returning to Slovakia, and moving to a third country.',
      caveat:
        'Stated intention is not observed behaviour, and survey respondents are not a random sample of Slovak students. Treat 54 percent as the best available approximation of a stay rate, not a measured one.',
    },
  },

  aboutLabel: 'About this data',
};

// ---------------------------------------------------------------------------
// Slovak stub. TODO(sk): translate every string above, then set reviewed = true.
// Until then the page shows `translationNotice` and renders these (English)
// fallback values. Do NOT ship machine-translated Slovak; Simon authors this.
// ---------------------------------------------------------------------------
const sk: Section2Content = {
  ...en,
  reviewed: false,
  translationNotice:
    'Slovenský preklad tejto sekcie sa pripravuje. Zatiaľ je zobrazený anglický text.',
};

const content: Record<Locale, Section2Content> = { en, sk };

export function getSection2Content(locale: Locale): Section2Content {
  return content[locale];
}

export default content;

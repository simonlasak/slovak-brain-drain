import type { Locale } from '../lib/locale';

/**
 * Section 1 (/internal) bilingual content.
 *
 * This module is the single render source for all Section 1 prose, subheads,
 * stat callouts, chart captions, scrollytelling map step text, and the source
 * metadata behind each "About this data" panel. It supersedes
 * src/content/sections/internal.en.md as the render source (MDX cannot
 * interleave the scrollytelling map + charts inside JSX cleanly).
 *
 * English (`en`) is authoritative and approved.
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

export interface SourcePanel {
  /** Panel heading, e.g. the chart title. */
  title: string;
  /** Human-readable source line(s), e.g. "SU SR DataCube om7007rr". */
  source: string;
  /** How the displayed metric was derived from the raw source. */
  derivation: string;
  /** Honest caveat / limitation the reader should keep in mind. */
  caveat: string;
}

export interface Section1Content {
  reviewed: boolean;
  /** Shown as a slim banner when an unreviewed locale is active. */
  translationNotice: string;

  h1: string;

  intro: string[];
  callout1: { value: string; label: string };

  sub1: string;
  caption1: string;
  bridge1: string[];
  callout2: { value: string; label: string };

  sub2: string;
  caption2: string;
  bridge2: string[];

  sub3: string;
  caption3: string;
  bridge3: string[];

  sub4: string;
  caption4: string;
  bridge4: string[];

  closing: string[];

  /** Scrollytelling map step cards (index 0 is the intro, no card). */
  mapSteps: { title: string; description: string }[];

  sources: {
    map: SourcePanel;
    cohort: SourcePanel;
    wage: SourcePanel;
    ranked: SourcePanel;
    region: SourcePanel;
  };

  /** Reusable label for the "About this data" trigger. */
  aboutLabel: string;
}

const en: Section1Content = {
  reviewed: true,
  translationNotice: '',

  h1: 'Where the country went',

  intro: [
    // TODO(copy, needs Simon): the opening clause was cut, not rewritten. It
    // said the headline number of Slovaks abroad "approaches 300,000", which
    // traces to the same illustrative example in 07-editorial-content.md as the
    // dead landing hero, not to any dataset. Section 3 has no publishable total
    // to substitute yet, so the sentence now opens on the redistribution claim,
    // which the rest of this section actually evidences.
    'Slovakia has not been emptying evenly. The population that remained has been redistributing itself with almost equal force. The same two decades that sent workers to Bratislava, Prague, and Vienna also rearranged the people who stayed behind, pulling them toward a single dominant node and draining the rest.',
    // CHANGED FROM APPROVED COPY, awaiting Simon's confirmation. Three figures
    // moved to one decimal so the prose matches the charts, which compute them:
    // 89 -> 88.6, 234 -> 233.4, 76 -> 75.4. Wording otherwise untouched.
    'The clearest measure of that pull is what happened to Slovakia’s teenagers. Take every 15-to-19-year-old living in a district in 2004. Count how many 35-to-39-year-olds that same district holds in 2024. Across all 79 districts, the median answer is 88.6 percent: the typical Slovak district retains nine tenths of its young cohort by the time they reach their late thirties. But that median conceals a range that tells the whole story. Senec, in Bratislava’s commuter belt, registered 233.4 percent, meaning it more than doubled its teenage cohort as young adults moved in. Snina, in the Vihorlat uplands of northeastern Slovakia, kept 75.4 percent, meaning roughly one in four of the teenagers who grew up there had left and not been replaced by the time they would have turned 35.',
  ],
  // CHANGED FROM APPROVED COPY, awaiting Simon's confirmation. Was '89%'.
  // Convention now: one decimal for derived statistics, integers for counts. The
  // chart's reference line computes the median from the plotted dots and prints
  // 88.6%, so prose and chart agree rather than showing two figures for the same
  // quantity. See also the intro paragraph, changed the same way.
  callout1: { value: '88.6%', label: 'Median district cohort retention, 2004 to 2024' },

  sub1: 'Where the teenagers went',
  caption1:
    'Net cohort retention: ratio of 35-39 year olds in 2024 to 15-19 year olds in 2004, same district. Combines migration and mortality. src: ŠÚ SR om7007rr.',
  bridge1: [
    'The mechanism behind this redistribution is not complicated. Bratislava kraj pays an average monthly wage of 1,858 EUR. Prešov kraj pays 1,195 EUR. That is a 56 percent premium for doing equivalent work 400 kilometres to the west. Six of Slovakia’s eight regions sit in a compressed band between 1,195 and 1,419 EUR. Bratislava is not merely the highest-paying region; it is a category of its own, 30 percent above the next closest region. For a 22-year-old finishing a degree, the arithmetic of this gap is not subtle.',
  ],
  callout2: { value: '+56%', label: 'Bratislava wage premium over Prešov, 2024, the largest regional gap in Slovakia' },

  sub2: 'The wage magnet',
  caption2: 'Average gross monthly wage by region, 2024. src: ŠÚ SR np3112qr.',
  bridge2: [
    'The population consequences of this geography have been accumulating since EU accession. Senec district nearly doubled in population between 2004 and 2025, adding almost 99 percent to its resident count. Across the Bratislava suburban ring, Pezinok added 27 percent. The districts at the other end lost population in absolute terms: Medzilaborce fell 15 percent, Snina 14 percent, Myjava and Veľký Krtíš each around 13 percent.',
  ],

  sub3: 'Districts that grew, districts that did not',
  caption3: 'Total population change 2004 to 2025 by district. src: ŠÚ SR om7011rr.',
  bridge3: [
    'The indexed divergence since 2004 makes visible what district-level figures confirm in detail. Bratislava kraj is an economy on a different trajectory from the other seven. The distance that has opened between Bratislava and the rest is not merely a wage story; it is a population story, a tax-base story, and eventually a services story. Districts losing residents lose young residents first, which compounds over decades in ways that the current snapshot only partially captures.',
  ],

  sub4: 'Not a story of decline everywhere',
  caption4: 'Population indexed to 2004 = 100, by NUTS2 oblast. src: ŠÚ SR om7011rr.',
  // TODO(copy, needs Simon): two sentences were cut from this paragraph rather
  // than rewritten, so what remains is all previously approved wording. The cut
  // material described a fourth scroll step that no longer exists and read a
  // net international balance off intl_net, which is total net migration and
  // must never be presented as international. The §2 handoff is preserved.
  bridge4: [
    'The internal story has a threshold. Not all the departures from eastern and central districts are internal. The destinations for those outflows are the subject of the next section.',
  ],

  closing: [
    'Slovakia’s internal redistribution and its external emigration are two expressions of the same underlying force: a wage and opportunity gradient steep enough to move people at scale. What the internal map shows is the domestic version of the same logic that built the Czech corridor. The people who stayed in Slovakia went to Bratislava. The people who left Slovakia, in large numbers, went to Czechia. The maps look different. The mechanism is the same.',
  ],

  mapSteps: [
    { title: '', description: '' },
    {
      title: 'Where people live',
      description:
        'Population distribution across Slovakia, 2024. Bratislava and its suburbs dominate the west; the east remains densely settled but increasingly younger people leave for opportunity elsewhere.',
    },
    {
      title: 'Where did the teenagers go?',
      description:
        // CHANGED FROM APPROVED COPY, awaiting Simon's confirmation: 234 -> 233.4,
        // 76 -> 75.4, "loses 11%" -> 11.4, same one-decimal convention.
        'Take every 15-19 year old living in a district in 2004. Twenty years later, how many 35-39 year olds does that same district have? Senec has 233.4% (it attracted people). Snina kept only 75.4% - one in four left and never came back. The median district loses 11.4% of each generation.',
    },
    // TODO(copy, needs Simon): the cut clause claimed only Bratislava and its
    // immediate suburban ring were meaningfully growing. Checked over the full
    // 2004-2025 period (the earlier check used the single year 2024, which was
    // the wrong period for a claim about two decades): 26 of 79 districts
    // gained population, so "only Bratislava" is wrong on the count.
    //
    // But the mechanism the clause reached for is right and generalises. Ranking
    // the 26 gainers by adjacency to a kraj capital, computed from shared
    // boundaries in sk_okresy.geojson: 10 are a regional-centre core, 11 ring a
    // regional centre, only 5 are neither. Kosice-okolie rings Kosice exactly as
    // Senec rings Bratislava, and both are their region's largest gainer.
    //
    // Of the 5 remaining, 4 (Kezmarok, Namestovo, Stara Lubovna, Tvrdosin) grew
    // on natural increase while LOSING migrants on net over the same period:
    // Stara Lubovna, for instance, is +7,083 natural against -4,291 net
    // migration. They are not counter-examples to the concentration thesis, they
    // are places with enough births to outrun their own outflow. Only Dunajska
    // Streda grew on migration while being neither core nor ring (+18,389 net
    // migration against -2,463 natural).
    //
    // So the correction sharpens the concentration thesis rather than weakening
    // it: concentration is around regional centres generally, not Bratislava
    // uniquely, and the handful of exceptions are a fertility story rather than
    // a counter-example. A replacement clause should say that. Suggested
    // direction, needs approval and needs the chart's period settled first,
    // since this step renders a single year while the finding is period-wide:
    // "Growth clusters around the regional centres and their commuter belts.
    // Almost everywhere else loses."
    {
      title: 'Who is growing, who is shrinking',
      description:
        'Annual population change in 2024. Blue districts gain residents; terracotta districts lose them.',
    },
  ],

  sources: {
    // TODO(copy, needs Simon): this panel's caveat previously said Bratislava
    // (SK_CAP) was "excluded from the choropleth statistics". It never was. The
    // map has always coloured all 79 okresy including Bratislava's five; SK_CAP
    // is a separate aggregate row that the okres-level query never picked up.
    // See the note on the cohort panel below.
    map: {
      title: 'The internal migration map',
      source: 'ŠÚ SR DataCube: om7011rr (population, total change), om7007rr (age structure, behind cohort retention). Boundaries: ŠÚ SR okresy (79 districts), simplified for web.',
      derivation:
        'Three scroll steps recolour the same 79-district choropleth from a different 2024 metric: resident population, cohort retention, and total population change over the year. Cohort retention is the ratio of 35-39 year olds in 2024 to 15-19 year olds in 2004 for the same district. Its diverging scale centres on 100, total change on 0.',
      caveat:
        'All 79 districts are shown, including Bratislava’s five. Bratislava III and Senec are the strongest gainers on every step, so they stretch the upper end of each colour scale and compress the contrast among the losing districts. The map carries no international-migration step: the registered outflow series cannot be read at district level, because below the national level it counts moves out of the district including moves to other Slovak districts.',
    },
    // TODO(copy, needs Simon): this caveat previously read "Bratislava is
    // omitted as an outlier", which was never true. The SK_CAP filter these two
    // charts carried removed the Bratislava I-V multi-district AGGREGATE row,
    // not Bratislava's five okresy, which have their own codes (SK0101-SK0105)
    // and always rendered. Verified against the pre-2.1 parquet: it held 80
    // cohort_retention rows, and dropping SK_CAP left 79 with all five
    // Bratislava districts present. So 2.1 did not break this caveat; it was
    // false when the chart was approved, and these charts have been misdescribed
    // to the reader since they shipped rather than newly changed under them.
    cohort: {
      title: 'Cohort retention by district',
      source: 'ŠÚ SR DataCube om7007rr (population by age and district).',
      derivation:
        'For each of 79 districts: (population aged 35-39 in 2024) / (population aged 15-19 in 2004), expressed as a percent. Values above 100% mean the district gained more of that generation than it started with. Combines internal migration, international migration, and mortality; it is a net measure, not migration alone.',
      caveat:
        'This is a synthetic cohort, not the same tracked individuals. It cannot separate people who moved from people who died, though at these ages mortality is small. All 79 districts are shown, Bratislava’s five included: four of the five highest values in the country are Bratislava districts or Senec, so the top of the range is a commuter-belt effect rather than a national pattern.',
    },
    wage: {
      title: 'Average monthly wage by region',
      source: 'ŠÚ SR DataCube np3112qr, indicator E_PRIEM_NOM_MZDA (average nominal monthly earnings, EUR), annual aggregate.',
      derivation:
        'Average gross nominal monthly wage for 2024, by kraj (NUTS3, 8 regions). The national average line is the ŠÚ SR national series (pr0204qs), full-year cumulative period, for the same year. Both figures are read from the same file as the bars rather than written into the chart.',
      caveat:
        'Gross nominal wages, not adjusted for regional cost of living. Bratislava’s premium is somewhat smaller in real terms, but housing costs there are also the highest in the country.',
    },
    // TODO(copy, needs Simon): same false "Bratislava is omitted" caveat as the
    // cohort panel above, same cause, same conclusion: misdescribed since it
    // shipped, not changed by 2.1.
    ranked: {
      title: 'Population change by district, 2004 to 2025',
      source: 'ŠÚ SR DataCube om7011rr (population by district).',
      derivation:
        'Percent change in total resident population between 2004 and 2025 for each of 79 districts: 100 * (pop_2025 - pop_2004) / pop_2004. Districts sorted by change.',
      caveat:
        'Resident population by registered address. Because emigrants often do not deregister, out-migration is understated: real decline in the eastern districts is likely steeper than shown. All 79 districts are shown, Bratislava’s five included.',
    },
    region: {
      title: 'Population trend by oblast, indexed',
      source: 'ŠÚ SR DataCube om7011rr (population by NUTS2 oblast).',
      derivation:
        'Annual total population 2004-2025 for the four NUTS2 oblasts (Bratislava, West, Central, East), each indexed so that its 2004 value equals 100. Isolates the shape of divergence from absolute size.',
      caveat:
        'Registered-residence counts; the same deregistration undercount applies. Indexing hides that the four oblasts start from very different population bases.',
    },
  },

  aboutLabel: 'About this data',
};

// ---------------------------------------------------------------------------
// Slovak stub. TODO(sk): translate every string below, then set reviewed = true.
// Until then the page shows `translationNotice` and renders these (English)
// fallback values. Do NOT ship machine-translated Slovak; Simon authors this.
// ---------------------------------------------------------------------------
const sk: Section1Content = {
  ...en,
  reviewed: false,
  translationNotice:
    'Slovenský preklad tejto sekcie sa pripravuje. Zatiaľ je zobrazený anglický text.',
};

const content: Record<Locale, Section1Content> = { en, sk };

export function getSection1Content(locale: Locale): Section1Content {
  return content[locale];
}

export default content;

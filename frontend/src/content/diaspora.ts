import type { Locale } from '../lib/locale';
import type { SourcePanel } from './internal';

/**
 * Section 3 (/diaspora) bilingual content.
 *
 * Single render source for all Section 3 prose, subheads, stat callouts, chart
 * captions, map labels, and the source metadata behind each "About this data"
 * panel. Mirrors src/content/internal.ts and src/content/corridor.ts.
 *
 * English (`en`) is a FIRST DRAFT for Simon to edit. Every figure in it was
 * read back out of section3_diaspora.parquet after the pipeline repair in
 * commit f208339; see the source panels for derivations.
 *
 * Slovak (`sk`) is a stub. Per the locked decision, Slovak for every section is
 * authored in a single pass at the end, so this stays `reviewed: false` and
 * renders English behind the translation notice until then.
 */

export interface Section3Content {
  reviewed: boolean;
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
  caption2: string;
  bridge2: string[];

  sub3: string;
  /**
   * For the annual-arrivals chart, which is NOT yet built: section 3 currently
   * carries the flow story in prose only (map + 2 ranked charts = 3 visuals,
   * the low end of the 3-4 the spec asks for). Kept here with its source panel
   * so the chart can be dropped in without touching content structure.
   */
  caption3: string;
  bridge3: string[];

  sub4: string;
  closing: string[];

  /** Labels rendered inside the interactive world map. */
  map: {
    eyebrow: string;
    year: string;
    totalLabel: string;
    tooltipUnit: string;
    /** Shown in the detail panel when a country has no trend series. */
    noTrend: string;
    trendLabel: string;
    hint: string;
    resetLabel: string;
    /** Shown when the clicked country holds no Slovak diaspora record. */
    noData: string;
  };

  sources: {
    map: SourcePanel;
    ranked: SourcePanel;
    growth: SourcePanel;
    trend: SourcePanel;
  };

  aboutLabel: string;
  /** Quiet data note, deliberately not a headline. */
  dataNote: string;
}

const en: Section3Content = {
  reviewed: true,
  translationNotice: '',

  eyebrow: '§3 · Global Diaspora',
  h1: 'The wider scattering',

  intro: [
    'Slovakia’s emigration has a shape that neither the internal map nor the Czech corridor can show. In 2020, the United Nations counted 419,651 people living outside Slovakia who had been born inside it, spread across 51 countries. That is close to eight percent of the country’s present population living somewhere else, and it is the number that makes the phrase "brain drain" more than rhetorical.',
    'What matters is not the total but its rearrangement. In 1990, the same measure found 132,977 Slovak-born people abroad, and the great majority of them were in three places: Czechoslovakia’s other half, Austria, and the postwar emigrant communities of Canada and the United States. Thirty years later the diaspora has more than tripled, and the countries that absorbed the growth are almost entirely different ones. The 1990 map is a record of where Slovaks had historically gone. The 2020 map is a record of where the European Union let them go.',
    'This section maps that redistribution. The map above is a single snapshot rather than an animation, because the underlying source is only comprehensive every five years; the honest way to show it is one well-covered year rather than a smooth curve stitched from uneven data.',
  ],
  callout1: { value: '419,651', label: 'Slovak-born people living abroad, 2020, across 51 countries' },

  sub1: 'Where the diaspora is',
  caption1: 'Slovak-born residents by country of destination, 2020. Top 12 of 51 countries with data. src: UN DESA bilateral migrant stock, 2020 revision.',
  bridge1: [
    'The distribution is steep. Czechia alone holds 113,773 Slovak-born residents, and the top four destinations, Czechia, the United Kingdom, Germany, and Austria, account for 69 percent of the entire diaspora between them. By the thirtieth-ranked country the figures are in the low hundreds, and the smallest recorded populations are a handful of people. This is not a diaspora evenly dispersed across the world; it is four large concentrations and a long, thin tail.',
    'Three of those four are neighbours or near-neighbours, which is what makes the second one remarkable. The United Kingdom is 1,500 kilometres from Bratislava, shares no border, no language, and no institutional history with Slovakia, and yet by 2020 it held the second-largest Slovak-born population on earth.',
  ],
  callout2: { value: '+4,946%', label: 'Growth in the Slovak-born population of the United Kingdom, 1990 to 2020' },

  sub2: 'What accession rewrote',
  caption2: 'Percent change in Slovak-born population, 1990 to 2020, top 12 destinations by 2020 size. src: UN DESA bilateral migrant stock, 2020 revision.',
  bridge2: [
    'In 1990 there were 1,431 Slovak-born people in the United Kingdom. In 2020 there were 72,209. The same pattern repeats wherever free movement opened a labour market that had previously been closed: Ireland went from 412 to 13,573, Spain from 110 to 9,849, Italy from 223 to 10,611. Hungary, which shares a border and a long history with Slovakia but was itself outside the Union until 2004, went from 316 to 20,980.',
    'Set against these, the historic destinations look almost static. Czechia grew 62 percent over the same thirty years, Canada 51 percent. Croatia, one of the few destinations to shrink, fell by 32 percent as the Yugoslav-era Slovak communities aged and contracted. The pre-1989 diaspora was built by political exit and postwar resettlement, and it has largely stopped growing. The post-2004 diaspora was built by wage differentials and an open border, and it is where nearly all the movement of the last two decades has gone.',
  ],

  sub3: 'A different measure, a different question',
  caption3: 'Annual arrivals of Slovak citizens, selected destinations. src: OECD International Migration Database, measure B11.',
  bridge3: [
    'The stock figures answer "where are they now". They cannot answer "are they still leaving", because a stock counts everyone who ever arrived and stayed. For that, the annual arrival counts are the better instrument, and they tell a quieter story: the flow has been broadly stable rather than accelerating. Slovak arrivals into Czechia have run between roughly 5,800 and 7,200 a year for the past decade, with no upward trend.',
    'The two measures are easy to conflate and should not be. A stock of 419,651 accumulated over decades is not evidence of an ongoing exodus, and a steady annual flow of a few thousand is not evidence that nothing is happening. What the pairing shows is a diaspora that grew fast in the decade after accession and has since settled into a slower, steadier equilibrium, with each year’s departures roughly balanced by the ageing-in-place of everyone who left before.',
  ],

  sub4: 'What the map cannot tell you',
  closing: [
    'The global picture closes the argument the first two sections opened, and it does so with a caveat worth stating plainly. Nothing in this data records what any of these people do. There is no occupation, no qualification, and no field of study attached to a single one of the 419,651. The phrase "brain drain" carries an implicit claim about who leaves, and this source cannot verify it; it can only establish the scale and the geography of departure, which is a smaller claim than the phrase implies.',
    'What the three sections together do establish is a single mechanism operating at three ranges. Inside Slovakia, people moved toward Bratislava. Across the nearest border, they moved into the Czech labour market until the boundary between living abroad and commuting dissolved. And across the Union, they moved wherever accession made a higher wage legally reachable. The distances differ. The gradient does not.',
  ],

  map: {
    eyebrow: 'Slovak-born residents by country',
    year: '2020',
    totalLabel: 'total abroad',
    tooltipUnit: 'Slovak-born',
    noTrend: 'No trend data for this country',
    trendLabel: '1990 to 2020',
    hint: 'click a country to zoom in',
    resetLabel: 'Back to the world',
    noData: 'No recorded Slovak-born population',
  },

  sources: {
    map: {
      title: 'The global diaspora map',
      source: 'UN DESA, International Migrant Stock 2020 revision, Table 1 (bilateral matrix, destination by origin). Boundaries: world-atlas 110m country outlines.',
      derivation:
        'Slovak-born residents by destination country for 2020, the most recent year with comprehensive coverage. UN DESA publishes this matrix only at five-year intervals, so the map is a single snapshot rather than an animation. Colour is a sequential scale over the 51 countries with a recorded value; clicking a country zooms to it and shows its own figure and, where the full series exists, its 1990 to 2020 trend.',
      caveat:
        'Counts people born in Slovakia, which includes those born before 1993 in what was then Czechoslovakia, and excludes children born abroad to Slovak parents. Two countries with data, Malta (305 people) and Liechtenstein (55), are too small to appear as clickable shapes at this map resolution; they are present in the charts.',
    },
    ranked: {
      title: 'Diaspora by destination country',
      source: 'UN DESA, International Migrant Stock 2020 revision, Table 1.',
      derivation:
        'The 12 largest destinations by 2020 Slovak-born population, out of 51 countries with a recorded value. The 12 shown account for 93.7 percent of the 419,651 total.',
      caveat:
        'The cut at 12 is for legibility. Ranks 30 and below are in the low hundreds or single digits, which cannot be read on the same axis as Czechia’s 113,773.',
    },
    growth: {
      title: 'Change in diaspora size, 1990 to 2020',
      source: 'UN DESA, International Migrant Stock 2020 revision, Table 1, 1990 and 2020 columns.',
      derivation:
        'Percent change in each destination’s Slovak-born population between 1990 and 2020: 100 * (stock_2020 - stock_1990) / stock_1990. Shown for the 12 largest destinations by 2020 size.',
      caveat:
        'Percentages from small bases are dramatic by construction. Norway’s +62,883 percent is a rise from 6 people to 3,779, which is real but says more about the 1990 baseline than about Norway. Read the growth panel alongside the absolute one.',
    },
    trend: {
      title: 'Annual arrivals of Slovak citizens',
      source: 'OECD International Migration Database (DSD_MIG), measure B11, inflows of foreign population by nationality.',
      derivation:
        'Count of Slovak citizens recorded as arriving in each destination country per year. B11 is one of five measures stacked in the same OECD table; the others cover departures, asylum, naturalisations, and resident stock, and are not mixed into this series.',
      caveat:
        'A flow, not a stock, and on a different definition from the map: this counts Slovak citizens arriving, while the map counts Slovak-born residents present. The two must not be added or plotted as one series. Coverage is 33 OECD countries, so non-OECD destinations have no annual series at all.',
    },
  },

  aboutLabel: 'About this data',
  dataNote:
    'A note on what is not here: this source records only how many Slovak-born people live in each country, with no breakdown by education, age, or occupation. Sex is available and totals 195,564 men and 224,087 women in 2020, but nothing in the data identifies what anyone studied or does for a living.',
};

// ---------------------------------------------------------------------------
// Slovak stub. TODO(sk): translate every string above, then set reviewed = true.
// Slovak for all sections is authored in one pass at the end.
// ---------------------------------------------------------------------------
const sk: Section3Content = {
  ...en,
  reviewed: false,
  translationNotice:
    'Slovenský preklad tejto sekcie sa pripravuje. Zatiaľ je zobrazený anglický text.',
};

const content: Record<Locale, Section3Content> = { en, sk };

export function getSection3Content(locale: Locale): Section3Content {
  return content[locale];
}

export default content;

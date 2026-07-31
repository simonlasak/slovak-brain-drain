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
  h1: 'Three questions, three answers',

  // APPROVED 2026-07-31 (draft 3). Replaces prose built on growth ratios, which
  // the July 2026 audit retired: every UN DESA reference year is interpolated or
  // extrapolated, so a ratio divides two modelled quantities. Per
  // 01-research-architecture.md:84 the section's subject is how the picture
  // changes with the definition of "Slovak", not the size of the total.
  //
  // Figures and vintages, all verified:
  //   615,823 +/- 8,391  Slovak ancestry, B04006, 2023 ACS 5-year
  //   19,700             Slovakia-born, PUMS POBP=149, 2023 ACS 5-year. Weighted
  //                      microdata: no published margin, replicate weights
  //                      deliberately not fetched.
  //   17,993             Czechoslovakia-born, PUMS POBP=105, same vintage
  //   242,907            Czechoslovakian ancestry, B04006, same vintage
  //   51 / 25 / 1        countries per definition, ALL on the 2020 basis
  // Factor of thirty-one is 615,823 / 19,700, same vintage both sides.
  intro: [
    'Ask how many Slovaks live abroad and the answer depends on a question most people never think to ask: what makes someone Slovak?',
    'There are three defensible answers, and they are not three estimates of one number. They are three different quantities. Place of birth counts people born inside Slovakia who now live outside it, which is a living first-generation population. Citizenship counts people holding a Slovak passport, which includes their children born abroad and excludes anyone who has given the passport up. Ancestry counts people who say they are of Slovak descent, reaching back through however many generations the respondent chooses to remember. The first is a migration statistic. The third is a heritage statistic. Confusing them produces claims that are wrong by an order of magnitude in either direction.',
    'The United States shows how far apart they sit. In the 2023 American Community Survey, 615,823 people reported Slovak ancestry, give or take a sampling margin of 8,391. In the same survey, the microdata records 19,700 residents born in Slovakia, a figure that carries no published margin of its own. Both numbers are correct. They differ by a factor of thirty-one because they are measuring different things: the larger figure is largely the descendants of people who left Austria-Hungary before 1914, most of whom have never held Slovak citizenship and many of whom have never been to Slovakia.',
    'Neither figure is a clean count of its own quantity either. The same survey carries a separate line for \u201cCzechoslovakia\u201d, the state that dissolved at the end of 1992, and it cannot be divided: 17,993 residents born there, and 242,907 people who recorded their ancestry as Czechoslovakian. No rule allocates those people between two successor countries. Both Slovak figures are therefore floors, but for different reasons. The birthplace codes are mutually exclusive, one per person, so the 17,993 sit entirely outside the 19,700 and an unknown share of them belong with it. The ancestry question accepts two responses per person, so part of the 242,907 is already inside the 615,823 and the rest is not, with no way to tell which.',
    'Coverage runs out before the comparison does. For 2020, Slovak-born populations can be counted in fifty-one countries and Slovak citizens in twenty-five. Ancestry is counted in one, because the United States is the only country whose ancestry data this project holds, though Canada and Australia ask the question too. No single country supports all three at once: the United States appears in neither of the other two sources. This section therefore takes the definitions one at a time, and says which one it is counting every time a number appears.',
  ],
  // The contrast IS the callout: one country, one survey, two definitions.
  callout1: { value: '31x', label: 'Ratio of Slovak-ancestry to Slovak-born residents in the United States, 2023 ACS' },

  sub1: 'Where the diaspora is, on one definition',
  caption1:
    'Slovak-born residents by destination, 2020. 51 destinations with data. Czechia\u2019s figure is compiled from foreign-citizenship data, not place of birth. src: UN DESA bilateral migrant stock, 2020 revision.',
  // APPROVED 2026-07-31. Figures: 113,773 CZE and 27.1% share; 47 birth-derived
  // + 1 imputed + 3 citizen-derived = 51; matched panel 25 countries, born
  // 305,669 vs citizen 297,234 (3%); ex-Czechia born exceeds citizen by 15,954
  // while CZE runs 7,519 the other way, net 8,435; ex-CZE panel differs 8%;
  // CZE across the two sources differs 6.6%. All 2020 basis.
  bridge1: [
    'The map counts one definition, and it hides a substitution inside its own largest number.',
    'Czechia holds 113,773 Slovak-born residents on this measure, more than a quarter of the global total. Except that Czechia is not reporting Slovak-born residents. Of the fifty-one destinations in the United Nations table, forty-seven are compiled from place-of-birth data, one is imputed from a regional model, and three are compiled from foreign-citizenship data instead, because that is what the destination country publishes. Two of those three are Jordan and Mongolia, with twenty-two and two Slovaks respectively. The third is Czechia.',
    'So the single largest figure on the map answers a different question from every other large figure on it. The people in it are Slovak citizens living in Czechia, not people born in Slovakia, and the two groups overlap without coinciding: a Slovak citizen born in Prague is in the count, and a Slovak-born woman who took Czech citizenship is not.',
    'What that does to comparison is worth following carefully. Across the twenty-five countries reporting both definitions for 2020, the totals look reassuringly close: 305,669 Slovak-born against 297,234 Slovak citizens, a difference of three percent. That closeness is not agreement. Outside Czechia the born figures exceed the citizen figures by 15,954 people in total, while Czechia alone runs 7,519 in the opposite direction. The two partly cancel, and the three percent is what survives. Remove Czechia and the remaining twenty-four countries differ by eight percent, itself a net of divergences running both ways.',
    'Even Czechia, the one case where both sources are counting citizens and should therefore agree closely, differs by 6.6 percent between them.',
    'Two sources agreeing is worth less than it looks in any case. The United Nations and Eurostat both compile their figures from the same national statistical offices, so when they agree about Slovaks in Germany, one German register has been reported twice.',
  ],
  callout2: { value: '25', label: 'Destinations reporting both a Slovak-born and a Slovak-citizen count for 2020' },

  sub2: 'The same people, counted twice',
  caption2:
    'Slovak-born against Slovak citizens, 2020, for the 25 destinations reporting both. src: UN DESA bilateral migrant stock 2020 revision; Eurostat migr_pop1ctz.',
  // APPROVED 2026-07-31 after the Hungary residence fork was resolved. Windows:
  // FR series starts 2004, HU 2002, both accumulated to end-2019 against a
  // 1 Jan 2020 stock. FR 1,248/1,561 = 80%. HU 3,441/10,399 = 33%, residue
  // 6,958. HU divergence 50% vs 11% median for stocks >10,000; 31% median for
  // stocks <3,000. NLD: DESA 1,671 (2020), Eurostat citizen 6,856 (2020), OECD
  // born 7,418 (2021, its first year).
  bridge2: [
    'Look along the comparison and the country-level disagreements are far larger than the totals suggest. Hungary reports half as many Slovak citizens as there are Slovak-born residents. The Netherlands reports four times as many. Three different things are going on: one gap that a definitional mechanism explains, one that it only partly explains, and one that is not a gap at all but an error in the data.',
    'France is the clean demonstration. A Slovak who acquires French citizenship leaves the count of Slovak citizens without leaving France, and enough of them have done so to account for most of the difference: naturalisations recorded from 2004, when the French series for Slovak citizens begins, through the end of 2019 come to 1,248 people against a gap of 1,561. Four fifths of the discrepancy is a passport changing hands, not a person moving.',
    'Hungary is the same mechanism operating on a much larger gap, and it does not fully account for it. Hungary\u2019s Slovak-citizen series begins in 2002, and naturalisations through the end of 2019 come to 3,441 against a gap of 10,399. Two thirds of the difference is not accounted for, and two known limits of the measurement sit outside it. The series begins in 2002 while the stock reflects everyone who arrived since 1993, so nine years of naturalisations are simply missing from it. And it records acquisition only: a Slovak-born resident who held Hungarian citizenship from birth through descent never appears in it, because nothing was acquired. Neither can be estimated from what is held, and neither is offered here as a quantity.',
    'The comparison with France also runs in the harder direction. France\u2019s series starts in 2004, two years later than Hungary\u2019s, and reaches four fifths of its gap on that shorter accumulation, while Hungary reaches a third on a longer one. The difference between the two is understated by the windows, not created by them.',
    'It is worth being precise about what these naturalisations are: European statistics on citizenship acquisition cover only the reporting country\u2019s resident population, so these are Slovaks who were living in Hungary when they naturalised. Hungary\u2019s separate procedure for granting citizenship to applicants abroad with Hungarian ancestry or language, introduced in 2010, falls outside the statistics entirely and cannot be what these numbers show. Slovakia amended its own law in 2010 to provide for loss of Slovak citizenship on voluntary acquisition of another, since relaxed for citizens with long residence abroad. Both measures remain politically contested in both countries, and this project takes no position on either.',
    'So Hungary\u2019s residue is not accounted for, and the obvious fallback does not fit. Where two sources disagree about a small population, the disagreement is usually noise: among the sixteen destinations holding fewer than three thousand Slovak-born residents, the two compilers differ by thirty-one percent at the median. But among the seven holding more than ten thousand they differ by only eleven percent, and Hungary\u2019s fifty percent sits far outside that. Whatever is happening in Hungary is not the ordinary imprecision of a small number.',
    'The Netherlands is that ordinary imprecision, at the other extreme. The United Nations puts the Slovak-born population there at 1,671 in 2020. The Netherlands itself reports 6,856 Slovak citizens resident that year, and the OECD, whose Dutch series begins the following year, puts the Slovak-born population at 7,418 in 2021. Two of those three describe roughly the same population and one does not. The United Nations estimate is simply too low, and that is a disagreement between compilers rather than between definitions.',
    'Which leaves the third definition, the one that cannot be compared at all.',
  ],

  sub3: 'The definition that cannot be compared',
  /**
   * No chart. The ancestry material is prose because the comparison it makes is
   * between one country's two survey questions, not across destinations: a chart
   * of 1 country against 51 would misrepresent the coverage.
   */
  caption3: '',
  // APPROVED 2026-07-31. All US figures 2023 ACS 5-year. 615,823 +/- 8,391
  // ancestry; 19,700 PUMS POBP=149 (no published margin, replicate weights not
  // fetched); 17,993 POBP=105; 242,907 +/- 4,692 Czechoslovakian ancestry;
  // OECD 20,876 for 2023 (matched year). UN DESA has NO USA row at all.
  // The passport sentence is marked as inference in the text itself.
  bridge3: [
    'Slovak ancestry is counted in exactly one country, and only because the United States asks. Its census long form has carried an ancestry question since 1980, and the American Community Survey has carried it since. Canada and Australia ask comparable questions; this project has not gathered them.',
    'That single data point is worth the trouble, because the United States is where the three definitions diverge furthest. In the 2023 American Community Survey, 615,823 people reported Slovak ancestry, against 19,700 residents recorded in the same survey\u2019s microdata as born in Slovakia. The larger figure is thirty-one times the smaller, and both are correct. Slovaks left Austria-Hungary for American industry in enormous numbers between roughly 1880 and 1914, before Slovakia existed as a state, and 615,823 is very largely their descendants. No data held here records how many of them hold Slovak citizenship. The inference that few do rests on the arithmetic: 19,700 residents were born in Slovakia, and Slovak citizenship passes by descent only where a parent held it, which a family that left the Habsburg empire could not.',
    'This is why the definitions cannot be treated as rival estimates. Ancestry measures the durability of an identity across generations. Place of birth measures who moved. In the United States the first is a nineteenth-century story and the second is a twentieth and twenty-first century one, and adding them or averaging them would describe nobody.',
    'The United States also demonstrates the limits of the sources this section has been using. There is no United States row in the United Nations table at all. Not a zero: an absence. The United Nations builds its origin estimates from what destination countries publish, and the United States publishes no Slovakia birthplace figure. Its published birthplace table offers only a combined line for Czechoslovakia. The Slovak figure quoted above had to be extracted from the survey\u2019s microdata, where a Slovakia code does exist, and it is consistent with the OECD\u2019s own estimate for the same year of 20,876.',
    'The ambiguity runs through both definitions here, and differently in each. On birthplace, the microdata records 17,993 people born in Czechoslovakia alongside the 19,700 born in Slovakia, and the codes are mutually exclusive, so an unknown share of that 17,993 belongs with the Slovak figure and no rule says how much. On ancestry, 242,907 people gave their ancestry as Czechoslovakian, and because the question accepts two answers per person, some of them are already inside the 615,823 and some are not.',
  ],

  sub4: 'What the count cannot tell you',
  // APPROVED 2026-07-31. Every figure here is already shipped elsewhere on the
  // site: 419,651 / 51 destinations / 69.0% top four (recomputed on the current
  // parquet), 88.6% median cohort retention (§1), 125,280 CZ residents 2025
  // (§2), 59,935 recorded departures and 222,321 implied, both 2004-2024 (hero).
  // The implied figure is named as derived, not as recorded arrivals.
  closing: [
    'This section set out to count a diaspora and found instead that the count depends on a definition, and that no definition can be applied consistently across the places Slovaks actually went.',
    'What survives is worth stating plainly. Roughly 420,000 people born in Slovakia were living outside it in 2020, spread across fifty-one countries, with Czechia, the United Kingdom, Germany and Austria holding sixty-nine percent of them between them. That figure is a modelled estimate rather than a count, its largest single component is measured on the wrong definition, and it omits the United States entirely. It is the best number available and it should be read with all three of those qualifications attached.',
    'What does not survive is the idea that any of this measures brain drain. Nothing in these sources records what a single one of those people does for a living, what they studied, or whether they intend to return. The phrase carries a claim about talent, and the data carries only a claim about geography.',
    'The three sections together describe one mechanism at three ranges. Inside Slovakia, people moved toward Bratislava, and the median district now holds 88.6 percent of the young cohort it had twenty years earlier. Across the nearest border, they moved into the Czech labour market until the difference between living abroad and commuting to a better-paid job stopped being meaningful, and 125,280 of them were registered as Czech residents by 2025. Across the Union, they moved wherever accession made a higher wage legally reachable. Slovak authorities recorded 59,935 departures between 2004 and 2024. Over the same period the eleven destination countries that counted Slovak citizens throughout imply 222,321, a figure derived from the rise in their reported Slovak-citizen populations plus the Slovaks who naturalised there, and one that omits the United Kingdom.',
    'The distances differ. The gradient does not.',
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

import type { Locale } from '../lib/locale';
import type { SourcePanel } from './internal';

/**
 * Section 4 (/people) bilingual content.
 *
 * Mirrors internal.ts, corridor.ts and diaspora.ts. English is a FIRST DRAFT for
 * Simon to edit; Slovak is a stub, per the locked decision that Slovak for every
 * section is authored in one pass at the end.
 *
 * WHAT THIS SECTION IS AND IS NOT. Nine named individuals, manually curated. It is
 * not a sample and nothing in it is a rate, a share or a trend. Sections 1 to 3
 * carry the structural evidence on hundreds of thousands of people and can say
 * nothing about what any of them studied or does; this section knows both, for nine
 * people, because someone looked them up one at a time. That is the whole trade, and
 * the prose says so rather than letting nine cases imply a distribution.
 *
 * WHY POST-1993, which 07-editorial-content.md asks the opening to explain: the
 * project holds five earlier emigrants (Murgas 1896, Banic 1907, Vilcek 1964, Bajcsy
 * 1967, Lowy 1968) in notable_people_historical.json. They are deliberately NOT
 * shipped to the frontend and not shown. They left Austria-Hungary or Czechoslovakia,
 * not Slovakia, so they belong to the pre-1993 emigration the site's date convention
 * treats as a different subject. 04-spec.md still describes a "1860 to today"
 * timeline for this section; that predates the post-1993 restriction and is
 * superseded here.
 *
 * VERIFIED against notable_people.json, all nine records:
 *   left_year        1993, 1993, 1996, 2001, 2002, 2006, 2013, 2017, 2019
 *   age_at_leaving   15, 15, 24, 24, 24, 25, 25, 28, 39 (median 24)
 *   tertiary in SK   7 of 9; the two who left at 15 completed primary only
 *   left at 24 or 25 5 of 9
 *   returned         1 of 9, Jan Tkac, Bratislava
 *   destinations     San Francisco 2, London 2, Prague, Montreal, Warsaw, Fairfax,
 *                    Bratislava
 */

export interface Section4Content {
  reviewed: boolean;
  translationNotice: string;

  eyebrow: string;
  h1: string;

  intro: string[];

  chartTitle: string;
  chartCaption: string;

  cardsTitle: string;
  closing: string[];

  /** Labels rendered inside the timeline cards and the age chart. */
  labels: {
    leftIn: string;
    aged: string;
    expand: string;
    collapse: string;
    trigger: string;
    impact: string;
    path: string;
    sources: string;
    tertiary: string;
    primaryOnly: string;
    ageAxis: string;
    returned: string;
  };

  caveatsTitle: string;
  /** TODO(copy, needs Simon): see the note at the definition. */
  criteriaNote: string;

  sources: { ages: SourcePanel };
  aboutLabel: string;
}

const en: Section4Content = {
  reviewed: true,
  translationNotice: '',

  eyebrow: '§4 · Notable departures',
  h1: 'Nine people, and what they cost',

  // FIRST DRAFT, mine not Simon's. Every figure verified against the JSON.
  //
  // The link to §3 in the third paragraph is the one that earns this section its
  // place: §3's data note says the source records nothing about what any of the
  // 419,651 studied or does for a living. This section is the other end of that
  // trade, and saying so is more honest than presenting nine cases as evidence of a
  // pattern.
  intro: [
    'The three sections before this one count people. They can tell you that roughly 420,000 people born in Slovakia were living outside it in 2020, that the median district kept 88.6 percent of its young cohort, that 125,280 Slovaks were registered as Czech residents by 2025. What none of them can tell you is what a single one of those people studied, or what they do now, because no source behind them records it.',
    'This section is the opposite trade. Nine people, named, with a year of departure, an age, an education, a field and a destination attached to each. It is not a sample and it cannot be read as one: the nine were selected by hand, so any pattern in them is an illustration of a mechanism the earlier sections measured, never evidence for it. Nine cases cannot carry a rate.',
    'What the nine do show, plainly, is when Slovakia stops paying and someone else starts benefiting. Seven of the nine completed their tertiary education in Slovakia before leaving. Five left at twenty-four or twenty-five, which is the year a Slovak degree finishes. The two who left at fifteen are the exceptions that prove the rule from the other side: one because his family emigrated, one because Slovak junior hockey could not develop him further. Slovakia funded the schooling in seven cases out of nine and captured the working life in one.',
    'Departures here run from 1993 to 2019, and the section stops at independence on purpose. The project holds five earlier emigrants, including Jozef Murgaš who left in 1896 and Ján Vilček who defected in 1964, but they left Austria-Hungary or Czechoslovakia rather than Slovakia. They are a different emigration and they are not shown here.',
  ],

  chartTitle: 'Age at leaving, and whether Slovakia had finished paying',
  chartCaption:
    'Each of the nine at the age they left Slovakia, coloured by whether they had completed tertiary education here first. Nine hand-selected individuals, so this is a strip of nine points and not a distribution: no bar, bucket or median should be read off it as a rate. Five of the nine left at 24 or 25. src: notable_people.json, manually curated.',

  cardsTitle: 'The nine',

  // FIRST DRAFT. Covers the three cases 07-editorial-content.md names: the
  // structural failure (Slafkovsky), the family migration (Karpathy) and the return
  // (Tkac). Every quoted fact is in the JSON record for that person.
  closing: [
    'Three of the nine explain more than the other six, because each one fails differently.',
    'Juraj Slafkovský left at fifteen for a Finnish club because Slovak junior hockey could not develop him further, and became the first Slovak taken first overall in an NHL draft. He has said so publicly, which is the part that matters: his departure was not an opportunity he took but a development system he had to leave. Andrej Karpathy also left at fifteen, and for no Slovak reason at all — his family emigrated to Canada, he did every degree abroad, and he ended up a founding member of OpenAI. Slovakia neither trained nor lost him in any sense it could have influenced.',
    'Ján Tkáč is the only one who came back. He left for a postdoc in Sweden at twenty-five and returned in 2014 with a European Research Council starting grant, bringing over 1.5 million euros to the Slovak Academy of Sciences and building a glycomics group there. He is the case for optimism and the case against it at once: return is demonstrably possible, and it took an ERC grant to make it happen.',
    'That is the shape of the thing. One left because a system failed him, one left for reasons Slovakia never controlled, and one returned only because an external funder paid for it. The other six finished their Slovak degrees and went.',
  ],

  labels: {
    leftIn: 'Left in',
    aged: 'aged',
    expand: 'Read the full case',
    collapse: 'Close',
    trigger: 'Trigger',
    impact: 'Impact',
    path: 'Path since leaving',
    sources: 'Sources',
    tertiary: 'Completed tertiary education in Slovakia',
    primaryOnly: 'Left before tertiary education',
    ageAxis: 'Age at leaving',
    returned: 'Returned to Slovakia',
  },

  caveatsTitle: 'How this list was assembled',
  // TODO(copy, needs Simon): the inclusion rule is not recorded anywhere. The data
  // is manually curated (pipeline/fetch/notable_people.py says so explicitly: "the
  // actual research is done by Simon"), and section_caveats refers to candidates who
  // "met the criteria for inclusion" without ever stating them. This paragraph says
  // that honestly rather than inventing a rule, but it should be replaced with the
  // real criteria once written down, because an unstated selection rule is the one
  // thing a hand-curated section cannot defend.
  criteriaNote:
    'The nine were selected by hand rather than by a query, and the rule used to select them is not recorded in the data. That is a real limitation of this section and not a stylistic one: with no stated criterion there is no way for a reader to know who was considered and left out. What the research notes do record is one correction worth repeating, below.',

  sources: {
    ages: {
      title: 'Age at leaving',
      source: 'notable_people.json, manually curated from Slovak and English-language sources. Each record carries its own source list, shown on the card.',
      derivation:
        'age_at_leaving as recorded per person, plotted against nothing else: one axis, nine points, jittered vertically only so that coincident ages stay separately readable. Colour is the slovak_education_completed field, which takes two values across these nine, tertiary and primary_only. Seven are tertiary. The vertical position carries no meaning.',
      caveat:
        'Nine hand-selected people are not a sample of Slovak emigration and no summary statistic should be computed from them. The clustering at 24 and 25 is consistent with departure on completion of a Slovak degree, and that is the most this chart can support: it is an illustration of a mechanism sections 1 to 3 measure at scale, not evidence of one. A histogram was deliberately not used, because bucketing nine cases produces bars that read as a frequency distribution.',
    },
  },

  aboutLabel: 'About this data',
};

// ---------------------------------------------------------------------------
// Slovak stub. TODO(sk): translate every string above, then set reviewed = true.
// Slovak for all sections is authored in one pass at the end.
// ---------------------------------------------------------------------------
const sk: Section4Content = {
  ...en,
  reviewed: false,
  translationNotice:
    'Slovenský preklad tejto sekcie sa pripravuje. Zatiaľ je zobrazený anglický text.',
};

const content: Record<Locale, Section4Content> = { en, sk };

export function getSection4Content(locale: Locale): Section4Content {
  return content[locale];
}

export default content;

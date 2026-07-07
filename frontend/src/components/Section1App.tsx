import React from 'react';
import MapVariantA from './MapVariantA';
import { SectionEyebrow } from './charts/SectionEyebrow';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { CohortRetentionChart } from './charts/CohortRetentionChart';
import { WageBarChart } from './charts/WageBarChart';
import { RankedChangeChart } from './charts/RankedChangeChart';
import { RegionTrendChart } from './charts/RegionTrendChart';

function Section1App() {
  return (
    <>
      <MapVariantA />

      <div className="section1-editorial">

        <header className="section1-header">
          <SectionEyebrow>&#167;1 &#183; Internal Slovakia</SectionEyebrow>
          <h1 className="section1-h1">Where the country went</h1>
        </header>

        <div className="section1-prose">
          <p>Slovakia has not been emptying evenly. While the headline number of Slovaks living abroad approaches 300,000, the population that remained has been redistributing itself with almost equal force. The same two decades that sent workers to Bratislava, Prague, and Vienna also rearranged the people who stayed behind, pulling them toward a single dominant node and draining the rest.</p>
          <p>The clearest measure of that pull is what happened to Slovakia's teenagers. Take every 15-to-19-year-old living in a district in 2004. Count how many 35-to-39-year-olds that same district holds in 2024. Across all 79 districts, the median answer is 89 percent: the typical Slovak district retains nine tenths of its young cohort by the time they reach their late thirties. But that median conceals a range that tells the whole story. Senec, in Bratislava's commuter belt, registered 234 percent, meaning it more than doubled its teenage cohort as young adults moved in. Snina, in the Vihorlat uplands of northeastern Slovakia, kept 76 percent, meaning roughly one in four of the teenagers who grew up there had left and not been replaced by the time they would have turned 35.</p>
        </div>

        <StatCallout value="89%" label="Median district cohort retention, 2004 to 2024" />

        <h3 className="section1-h3">Where the teenagers went</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <CohortRetentionChart animated={animated} />
              <p className="section1-caption">
                Net cohort retention: ratio of 35-39 year olds in 2024 to 15-19 year olds in 2004, same district. Combines migration and mortality. src: &#352;&#218; SR om7007rr.
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          <p>The mechanism behind this redistribution is not complicated. Bratislava kraj pays an average monthly wage of 1,858 EUR. Pre&#353;ov kraj pays 1,195 EUR. That is a 56 percent premium for doing equivalent work 400 kilometres to the west. Six of Slovakia's eight regions sit in a compressed band between 1,195 and 1,419 EUR. Bratislava is not merely the highest-paying region; it is a category of its own, 30 percent above the next closest region. For a 22-year-old finishing a degree, the arithmetic of this gap is not subtle.</p>
        </div>

        <StatCallout value="+56%" label="Bratislava wage premium over Pre&#353;ov, 2024, the largest regional gap in Slovakia" />

        <h3 className="section1-h3">The wage magnet</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <WageBarChart animated={animated} />
              <p className="section1-caption">
                Average gross monthly wage by region, 2024. src: &#352;&#218; SR np3112qr.
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          <p>The population consequences of this geography have been accumulating since EU accession. Senec district nearly doubled in population between 2004 and 2025, adding almost 99 percent to its resident count. Across the Bratislava suburban ring, Pezinok added 27 percent. The districts at the other end lost population in absolute terms: Medzilaborce fell 15 percent, Snina 14 percent, Myjava and Ve&#318;k&#253; Krt&#237;&#353; each around 13 percent.</p>
        </div>

        <h3 className="section1-h3">Districts that grew, districts that did not</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <RankedChangeChart animated={animated} />
              <p className="section1-caption">
                Total population change 2004 to 2025 by district. src: &#352;&#218; SR om7102rr.
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          <p>The indexed divergence since 2004 makes visible what district-level figures confirm in detail. Bratislava kraj is an economy on a different trajectory from the other seven. The distance that has opened between Bratislava and the rest is not merely a wage story; it is a population story, a tax-base story, and eventually a services story. Districts losing residents lose young residents first, which compounds over decades in ways that the current snapshot only partially captures.</p>
        </div>

        <h3 className="section1-h3">Not a story of decline everywhere</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <RegionTrendChart animated={animated} />
              <p className="section1-caption">
                Population indexed to 2004 = 100, by NUTS2 oblast. src: &#352;&#218; SR om7011rr.
              </p>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          <p>The internal story has a threshold. Not all the departures from eastern and central districts are internal. The final scroll step maps net international migration by okres: which districts export people across Slovak borders, and which attract arrivals from abroad. Bratislava absorbs immigrants from other countries while eastern and central districts show consistent negative net international balances. The destinations for those outflows are the subject of the next section.</p>
        </div>

        <div className="section1-prose section1-closing">
          <p>Slovakia's internal redistribution and its external emigration are two expressions of the same underlying force: a wage and opportunity gradient steep enough to move people at scale. What the internal map shows is the domestic version of the same logic that built the Czech corridor. The people who stayed in Slovakia went to Bratislava. The people who left Slovakia, in large numbers, went to Czechia. The maps look different. The mechanism is the same.</p>
        </div>

      </div>
    </>
  );
}

export default Section1App;

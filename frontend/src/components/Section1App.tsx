import React from 'react';
import MapVariantA from './MapVariantA';
import { SectionEyebrow } from './charts/SectionEyebrow';
import { StatCallout } from './charts/StatCallout';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { AboutData } from './charts/AboutData';
import { CohortRetentionChart } from './charts/CohortRetentionChart';
import { WageBarChart } from './charts/WageBarChart';
import { RankedChangeChart } from './charts/RankedChangeChart';
import { RegionTrendChart } from './charts/RegionTrendChart';
import { useLocale } from '../lib/locale';
import { getSection1Content } from '../content/internal';

function Section1App() {
  const locale = useLocale();
  const c = getSection1Content(locale);

  return (
    <>
      <MapVariantA steps={c.mapSteps} aboutLabel={c.aboutLabel} sourcePanel={c.sources.map} />

      <div className="section1-editorial">

        {!c.reviewed && c.translationNotice && (
          <p className="section1-translation-notice">{c.translationNotice}</p>
        )}

        <header className="section1-header">
          <SectionEyebrow>{c.eyebrow}</SectionEyebrow>
          <h1 className="section1-h1">{c.h1}</h1>
        </header>

        <div className="section1-prose">
          {c.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout1.value} label={c.callout1.label} />

        <h3 className="section1-h3">{c.sub1}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <CohortRetentionChart animated={animated} />
              <div className="chart-caption-row">
                <p className="section1-caption">{c.caption1}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.cohort} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          {c.bridge1.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <StatCallout value={c.callout2.value} label={c.callout2.label} />

        <h3 className="section1-h3">{c.sub2}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <WageBarChart animated={animated} />
              <div className="chart-caption-row">
                <p className="section1-caption">{c.caption2}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.wage} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          {c.bridge2.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section1-h3">{c.sub3}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <RankedChangeChart animated={animated} />
              <div className="chart-caption-row">
                <p className="section1-caption">{c.caption3}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.ranked} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          {c.bridge3.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h3 className="section1-h3">{c.sub4}</h3>

        <AnimateOnScroll>
          {(animated) => (
            <div className="section1-chart-wide">
              <RegionTrendChart animated={animated} />
              <div className="chart-caption-row">
                <p className="section1-caption">{c.caption4}</p>
                <AboutData label={c.aboutLabel} panel={c.sources.region} />
              </div>
            </div>
          )}
        </AnimateOnScroll>

        <div className="section1-prose">
          {c.bridge4.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <div className="section1-prose section1-closing">
          {c.closing.map((p, i) => <p key={i}>{p}</p>)}
        </div>

      </div>
    </>
  );
}

export default Section1App;

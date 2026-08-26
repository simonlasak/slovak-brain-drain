import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PeopleAgeChart } from './charts/PeopleAgeChart';
import type { AgePerson } from './charts/PeopleAgeChart';
import { AboutData } from './charts/AboutData';
import { AnimateOnScroll } from './charts/AnimateOnScroll';
import { useLocale } from '../lib/locale';
import { getSection4Content } from '../content/people';

/**
 * Section 4: nine named departures, on the design system.
 *
 * REPLACES a pre-design-system component: inline hex (#e5e5e5, #666, #555, #888),
 * rem font sizes off the type scale, a bare <h1> outside the layout, no content
 * module, no Slovak stub, no source panel, and a seven-bucket histogram over nine
 * people with four empty buckets. It also computed an `emigrants` array and never
 * used it.
 *
 * NO FILTER BAR, which 04-spec.md asks for (by field, by destination region). There
 * are nine cards. A filter over nine items is friction pretending to be an
 * affordance: every option either shows almost everything or almost nothing, and the
 * reader can see the whole set without scrolling far. The shared filter bar was
 * dropped site-wide at Checkpoint 5 for the same reason the scroll narrative won.
 *
 * THE TIMELINE IS ORDERED BY DEPARTURE YEAR and alternates sides, per spec. Sides
 * alternate by index rather than by year so the visual rhythm survives the two pairs
 * that share a year (1993 twice).
 */

interface Person {
  id: string;
  name: string;
  name_sk: string;
  birth_year: number;
  birth_place: string;
  left_year: number;
  age_at_leaving: number;
  slovak_education_completed: string;
  destination_path: string[];
  current_location: string;
  field: string;
  trigger: string;
  narrative: string;
  impact: string;
  sources: string[];
}

interface PeopleData {
  section_caveats: string;
  people: Person[];
}

/**
 * Display name, preferring the Slovak orthography.
 *
 * FILLED 2026-08-26. Every name in notable_people.json was stored ASCII-folded,
 * so this rendered "Juraj Slafkovsky" and "Jan Tkac" on a page whose own prose
 * spelled them correctly. Five were corrected against a named authoritative
 * source each, in both `name` and `name_sk`: Babiš, Slafkovský, Kudlička,
 * Košecká, Tkáč. Two are correct as ASCII and were left alone, Karpathy and
 * Valko.
 *
 * The last two were not guessable from any source we could reach: kegg.tech
 * writes "Kristina Cahojova", and no authoritative source for Simkova was found
 * at all. Simon confirmed both in full directly on 26 August 2026: Kristína
 * Čahojová and Katarína Šimková. All nine names are now settled.
 *
 * Preferring name_sk keeps this correct the moment either field is filled.
 */
const displayName = (p: Person) => p.name_sk || p.name;

/** A source entry is either a bare wikipedia:Slug token or a full URL. */
function sourceHref(s: string): string | null {
  if (/^https?:\/\//.test(s)) return s;
  const wiki = s.match(/^wikipedia:(.+)$/);
  if (wiki) return `https://en.wikipedia.org/wiki/${encodeURIComponent(wiki[1])}`;
  return null;
}

function sourceLabel(s: string): string {
  if (/^https?:\/\//.test(s)) {
    try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return s; }
  }
  return s.replace(/^wikipedia:/, '').replace(/_/g, ' ');
}

function PersonCard({
  person, side, labels, expanded, onToggle, cardRef,
}: {
  person: Person;
  side: 'left' | 'right';
  labels: ReturnType<typeof getSection4Content>['labels'];
  expanded: boolean;
  onToggle: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const returned = person.current_location.endsWith('SK');
  return (
    <li className={`people-item people-item-${side}`}>
      {/* The dot sits on the spine and carries the year, so the timeline reads as a
          chronology rather than as a list that happens to be sorted. */}
      <span className="people-node" aria-hidden="true" />
      <p className="people-year">{person.left_year}</p>

      <div ref={cardRef} className={`people-card${expanded ? ' is-open' : ''}`}>
        <div className="people-card-head">
          <h3 className="people-name">{displayName(person)}</h3>
          <p className="people-meta">
            {person.field} · {person.current_location}
            {returned && <span className="people-returned">{labels.returned}</span>}
          </p>
          <p className="people-sub">
            {labels.leftIn} {person.left_year} {labels.aged} {person.age_at_leaving}
            {' · '}
            {person.slovak_education_completed === 'tertiary'
              ? labels.tertiary
              : labels.primaryOnly}
          </p>
        </div>

        <button type="button" className="people-toggle" onClick={onToggle}
          aria-expanded={expanded}>
          {expanded ? labels.collapse : labels.expand}
        </button>

        {expanded && (
          <div className="people-detail">
            <p className="people-narrative">{person.narrative}</p>
            <dl className="people-facts">
              <dt>{labels.trigger}</dt>
              <dd>{person.trigger}</dd>
              <dt>{labels.impact}</dt>
              <dd>{person.impact}</dd>
              <dt>{labels.path}</dt>
              <dd>{[person.birth_place, ...person.destination_path].join(' → ')}</dd>
              <dt>{labels.sources}</dt>
              <dd>
                {person.sources.map((s, i) => {
                  const href = sourceHref(s);
                  return (
                    <React.Fragment key={s}>
                      {i > 0 && ', '}
                      {href
                        ? <a href={href} target="_blank" rel="noopener noreferrer">{sourceLabel(s)}</a>
                        : sourceLabel(s)}
                    </React.Fragment>
                  );
                })}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </li>
  );
}

function Section4() {
  const locale = useLocale();
  const c = getSection4Content(locale);
  const [data, setData] = useState<PeopleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const cardEls = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch('/data/notable_people.json')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)));
  }, []);

  /** Chronological, which is what makes it a timeline. */
  const ordered = useMemo(
    () => (data ? [...data.people].sort((a, b) => a.left_year - b.left_year) : []),
    [data],
  );

  const agePeople = useMemo<AgePerson[]>(
    () => ordered.map(p => ({
      id: p.id,
      name: displayName(p),
      ageAtLeaving: p.age_at_leaving,
      tertiary: p.slovak_education_completed === 'tertiary',
      returned: p.current_location.endsWith('SK'),
    })),
    [ordered],
  );

  /** Clicking a point in the chart opens that person's card and scrolls to it. */
  function reveal(id: string) {
    setOpenId(id);
    requestAnimationFrame(() => {
      cardEls.current[id]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  if (error) return <p className="section4-error">Error: {error}</p>;
  if (!data) return null;

  return (
    <div className="section4">
      {!c.reviewed && c.translationNotice && (
        <p className="section4-notice">{c.translationNotice}</p>
      )}

      <header className="section4-head">
        <h1 className="section4-h1">{c.h1}</h1>
      </header>

      <div className="section4-prose">
        {c.intro.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <AnimateOnScroll>
        {animated => (
          <figure className="section4-figure">
            <figcaption className="section4-figure-head">
              <h2 className="section4-h2">{c.chartTitle}</h2>
            </figcaption>
            <PeopleAgeChart people={agePeople} labels={c.labels} onSelect={reveal} animated={animated} />
            <div className="chart-caption-row">
              <p className="section4-caption">{c.chartCaption}</p>
              <AboutData label={c.aboutLabel} panel={c.sources.ages} />
            </div>
          </figure>
        )}
      </AnimateOnScroll>

      <h2 className="section4-h2 section4-h2-standalone">{c.cardsTitle}</h2>

      <ol className="people-timeline">
        {ordered.map((p, i) => (
          <PersonCard
            key={p.id}
            person={p}
            side={i % 2 === 0 ? 'left' : 'right'}
            labels={c.labels}
            expanded={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            cardRef={el => { cardEls.current[p.id] = el; }}
          />
        ))}
      </ol>

      <div className="section4-prose">
        {c.closing.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {/* The selection rule and the search-bias correction. Open by default: a
          hand-curated list has to disclose how it was curated, and putting that
          behind a summary is how it gets missed. */}
      <section className="section4-caveats">
        <h2 className="section4-caveats-title">{c.caveatsTitle}</h2>
        <p>{c.criteriaNote}</p>
        <p>{data.section_caveats}</p>
      </section>
    </div>
  );
}

export default Section4;

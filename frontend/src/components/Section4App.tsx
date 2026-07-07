import React, { useEffect, useState } from 'react';

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

function PersonCard({ person }: { person: Person }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: '6px',
        padding: '1rem',
        marginBottom: '1rem',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{person.name}</h3>
        <span style={{ fontSize: '0.8rem', color: '#666' }}>
          left {person.left_year}, age {person.age_at_leaving}
        </span>
      </div>
      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}>
        {person.field} - {person.current_location}
      </p>
      {expanded && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          <p><strong>Trigger:</strong> {person.trigger}</p>
          <p style={{ marginTop: '0.5rem' }}>{person.narrative}</p>
          <p style={{ marginTop: '0.5rem' }}><strong>Impact:</strong> {person.impact}</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
            Path: {person.destination_path.join(' → ')}
          </p>
        </div>
      )}
    </div>
  );
}

function AgeHistogram({ people }: { people: Person[] }) {
  const buckets: Record<string, number> = { '0-14': 0, '15-19': 0, '20-24': 0, '25-29': 0, '30-34': 0, '35-39': 0, '40+': 0 };
  for (const p of people) {
    const age = p.age_at_leaving;
    if (age < 15) buckets['0-14']++;
    else if (age < 20) buckets['15-19']++;
    else if (age < 25) buckets['20-24']++;
    else if (age < 30) buckets['25-29']++;
    else if (age < 35) buckets['30-34']++;
    else if (age < 40) buckets['35-39']++;
    else buckets['40+']++;
  }
  const max = Math.max(...Object.values(buckets));

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3>Age at Leaving</h3>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'end', height: '80px' }}>
        {Object.entries(buckets).map(([label, count]) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: '100%',
              height: `${(count / max) * 60}px`,
              background: count > 0 ? 'var(--accent-primary)' : '#eee',
              borderRadius: '2px 2px 0 0',
              minHeight: '2px',
            }} />
            <span style={{ fontSize: '0.7rem', marginTop: '4px' }}>{label}</span>
            {count > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{count}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section4() {
  const [data, setData] = useState<PeopleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/notable_people.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>Failed to load notable people data.</p>;

  const emigrants = data.people.filter(p => p.current_location !== 'Bratislava, SK');

  return (
    <div>
      <AgeHistogram people={data.people} />

      <h2>People</h2>
      {data.people.map(person => (
        <PersonCard key={person.id} person={person} />
      ))}

      <details style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#555' }}>
        <summary>Section methodology note</summary>
        <p style={{ marginTop: '0.5rem' }}>{data.section_caveats}</p>
      </details>
    </div>
  );
}

export default Section4;

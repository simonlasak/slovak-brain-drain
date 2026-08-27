/**
 * Diffs two snapshots from snapshot.mjs and reports the first divergence per route.
 *
 *   node tools/verify/compare.mjs /tmp/before.json /tmp/after.json
 *
 * Exits 0 when the two are identical, 1 when they differ, so it can gate a commit.
 *
 * Reading the output: a refactor that is meant to be invisible should report
 * IDENTICAL on every route. A prose correction should report chart marks unchanged
 * and a text delta, which is the shape you want when fixing a figure. Chart marks
 * changing when you did not intend to touch a chart is the finding worth stopping
 * for.
 */
import { readFileSync } from 'node:fs';

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error('usage: node tools/verify/compare.mjs <before.json> <after.json>');
  process.exit(1);
}

const load = p => {
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  // Tolerate both the current shape and a bare route map.
  return raw.routes ?? raw;
};

const a = load(aPath);
const b = load(bPath);
let differs = false;

for (const route of Object.keys(a)) {
  if (!(route in b)) {
    console.log(`${route.padEnd(12)} MISSING from the second snapshot`);
    differs = true;
    continue;
  }
  const ra = a[route];
  const rb = b[route];
  const notes = [];

  const sameText = ra.text === rb.text;
  if (!sameText) {
    const delta = rb.textLength - ra.textLength;
    notes.push(`text differs (${delta >= 0 ? '+' : ''}${delta} chars)`);
    for (let i = 0; i < Math.min(ra.text.length, rb.text.length); i++) {
      if (ra.text[i] !== rb.text[i]) {
        notes.push(`  first at char ${i}:`);
        notes.push(`    before: ${JSON.stringify(ra.text.slice(i, i + 90))}`);
        notes.push(`    after : ${JSON.stringify(rb.text.slice(i, i + 90))}`);
        break;
      }
    }
  }

  let sameMarks = ra.svgs.length === rb.svgs.length;
  if (!sameMarks) {
    notes.push(`svg count ${ra.svgs.length} -> ${rb.svgs.length}`);
  } else {
    for (const [sa, sb] of ra.svgs.map((s, i) => [s, rb.svgs[i]])) {
      if (JSON.stringify(sa.marks) !== JSON.stringify(sb.marks)) {
        sameMarks = false;
        notes.push(`svg[${sa.index}] marks differ (${sa.markCount} vs ${sb.markCount})`);
        for (let j = 0; j < Math.min(sa.marks.length, sb.marks.length); j++) {
          if (JSON.stringify(sa.marks[j]) !== JSON.stringify(sb.marks[j])) {
            notes.push(`    mark ${j}: ${JSON.stringify(sa.marks[j])} -> ${JSON.stringify(sb.marks[j])}`);
            break;
          }
        }
        break;
      }
    }
  }

  const newErrors = (rb.errors || []).filter(e => !(ra.errors || []).includes(e));
  if (newErrors.length) notes.push(`NEW console errors: ${newErrors.length}`);

  if (notes.length) differs = true;
  const verdict = notes.length === 0
    ? 'IDENTICAL'
    : (sameMarks ? 'chart marks unchanged, text differs' : 'CHARTS DIFFER');
  console.log(`${route.padEnd(12)} ${verdict}`);
  notes.forEach(n => console.log('   ' + n));
}

console.log(differs ? '\nDIFFERENCES FOUND' : '\nidentical on every route');
process.exit(differs ? 1 : 0);

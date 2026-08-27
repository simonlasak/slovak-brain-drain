/**
 * Fingerprints every rendered chart and every character of visible text, so a
 * refactor can be proved data-neutral instead of eyeballed.
 *
 *   cd frontend && npm run build && npm run preview      # in one terminal
 *   node tools/verify/snapshot.mjs /tmp/before.json      # before your change
 *   ...make the change, rebuild...
 *   node tools/verify/snapshot.mjs /tmp/after.json
 *   node tools/verify/compare.mjs /tmp/before.json /tmp/after.json
 *
 * This is what caught nothing (which was the point) when DuckDB-WASM was removed
 * from the browser and when the GeoJSON files were re-encoded: 1,267 SVG marks
 * across five routes, byte-identical before and after. A pixel diff would not have
 * been conclusive and reading the charts would not have been either.
 *
 * WHAT IT DOES NOT COVER. The §1 and §2 maps are deck.gl drawing into a WebGL
 * canvas, so no mark of theirs appears here. Verify those separately: check the
 * canvas has a live GL context, and check the data feeding them at the source. §3's
 * map is SVG and IS covered.
 *
 * Requires Playwright, which is deliberately not a project dependency: it is only
 * needed when verifying, and adding it would make every Cloudflare build install
 * it. Run `npm i -D playwright && npx playwright install chromium` first, or run
 * this via `npx -p playwright node tools/verify/snapshot.mjs ...`.
 */
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const BASE = process.env.SBD_BASE || 'http://localhost:4321';
if (!OUT) {
  console.error('usage: node tools/verify/snapshot.mjs <outfile.json>');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not resolvable. It is not a project dependency on purpose.\n' +
    '  npm i -D playwright && npx playwright install chromium\n' +
    'then run this again.'
  );
  process.exit(1);
}

// Only routes that render charts. /methodology, /resources and /404 are static
// prose and are covered by the build, not by this.
const ROUTES = ['/', '/internal', '/corridor', '/diaspora', '/people'];

const browser = await chromium.launch({ headless: true });
const snapshot = { _base: BASE, routes: {} };

for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 160));
  });

  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Walk the page so every IntersectionObserver fires and every entrance
  // animation finishes. Geometry is only comparable at rest: sampling mid-animation
  // produces a fingerprint that differs from itself run to run.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(4000);

  const data = await page.evaluate(() => {
    const num = v => {
      if (v === null || v === undefined || v === '') return null;
      const f = parseFloat(v);
      return Number.isNaN(f) ? v : Math.round(f * 100) / 100;
    };
    const svgs = [...document.querySelectorAll('main svg')].map((svg, i) => {
      const marks = [];
      svg.querySelectorAll('rect, circle, line, path, text').forEach(el => {
        const t = el.tagName.toLowerCase();
        if (t === 'text') marks.push(['text', el.textContent.trim()]);
        else if (t === 'rect') marks.push(['rect', num(el.getAttribute('x')), num(el.getAttribute('y')), num(el.getAttribute('width')), num(el.getAttribute('height'))]);
        else if (t === 'circle') marks.push(['circle', num(el.getAttribute('cx')), num(el.getAttribute('cy')), num(el.getAttribute('r'))]);
        else if (t === 'line') marks.push(['line', num(el.getAttribute('x1')), num(el.getAttribute('y1')), num(el.getAttribute('x2')), num(el.getAttribute('y2'))]);
        else if (t === 'path') {
          // Path data is long. Hash it: still exact, but keeps the file readable.
          const d = el.getAttribute('d') || '';
          let h = 0;
          for (let k = 0; k < d.length; k++) h = ((h << 5) - h + d.charCodeAt(k)) | 0;
          marks.push(['path', d.length, h]);
        }
      });
      return { index: i, viewBox: svg.getAttribute('viewBox'), markCount: marks.length, marks };
    });
    const text = document.querySelector('main').innerText.replace(/\s+/g, ' ').trim();
    return { svgs, textLength: text.length, text };
  });

  snapshot.routes[route] = { ...data, errors };
  const marks = data.svgs.reduce((s, x) => s + x.markCount, 0);
  console.log(`${route.padEnd(12)} svgs=${data.svgs.length} marks=${marks} textChars=${data.textLength} errors=${errors.length}`);
  errors.slice(0, 3).forEach(e => console.log('     ' + e));
  await ctx.close();
}

await browser.close();
writeFileSync(OUT, JSON.stringify(snapshot, null, 1));
console.log('\nwritten to ' + OUT);

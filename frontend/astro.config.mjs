import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// No MDX integration: sections render from the bilingual TypeScript content
// modules in src/content (MDX cannot interleave the scrollytelling maps with
// charts). The files in src/content/sections are editorial drafts only, not a
// render source. Keeping the integration installed also registered an MDX
// renderer whose capability probe *calls* each island component outside React's
// render cycle, which made every island using a hook log a spurious
// "Invalid hook call" warning during SSR.
export default defineConfig({
  integrations: [react()],
  output: 'static',
  // Deployed origin. Astro.site is what Base.astro builds og:url and the
  // canonical link from, so these are absolute in the built HTML rather than
  // path-relative (crawlers and social scrapers require absolute).
  site: 'https://slovak-brain-drain.pages.dev',
  vite: {
    optimizeDeps: {
      exclude: ['@duckdb/duckdb-wasm'],
    },
  },
});

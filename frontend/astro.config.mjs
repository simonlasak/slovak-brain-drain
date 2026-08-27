import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// No MDX integration: sections render from the bilingual TypeScript content
// modules in src/content (MDX cannot interleave the scrollytelling maps with
// charts). The files in src/content/sections are editorial drafts only, not a
// render source. Keeping the integration installed also registered an MDX
// renderer whose capability probe *calls* each island component outside React's
// render cycle, which made every island using a hook log a spurious
// "Invalid hook call" warning during SSR.
export default defineConfig({
  integrations: [
    react(),
    // Emits sitemap-index.xml plus sitemap-0.xml, both derived from `site` below
    // and from the built routes, so a new page cannot be left out of the sitemap
    // by forgetting to list it somewhere.
    sitemap({
      // 404 is the one route that must not be advertised: submitting an error
      // page for indexing is a contradiction, and Base.astro already sends it
      // `noindex`. Astro emits it as /404.html rather than a directory, so match
      // on that.
      filter: page => !page.includes('/404'),
      // No `lastmod`, `changefreq` or `priority` on purpose.
      //
      // The integration can only stamp one timestamp across every page, which
      // means build time. That would claim all seven pages changed on every
      // deploy, including the six that did not, and Google's own guidance is that
      // it discounts lastmod once it finds it unreliable. A field that overstates
      // is worse than an absent one, which is the same rule the rest of this
      // project applies to figures. `changefreq` and `priority` are hints
      // crawlers largely ignore, so inventing values for them buys nothing.
      //
      // Per-page lastmod from git history would be honest and is worth doing if
      // this site ever updates page by page rather than as a whole.
    }),
  ],
  output: 'static',
  // Deployed origin. Astro.site is what Base.astro builds og:url and the
  // canonical link from, so these are absolute in the built HTML rather than
  // path-relative (crawlers and social scrapers require absolute).
  site: 'https://slovak-brain-drain.simonlasak4.workers.dev',
});

# Design System — Slovak Brain Drain Case Study

This is the single source of truth for every visual decision in the project. Paste the entire file (or its relevant sections) into Claude Code or Claude Design at the start of any session that generates UI. Do not assume previous context carries over.

## Visual personality

**Direction:** Folk-modern. A serious editorial aesthetic grounded in Slovak visual heritage, executed with restraint. Warm but not nostalgic. Local but not parochial.

**Adjectives:** editorial, warm, considered, distinctively Slovak, restrained, slightly formal.

**Anti-examples:** corporate SaaS, Stripe-lookalike, "startup modern", glassmorphism, dark mode default, Inter-everything, generic Tailwind starter, tourist-shop folk kitsch, painted-wood textures, "rustic" hand-drawn effects.

**References:**
- Texty.org.ua (Ukrainian investigative data journalism with national visual heritage)
- NYT magazine longform
- Pangram Pangram Foundry
- Tomáš Kompaník brand work (čičmany applied to B2B identity)
- The Pudding longform features
- Source Serif's specimen pages

---

## Typography

### Fonts (load all three)

**Primary serif — `Source Serif 4`**
- Used for: headlines, large numbers in hero positions, lede paragraphs, body copy in long-form sections
- Free via Google Fonts: `https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&display=swap`
- Variable font, optical size axis — use `font-optical-sizing: auto`
- Critical reason: exemplary Slovak diacritic rendering (ä, č, ď, ô, ľ, ŕ, š, ť, ž all sit beautifully on the baseline)

**UI sans — `Pangram Sans` (preferred) or `Pangram Sans Rounded`**
- Used for: navigation, buttons, labels, captions, table cells, tooltips
- Made by Pangram Pangram, the Slovak type foundry — paid for commercial use, free trial weights available
- Fallback if Pangram budget is an issue: `Inter Tight` (free Google Font) — also handles Slovak diacritics well
- **Do not fall back to plain Inter** — Inter Tight specifically; the tighter tracking is closer to the Pangram Sans feel

**Monospace — `JetBrains Mono`**
- Used for: data tables, source citations, code-like UI (table codes, ISO codes, NACE letters), tabular numbers in charts
- Free via Google Fonts

### Scale

Name every size explicitly. Do not improvise.

```
Display:        60px  / line-height 1.0  / weight 400  / Source Serif 4
Hero number:    72px  / line-height 1.0  / weight 400  / Source Serif 4 / letter-spacing -0.02em
H1 (page):      42px  / line-height 1.1  / weight 500  / Source Serif 4
H2 (section):   32px  / line-height 1.15 / weight 500  / Source Serif 4
H3 (sub):       24px  / line-height 1.25 / weight 500  / Source Serif 4
H4 (card):      18px  / line-height 1.35 / weight 500  / Pangram Sans
Body large:     18px  / line-height 1.6  / weight 400  / Source Serif 4
Body:           16px  / line-height 1.6  / weight 400  / Pangram Sans
Caption:        14px  / line-height 1.5  / weight 400  / Pangram Sans
Micro:          11px  / line-height 1.4  / weight 500  / Pangram Sans / letter-spacing 0.12em / uppercase
```

### Weights — strict

- 400 regular (body)
- 500 medium (headlines, UI labels, table headers)
- 600 semibold — used only for hero display numbers when they need to stand out

**Never use 700 or 800.** They look heavy against the warm cream background.

### Case rules

- Sentence case for everything: page titles, section titles, button labels, navigation
- ALL CAPS reserved exclusively for the 11px `Micro` style used as section eyebrows (e.g. "§2 · ČESKÝ KORIDOR")
- Slovak ALL CAPS needs extra letter-spacing (0.12em); Slovak diacritics on caps look cramped at default spacing

### Bilingual treatment

The site is bilingual. Section titles render Slovak primary (Source Serif 4, 32px, weight 500) with English subtitle below (Pangram Sans, 14px, weight 400, muted color).

Example:
```
Český koridor
The Czech corridor
```

Numbers use the European convention: thousands separated by non-breaking space (`240 000`), not comma. Decimal separator is comma in Slovak prose, period in English.

---

## Color palette

Every color has a role and a hex value. No improvisation.

### Surfaces

```
--bg-page:        #FBF7F0   /* cream — main page background */
--bg-surface:     #FFFFFF   /* white — card and panel surfaces */
--bg-nested:      #F4EFE3   /* slightly darker cream for nested elements */
--bg-inverse:     #2A1810   /* dark coffee — used only for footer and overlay backgrounds */
```

### Text

```
--text-primary:   #2A1810   /* dark coffee — main copy */
--text-secondary: #6B4A2F   /* muted coffee — captions, secondary info */
--text-tertiary:  #8B6F4F   /* light muted — hints, metadata */
--text-inverse:   #FBF7F0   /* cream on dark surfaces */
```

### Accents

```
--accent-primary:        #B83A1F   /* terracotta red — CTAs, links, "Slovakia" data series */
--accent-primary-hover:  #9A2F18   /* darker terracotta */
--accent-primary-light:  #FBE0D8   /* lightest terracotta tint for backgrounds */

--accent-secondary:       #2A6B8B  /* Tatra blue — "abroad" data series, secondary actions */
--accent-secondary-hover: #1F5570
--accent-secondary-light: #DCE9EE

--accent-tertiary:        #D4A547  /* harvest gold — borders, dividers, highlights */
--accent-tertiary-hover:  #B88A35
--accent-tertiary-light:  #F5E8C4
```

### Borders

```
--border-subtle:    #E8DDC8   /* default border on cards, inputs */
--border-emphasis:  #D4A547   /* highlighted borders, table headers */
--border-strong:    #2A1810   /* rare, used for emphasis frames */
```

### Semantic

```
--state-success:  #4A7D3F   /* olive green — success states */
--state-warning:  #C97D1E   /* warm orange — warnings, interpolated data flags */
--state-error:    #A02E1A   /* deep red — errors */
--state-info:     #2A6B8B   /* Tatra blue, same as accent-secondary */
```

### Data visualization scales

For choropleths and gradients in maps and charts. Use ColorBrewer-compatible scales tuned to the brand palette.

**Net loss / outflow (terracotta scale, 5 steps):**
```
#FBE0D8  →  #E89A82  →  #B83A1F  →  #8A2812  →  #5A1808
```

**Net gain / inflow (Tatra blue scale, 5 steps):**
```
#DCE9EE  →  #6FA0B8  →  #2A6B8B  →  #1F5570  →  #143B4D
```

**Diverging (loss ↔ gain, 9 steps, white middle):**
```
#5A1808  #8A2812  #B83A1F  #E89A82  #FBF7F0  #6FA0B8  #2A6B8B  #1F5570  #143B4D
```

**Neutral / categorical (3-step warm gray for when color shouldn't encode a value):**
```
#F4EFE3  #8B6F4F  #2A1810
```

### Do not use

- Pure white `#FFFFFF` as page background (only as card surface on cream)
- Pure black `#000000` as text (use `#2A1810`)
- Any blue close to `#3B82F6` (the Tailwind/Claude default)
- Any indigo or violet
- Green outside the success semantic
- Multi-color rainbow categorical scales

---

## Spacing & shape

### Spacing system

Base unit: **4px**. Always a multiple.

```
4, 8, 12, 16, 24, 32, 48, 64, 96, 128
```

Use CSS variables:
```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-12: 48px
--space-16: 64px
--space-24: 96px
--space-32: 128px
```

### Vertical rhythm

- Between body paragraphs: 1.25rem
- Between subsections: 2rem
- Between major sections: 4rem
- Between hero and content: 5rem

### Border radius

```
--radius-none: 0       /* panels, full-bleed elements */
--radius-sm:   4px     /* buttons, inputs, small cards, tags */
--radius-md:   8px     /* larger cards, modals */
```

**Never use radius greater than 8px.** No pills. No `rounded-full`.

### Borders

- Default border width: **1px**
- Strong emphasis: 2px (used very rarely, e.g. selected state on filter chips)
- Never 3px or above
- Color defaults to `--border-subtle`; hover and active states to `--border-emphasis`

### Shadows

Generally none. Single subtle shadow allowed only on floating elements (tooltips, dropdowns, popovers):

```
--shadow-floating: 0 4px 12px rgba(42, 24, 16, 0.08)
```

**Never use multi-layer shadows, elevation systems, or dramatic depth.**

---

## Folk motif system

This is the distinctive element. Used sparingly and with discipline. The test: if removing the motif would make the page feel cleaner, kill it. It only earns its place if its absence would make the page feel less Slovak.

### The primitive

The single shape allowed is the **Čičmany diamond** — a 4-pointed star derived from the geometric folk patterns of Čičmany village. Sharp edges, no curves, no shading.

```
Basic diamond:
        ◆
SVG:    <path d="M 0 -h L w 0 L 0 h L -w 0 Z" fill="..." />
```

A second permitted primitive is the **sun rosette** — 8 thin elongated diamonds arranged around a center circle, used only as the hero watermark.

### Applications

**1. Hero watermark.** A single sun rosette positioned in the top-right of section hero blocks. 280×280px maximum. Opacity 6–8%. Color: terracotta `#B83A1F`. Used only on §1, §2, §3, §4 landing positions — not on sub-pages.

**2. Data point markers.** Time-series charts use small diamonds (6–8px) instead of circles for data points. Current-year or selected marker is larger (10–12px) with a 2px white stroke for emphasis.

**3. Map city markers.** Slovak cities on maps are marked with diamonds scaled by population (4–14px). Color: terracotta for SK cities, Tatra blue for foreign cities. Replaces generic circle pins.

**4. Section dividers.** Between major content blocks, a row of 7 diamonds graduates in size from large (outside) to small (center) to large (outside), or all small with a single center circle. Replaces horizontal rules.

**5. Loading states.** When a chart fetches data, animate the diamonds in the chart's eventual marker positions appearing one by one, building toward the final visualization. Three seconds maximum.

**6. Filter chip selection.** Active filter chips show a small diamond (8px) before the label.

**7. List bullets.** In Section 4 narrative cards, biographical detail lists use the diamond as a bullet character instead of `•`.

### Constraints

- **One motif type per page maximum** — never mix the sun rosette and the diamond in the same composition (the diamond IS part of the rosette, so they read as the same family when separate)
- **Watermark opacity never exceeds 8%**
- **No motif larger than 280px**
- **No motif as foreground decoration** — every use must be functional (marker, divider, bullet, watermark)
- **No animated motifs except in loading states**
- **No folk imagery beyond these primitives** — no embroidered borders, no folk costume illustrations, no painted-wood textures, no rustic effects

---

## Component conventions

### Buttons

**Primary:**
```
background:    --accent-primary
color:         --text-inverse
border:        none
padding:       12px 24px
border-radius: --radius-sm
font:          Pangram Sans, 14px, weight 500
case:          sentence (never UPPERCASE)
hover:         background --accent-primary-hover
active:        transform scale(0.98)
```

**Secondary (ghost):**
```
background:    transparent
color:         --text-primary
border:        1px solid --border-emphasis
padding:       12px 24px
border-radius: --radius-sm
hover:         background --bg-nested
```

**No gradients. No drop shadows. No glow effects.**

### Inputs

```
background:    --bg-surface
border:        1px solid --border-subtle
border-radius: --radius-sm
padding:       12px 16px
font:          Pangram Sans, 16px, weight 400
focus:         border --accent-primary, outline 3px solid --accent-primary at 20% opacity
placeholder:   --text-tertiary
```

### Cards

```
background:    --bg-surface
border:        1px solid --border-subtle
border-radius: --radius-md
padding:       24px
```

Hover state on interactive cards: border becomes `--border-emphasis`. No transform, no scale, no shadow change.

### Filter chips

```
background:    --bg-surface
border:        1px solid --border-subtle
padding:       6px 14px
border-radius: --radius-sm
font:          Pangram Sans, 14px, weight 500

active:
background:    --accent-primary-light
border:        1px solid --accent-primary
color:         --accent-primary-hover
prefix:        ◆ (8px diamond)
```

### Tables

```
header:
background:    transparent
border-bottom: 1px solid --border-emphasis
font:          Pangram Sans, 11px, weight 500, uppercase, letter-spacing 0.08em
padding:       12px 16px

rows:
border-bottom: 1px solid --border-subtle
padding:       12px 16px
font:          Pangram Sans for text, JetBrains Mono for numbers

zebra: optional, --bg-nested on alternating rows
```

No outer table border.

### Tooltips

```
background:    --bg-surface
border:        1px solid --border-subtle
border-radius: --radius-sm
padding:       10px 14px
font:          Pangram Sans, 13px, weight 400
shadow:        --shadow-floating
arrow:         optional, same color as border
```

### Tabs (within sections)

```
list:
border-bottom: 1px solid --border-subtle

tab:
padding:       12px 20px
font:          Pangram Sans, 14px, weight 500
color:         --text-secondary

tab[active]:
color:         --text-primary
border-bottom: 2px solid --accent-primary
margin-bottom: -1px
```

Text-only. Never with icons.

### Navigation

Top horizontal bar (not sidebar). Items as text-only links. Active item has 2px terracotta underline.

```
height:        72px
background:    --bg-page (no separate color)
border-bottom: 1px solid --border-subtle

nav links:
font:          Pangram Sans, 14px, weight 500
spacing:       32px between items
```

### Section eyebrow

The small uppercase label that precedes section titles:

```
font:           Pangram Sans, 11px, weight 500
letter-spacing: 0.12em
text-transform: uppercase
color:          --text-secondary
margin-bottom:  24px
format:         §N · LABEL (e.g. "§2 · ČESKÝ KORIDOR")
```

---

## Layout rules

### Page max widths

```
--max-prose:   720px    /* body text, long-form reading */
--max-content: 1080px   /* charts, figures */
--max-page:    1440px   /* outer wrapper */
```

### Page padding

```
mobile:   24px horizontal
tablet:   48px horizontal
desktop:  64px horizontal
```

### Grid

12-column grid with 24px gutter on desktop. On mobile, single column.

### Sections do not have full-bleed colored backgrounds

The page background `--bg-page` carries through the entire site. Sections are delimited by typography, spacing, and the folk dividers — never by changing the background color.

**Exception:** the footer uses `--bg-inverse` (dark coffee) for visual closure.

### What this site does NOT use

- Full-width hero sections with centered text and CTA button
- Icon-grid "feature" sections
- Testimonial carousels
- Three-column footers with link lists
- Sticky sidebars
- Modal dialogs for primary content (only for confirmations)
- Hamburger menus on desktop
- Hero gradient backgrounds
- Auto-playing video
- Parallax backgrounds

---

## Motion

Motion is purposeful and restrained.

### Library choices

- **Framer Motion** — component transitions, layout animations, presence transitions
- **GSAP** — sequenced animations, scroll-driven timelines
- **Scrollama** (via `react-scrollama`) — scroll-trigger management
- Native CSS transitions for hover states (don't reach for JS for a hover)

### Timings

```
--duration-instant:  100ms    /* hover state, focus ring */
--duration-fast:     200ms    /* button press, dropdown */
--duration-base:     320ms    /* card hover, tab switch */
--duration-slow:     600ms    /* page transitions, chart updates */
--duration-cinematic: 1200ms  /* map flyovers, data reveals */

--easing-default:    cubic-bezier(0.2, 0, 0, 1)
--easing-emphasis:   cubic-bezier(0.3, 0, 0, 1.2)
--easing-decelerate: cubic-bezier(0, 0, 0.2, 1)
```

### What animates

- Map view changes (camera pan/zoom): cinematic timing, decelerate easing
- Chart updates when filter changes: 600ms with stagger
- Number tickers when stats change: 400-800ms count-up
- Section eyebrow fade-in on scroll into view: 320ms
- Loading states: continuous, 3s maximum
- Hover on cards and buttons: 200ms

### What does NOT animate

- Page navigation (instant — no full-page transition wipes)
- Text appearance (no typewriter effects, no character-by-character reveals)
- The site logo
- The folk watermark (static)

Respect `prefers-reduced-motion: reduce` everywhere. When set:
- All cinematic/slow transitions become 0ms
- Number tickers become instant
- Loading state animations become static placeholders
- Map fly-overs become instant jump cuts

---

## Data visualization

### Stack

Vega-Lite is OUT. The stack:

- **Maps:** `deck.gl` for overlays + `maplibre-gl` for base tile rendering. Custom Maplibre style (see below) — not Mapbox defaults.
- **Charts:** `@visx/*` for React-friendly D3 primitives. Drop to raw `d3` only when visx doesn't have the building blocks you need.
- **Tables:** `@tanstack/react-table` for sortable, filterable data tables.
- **Animation:** `framer-motion` + `gsap` (for scrollytelling timelines).
- **Scroll triggers:** `react-scrollama`.

### Chart styling defaults

```
axis line:        --border-emphasis at 60% opacity, 1px
gridline:         --border-subtle, 1px dashed
axis label:       Pangram Sans, 11px, weight 500, --text-secondary, uppercase, letter-spacing 0.08em
tick label:       JetBrains Mono, 11px, weight 400, --text-secondary
data label:       Pangram Sans, 12px, weight 500, --text-primary
chart title:      Source Serif 4, 18px, weight 500
chart subtitle:   Pangram Sans, 14px, --text-secondary
source citation:  JetBrains Mono, 11px, --text-tertiary, prefixed "src:"
```

### Map style (Maplibre)

Custom style JSON. Key rules:

- Base land color: `#F4EFE3` (matches `--bg-nested`)
- Water: `#DCE9EE` (matches `--accent-secondary-light`)
- Country borders: 0.5px `#D4A547` at 40% opacity
- City labels: Pangram Sans, 11px, `--text-primary`
- Selected country: `--accent-primary` fill at 25% opacity, 1.5px stroke at full opacity
- Hover: `--accent-tertiary` fill at 15% opacity, 1px stroke

### deck.gl layer conventions

- **ChoroplethLayer** for the kraj/okres maps in Section 1 — use the diverging palette
- **ScatterplotLayer with custom shape** for city markers — diamond instead of circle, sized by metric
- **ArcLayer** for migration flows in Section 2 and 3 — source color `--accent-primary`, target color `--accent-secondary`, animated with `getSourceColor` / `getTargetColor` interpolation
- **HexagonLayer** is forbidden (overused in deck.gl tutorials, looks generic)
- **HeatmapLayer** for the world diaspora map — terracotta scale, no green/blue rainbow

### Number formatting

- Slovak: 240 000 (non-breaking space thousands separator), decimal comma
- English: 240,000 (comma thousands), decimal period
- Always round before display — no JS float artifacts
- Percentages: one decimal place by default ("23.4%"), zero decimals for round numbers ("25%")
- Currency: € prefix, space, then number ("€ 1 245")

---

## Accessibility

- Color contrast minimum: 4.5:1 for body text, 3:1 for large text (verified against `#FBF7F0` background)
- Focus rings always visible: 3px solid `--accent-primary` at 20% opacity, never `outline: none` without replacement
- All interactive elements keyboard accessible
- Charts include a "View data" toggle that exposes the underlying table
- Maps include a text alternative listing for screen readers
- Respect `prefers-reduced-motion`
- Slovak diacritic-safe fonts only (verified for ä, č, ď, ô, ľ, ŕ, š, ť, ž)
- Language attributes set correctly: `lang="sk"` on Slovak text, `lang="en"` on English

---

## CSS variable export

Drop this block into the root stylesheet:

```css
:root {
  /* Surfaces */
  --bg-page: #FBF7F0;
  --bg-surface: #FFFFFF;
  --bg-nested: #F4EFE3;
  --bg-inverse: #2A1810;

  /* Text */
  --text-primary: #2A1810;
  --text-secondary: #6B4A2F;
  --text-tertiary: #8B6F4F;
  --text-inverse: #FBF7F0;

  /* Accents */
  --accent-primary: #B83A1F;
  --accent-primary-hover: #9A2F18;
  --accent-primary-light: #FBE0D8;
  --accent-secondary: #2A6B8B;
  --accent-secondary-hover: #1F5570;
  --accent-secondary-light: #DCE9EE;
  --accent-tertiary: #D4A547;
  --accent-tertiary-hover: #B88A35;
  --accent-tertiary-light: #F5E8C4;

  /* Borders */
  --border-subtle: #E8DDC8;
  --border-emphasis: #D4A547;
  --border-strong: #2A1810;

  /* States */
  --state-success: #4A7D3F;
  --state-warning: #C97D1E;
  --state-error: #A02E1A;
  --state-info: #2A6B8B;

  /* Type */
  --font-serif: 'Source Serif 4', Georgia, serif;
  --font-sans: 'Pangram Sans', 'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;

  /* Space */
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --space-12: 48px; --space-16: 64px; --space-24: 96px; --space-32: 128px;

  /* Radius */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;

  /* Shadow */
  --shadow-floating: 0 4px 12px rgba(42, 24, 16, 0.08);

  /* Motion */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-base: 320ms;
  --duration-slow: 600ms;
  --duration-cinematic: 1200ms;
  --easing-default: cubic-bezier(0.2, 0, 0, 1);
  --easing-emphasis: cubic-bezier(0.3, 0, 0, 1.2);
  --easing-decelerate: cubic-bezier(0, 0, 0.2, 1);

  /* Layout */
  --max-prose: 720px;
  --max-content: 1080px;
  --max-page: 1440px;
}
```

---

## Changelog

- **2026-05-23** (initial): Direction B (Folk-modern) locked in. Source Serif 4 + Pangram Sans + JetBrains Mono. Terracotta primary, Tatra blue secondary, harvest gold tertiary. Čičmany diamond + sun rosette as the only folk motifs. Dataviz stack: deck.gl + visx + Framer Motion + Scrollama.

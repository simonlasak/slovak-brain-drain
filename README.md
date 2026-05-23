# Odchod / Departure

### An interactive case study of Slovak brain drain

*Slovensky nižšie / Slovak below*

---

Slovakia has lost more than 300,000 people to emigration since EU accession in 2004 — a figure the official statistics likely undercount. This project maps that departure: where people go, at what age, from which regions, in which fields, and why the flow is so one-directional.

Built as a data-journalism website with interactive maps and original data work across four sections.

**[Live site →](https://slovak-brain-drain.pages.dev)** *(deploying soon)*

---

## What's inside

**§1 — Inside Slovakia**
How talent redistributes internally before anyone crosses a border. An animated choropleth of Slovakia at kraj, okres, and obec resolution showing net migration of educated residents 2004–present, with wage and unemployment overlays.

**§2 — The Czech corridor**
The dominant migration route: 240,000+ Slovaks now live in Czechia, making it the largest single bilateral flow in the EU relative to population. Two co-equal stories — the student pathway (18-year-olds choosing Charles University over Comenius) and the labour pathway — shown as parallel Sankeys with a bridge metric tracking how many students stay after graduating.

**§3 — Global diaspora**
Where Slovaks end up worldwide. An interactive world heatmap switchable between three definitions of "Slovak" (born in Slovakia / Slovak citizen / Slovak-identified by ancestry) — which give very different pictures of the diaspora.

**§4 — Notable departures**
A static timeline of high-impact Slovak-born individuals who built their careers abroad. From Andrej Karpathy (AI, left at 15) to Juraj Slafkovský (NHL, left at 15, publicly critical of Slovak hockey structures). The pattern that emerges is not what most people expect.

---

## Data

All data is sourced from primary records. The `/methodology` page on the live site documents every dataset, every derived metric, every interpolation, and every case where two sources disagree.

Primary sources include: Štatistický úrad SR DataCube API, Sčítanie 2021, ČSÚ Foreigners in the Czech Republic (annual), Czech MŠMT/DZS student data, UN DESA International Migrant Stock 2024, OECD DIOC, Eurostat migration tables, IZ Bratislava LAU1 unemployment panel.

Processed outputs are available for download under CC-BY 4.0 on the methodology page.

---

## Running locally

Requires Python 3.11+ and Node 18+.

```bash
git clone https://github.com/simonlasak/slovak-brain-drain.git
cd slovak-brain-drain

# Python pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python pipeline/run_all.py

# Frontend
cd frontend
npm install
npm run dev
```

The pipeline fetches ~580 MB of raw data on first run. Subsequent runs are incremental — only changed sources are re-fetched.

---

## Tech

**Pipeline:** Python · httpx · Polars · PyArrow · GeoPandas · pdfplumber

**Frontend:** React · Vite · TypeScript · deck.gl · Maplibre GL · visx · Framer Motion · GSAP · Scrollama · DuckDB-Wasm

**Hosting:** Cloudflare Pages (static, no backend)

---

## License

Code: [MIT](LICENSE)

Processed data outputs: [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — cite this project and you can use the data freely. The underlying raw sources have their own open licenses; raw data is not redistributed here.

---

## Author

Šimon Lasák — CS student, UCD Dublin

---

---

## Odchod / Departure

### Interaktívna prípadová štúdia slovenského brain drainु

Od vstupu Slovenska do EÚ v roku 2004 emigrovalo viac ako 300 000 ľudí — a officiálne štatistiky tento počet pravdepodobne podhodnocujú. Tento projekt mapuje ten odchod: kam ľudia odchádzajú, v akom veku, z ktorých regiónov, v ktorých odvetviach a prečo je tok taký jednostranný.

Projekt je postavený ako dátovo-žurnalistická webová stránka so štyrmi sekciami a interaktívnymi mapami.

**§1** — Vnútorná migrácia na Slovensku

**§2** — Český koridor: 240 000+ Slovákov žijúcich v Česku

**§3** — Globálna diaspóra: kde Slováci žijú vo svete

**§4** — Významné odchody: ľudia, ktorí zmenili svet — a väčšina nevie, že sú Slováci

Spracované výstupy sú k dispozícii na stiahnutie pod licenciou CC-BY 4.0.

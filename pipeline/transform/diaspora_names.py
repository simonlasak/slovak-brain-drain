"""
Generate frontend/src/content/countryNames.ts.

The Section 3 data mixes two code systems: UN M49 numeric codes on the UN DESA
rows and ISO3 alpha codes on the OECD rows. Rather than hand-maintaining a
lookup in TypeScript, derive it from the two artefacts that already define the
truth: the converted world boundaries (which carry both codes plus a name) and
the parquet's own distinct destination codes.

Run from the repo root:
    .venv/bin/python -m pipeline.transform.diaspora_names
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import duckdb

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BOUNDARIES = REPO_ROOT / "frontend" / "public" / "data" / "world_countries.geojson"
PARQUET = REPO_ROOT / "frontend" / "public" / "data" / "section3_diaspora.parquet"
OUT_PATH = REPO_ROOT / "frontend" / "src" / "content" / "countryNames.ts"

# world-atlas abbreviates some names for map labelling; spell them out for prose.
TIDY = {
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "United States of America": "United States",
    "Macedonia": "North Macedonia",
    "Dominican Rep.": "Dominican Republic",
    "Central African Rep.": "Central African Republic",
    "Dem. Rep. Congo": "Democratic Republic of the Congo",
    "Eq. Guinea": "Equatorial Guinea",
    "S. Sudan": "South Sudan",
    "Solomon Is.": "Solomon Islands",
    "Falkland Is.": "Falkland Islands",
}

# Present in the diaspora data but absent from the 110m boundaries: too small to
# be drawn at that resolution, so no polygon carries their name.
EXTRA = {
    "438": "Liechtenstein",
    "470": "Malta",
}

HEADER = """import type { Locale } from '../lib/locale';

/**
 * Display names for every destination code that appears in
 * section3_diaspora.parquet.
 *
 * GENERATED, do not hand-edit: run
 *   .venv/bin/python -m pipeline.transform.diaspora_names
 * to regenerate from the boundaries file plus the parquet's distinct codes.
 *
 * The data mixes two code systems: UN M49 numeric (UN DESA rows) and ISO3 alpha
 * (OECD rows), so both appear as keys here. Malta and Liechtenstein are carried
 * explicitly because they have diaspora data but no polygon in the 110m
 * boundaries.
 *
 * Slovak exonyms are pending the single Slovak authoring pass; until then the
 * English names render for both locales.
 */
export const COUNTRY_NAMES: Record<string, string> = {
"""

FOOTER = """};

export function countryName(code: string, _locale: Locale = 'en'): string {
  return COUNTRY_NAMES[code] || code;
}
"""


def run() -> Path:
    gj = json.loads(BOUNDARIES.read_text())
    by_m49 = {
        f["properties"]["m49"]: f["properties"]["name"]
        for f in gj["features"]
        if f["properties"].get("name")
    }
    by_iso = {
        f["properties"]["iso3"]: f["properties"]["name"]
        for f in gj["features"]
        if f["properties"].get("iso3") and f["properties"].get("name")
    }

    con = duckdb.connect()
    codes = [
        r[0]
        for r in con.sql(
            f"SELECT DISTINCT destination_iso3 FROM '{PARQUET}' ORDER BY 1"
        ).fetchall()
    ]

    lines, missing = [], []
    for code in codes:
        name = EXTRA.get(code) or by_m49.get(code) or by_iso.get(code)
        if not name:
            missing.append(code)
            continue
        name = TIDY.get(name, name)
        lines.append(f"  '{code}': '{name}',")

    if missing:
        log.warning("transform.diaspora_names.unnamed %s", missing)

    OUT_PATH.write_text(HEADER + "\n".join(lines) + "\n" + FOOTER)
    log.info(
        "transform.diaspora_names.done names=%d unnamed=%d path=%s",
        len(lines), len(missing), OUT_PATH,
    )
    return OUT_PATH


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    run()

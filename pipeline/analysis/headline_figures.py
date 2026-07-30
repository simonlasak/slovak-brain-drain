"""
Headline figures for server-rendered copy.

WHY THIS EXISTS. Numbers that appear in prose or in server-rendered markup cannot
be resolved from the parquet at request time, because there is no request: the
site is static. Historically that meant they were typed in by hand, and two of
them turned out to be wrong in ways no downstream check could catch: the landing
hero's 300,000 (an illustrative example that escaped from a doc) and the wage
chart's national average line (a Q1 figure labelled as annual).

So the pipeline derives them and writes them here, and the frontend imports this
file at build time. A figure that is not in this file cannot be rendered as a
sourced statistic.

Each entry carries the query that produced it, so a reader of the JSON can check
the number without reading the pipeline.

Run:  PYTHONPATH=. .venv/bin/python -m pipeline.analysis.headline_figures
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import duckdb

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
S1 = REPO_ROOT / "data" / "processed" / "section1_internal.parquet"
S2 = REPO_ROOT / "data" / "processed" / "section2_corridor.parquet"
S3 = REPO_ROOT / "data" / "processed" / "section3_diaspora.parquet"
OUT_PATH = REPO_ROOT / "frontend" / "src" / "data" / "headline_figures.json"


# Each figure names its own source file, the SQL that derives it, and a note on
# what the number means. `unit` tells the frontend how to format: "count" renders
# as an integer with thousands separators, "percent" to one decimal.
FIGURES: dict[str, dict] = {
    "registered_departures_2004_2025": {
        "parquet": "section1",
        "sql": """
            SELECT sum(value) AS value FROM s1
            WHERE metric = 'migr_out' AND geo_level = 'nation'
              AND year BETWEEN 2004 AND 2025
              AND age_bracket = 'all' AND sex = 'all' AND education = 'all'
        """,
        "unit": "count",
        "note": (
            "People Slovak authorities recorded leaving, 2004-2025. SUSR om7011rr "
            "IN010079 at national level, where it matches Eurostat migr_emi1ctz "
            "exactly. A floor, not a count: deregistration is unenforced."
        ),
    },
    "cohort_retention_median": {
        "parquet": "section1",
        "sql": """
            SELECT median(value) AS value FROM s1
            WHERE metric = 'cohort_retention' AND geo_level = 'okres'
        """,
        "unit": "percent",
        "note": (
            "Median district cohort retention: 35-39 year olds in 2024 over 15-19 "
            "year olds in 2004, same district. Derived from SUSR om7007rr."
        ),
    },
    "slovaks_in_cz_residents_2025": {
        "parquet": "section2",
        "sql": """
            SELECT value FROM s2
            WHERE metric = 'stock' AND source = 'csu_CIZ003T003'
              AND cz_geo_code = 'CZ' AND sex = 'all' AND pathway = 'all'
              AND year = 2025
        """,
        "unit": "count",
        "note": (
            "Slovak citizens RESIDENT in Czechia, CSU CIZ003T003, 2025. Distinct "
            "from the labour figure below, which is larger because it counts "
            "employment relationships including cross-border commuters."
        ),
    },
    "slovaks_in_cz_labour_2024": {
        "parquet": "section2",
        "sql": """
            SELECT sum(value) AS value FROM s2
            WHERE metric = 'stock' AND pathway = 'labour' AND year = 2024
              AND sex = 'all' AND employment_status IN ('employed', 'self_employed')
        """,
        "unit": "count",
        "note": (
            "Slovaks in the Czech LABOUR MARKET, CSU CIZ03, 2024: employees plus "
            "trade-licence holders. Not a count of residents."
        ),
    },
    "diaspora_destinations_2020": {
        "parquet": "section3",
        "sql": """
            SELECT count(DISTINCT destination_iso3) AS value FROM s3
            WHERE metric = 'stock' AND slovak_def = 'born' AND year = 2020
              AND value > 0
        """,
        "unit": "count",
        "note": (
            "Destinations with a non-zero Slovak-born stock in the 2020 UN DESA "
            "revision. The site previously said 87, which was the count of keys "
            "before an M49/ISO3 mapping bug was fixed."
        ),
    },
}


def _mirror_figures() -> dict[str, dict]:
    """Pull the accession-window figures out of the mirror comparison output.

    Read from mirror_comparison.json rather than recomputed, so the hero and the
    methodology page cannot drift from each other: there is one derivation.
    """
    path = REPO_ROOT / "data" / "processed" / "mirror_comparison.json"
    if not path.exists():
        raise FileNotFoundError(
            "headline_figures: mirror_comparison.json missing. Run "
            "pipeline.analysis.mirror_comparison first."
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    specs = {s["name"]: s for s in data["specifications"]}
    spec = specs.get("accession_window_2004_2025")
    if spec is None:
        raise ValueError(
            "headline_figures: mirror_comparison.json has no "
            "'accession_window_2004_2025' specification."
        )
    lo, hi = spec["flow_window"]
    panel_n = len(spec["panel"])
    return {
        "mirror_implied_departures_2004_2024": {
            "value": int(round(spec["implied_departures"])),
            "unit": "count",
            "note": (
                f"Departures implied by the registers of the {panel_n} destination "
                f"countries that counted Slovak citizens at both 1 Jan 2004 and "
                f"1 Jan 2025: rise in reported stock plus naturalisations over "
                f"{lo}-{hi}. A floor; the panel omits the UK, IE, ES, CH and FR. "
                "See 06-sources-page.md section 4a."
            ),
            "sql": "derived: pipeline/analysis/mirror_comparison.py",
        },
        "mirror_panel_countries": {
            "value": panel_n,
            "unit": "count",
            "note": "Destination countries in the 2004-2025 mirror panel.",
            "sql": "derived: pipeline/analysis/mirror_comparison.py",
        },
        "mirror_registered_departures_2004_2024": {
            "value": int(round(spec["susr_registered_departures"])),
            "unit": "count",
            "note": (
                f"SUSR registered departures over {lo}-{hi}, the window the mirror "
                "comparison can speak to. The hero's 2004-2025 total is larger by "
                "the 2025 figure alone; the two reconcile exactly."
            ),
            "sql": "derived: pipeline/analysis/mirror_comparison.py",
        },
    }


def _source_counts(con: duckdb.DuckDBPyConnection) -> dict[str, dict]:
    """Count the sources the site actually USES, per parquet `source` column.

    The methodology page previously stated counts of files sitting in data/raw/,
    which overstates: 13 SUSR cubes were fetched but only 4 feed any rendered
    metric. Counting what the parquets attribute is both smaller and honest,
    and it cannot drift from the data because it is read out of it.
    """
    def distinct_sources(view: str, prefix: str) -> int:
        rows = con.execute(
            f"SELECT DISTINCT source FROM {view} WHERE source LIKE '{prefix}%'"
        ).fetchall()
        # 'derived_om7007rr' and 'susr_om7007rr' are the same underlying cube.
        cubes = {
            r[0].removeprefix("susr_").removeprefix("derived_").removeprefix("csu_")
            .removeprefix("oecd_").removeprefix("eurostat_").removeprefix("un_desa_")
            for r in rows
        }
        return len(cubes)

    return {
        "susr_cubes_used": {
            "value": distinct_sources("s1", "susr_"),
            "unit": "count",
            "note": (
                "SUSR DataCube cubes feeding a rendered metric. 13 cubes are "
                "fetched; this counts the ones the parquets attribute."
            ),
            "sql": "SELECT count(DISTINCT source) FROM s1 WHERE source LIKE 'susr_%'",
        },
        "csu_tables_used": {
            "value": distinct_sources("s2", "csu_"),
            "unit": "count",
            "note": "CSU tables feeding Section 2.",
            "sql": "SELECT count(DISTINCT source) FROM s2 WHERE source LIKE 'csu_%'",
        },
        "oecd_datasets_used": {
            "value": distinct_sources("s3", "oecd_"),
            "unit": "count",
            "note": "OECD extracts feeding Section 3.",
            "sql": "SELECT count(DISTINCT source) FROM s3 WHERE source LIKE 'oecd_%'",
        },
    }


def run() -> dict:
    log.info("headline.start")
    con = duckdb.connect()
    for alias, path in (("s1", S1), ("s2", S2), ("s3", S3)):
        if not path.exists():
            raise FileNotFoundError(
                f"headline_figures: {path} missing. Run the transforms first."
            )
        con.execute(f"CREATE VIEW {alias} AS SELECT * FROM read_parquet('{path}')")

    out: dict[str, dict] = {}
    for name, spec in FIGURES.items():
        rows = con.execute(spec["sql"]).fetchall()
        if len(rows) != 1 or rows[0][0] is None:
            raise ValueError(
                f"headline_figures: {name!r} returned {len(rows)} rows "
                f"(expected exactly 1 non-null). The query no longer identifies a "
                "single figure, so rendering it would be ambiguous."
            )
        raw = float(rows[0][0])
        value = round(raw, 1) if spec["unit"] == "percent" else int(round(raw))
        out[name] = {
            "value": value,
            "unit": spec["unit"],
            "note": spec["note"],
            "sql": " ".join(spec["sql"].split()),
        }
        log.info("headline.%s = %s", name, value)

    for name, entry in _mirror_figures().items():
        out[name] = entry
        log.info("headline.%s = %s", name, entry["value"])

    for name, entry in _source_counts(con).items():
        out[name] = entry
        log.info("headline.%s = %s", name, entry["value"])

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(
            {
                "_comment": (
                    "GENERATED by pipeline/analysis/headline_figures.py. Do not "
                    "edit by hand. Every value carries the SQL that derived it. A "
                    "number rendered in prose must come from here."
                ),
                **out,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    log.info("headline.done path=%s", OUT_PATH)
    return out


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    res = run()
    print()
    print("HEADLINE FIGURES")
    print("=" * 72)
    for name, f in res.items():
        shown = f"{f['value']:,}" if f["unit"] == "count" else f"{f['value']}%"
        print(f"  {name:<36} {shown:>12}")
    print()
    print(f"  written to {OUT_PATH.relative_to(REPO_ROOT)}")

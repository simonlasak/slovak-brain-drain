"""Precompute every chart series the frontend renders, as JSON.

    .venv/bin/python -m pipeline.analysis.chart_data

WHY THIS EXISTS. The site used to ship DuckDB-WASM to the browser and query the
Parquet files client side. That cost every visitor a 34 MiB WASM download, about
8 MiB over the wire, to read 400 KB of Parquet, and it put a hard runtime
dependency on a CDN: if jsDelivr was unreachable, every chart rendered an empty
frame. Every query on the site is known at build time, so none of that was
buying anything.

THE SQL LIVES HERE AND NOWHERE ELSE. That is the load-bearing property. Each
entry below was transcribed verbatim from the component that used to run it, and
that component now fetches this module's output by key instead. Because the
frontend no longer has a SQL engine, a component cannot quietly diverge from the
query that produced its data: there is no second copy to drift.

Each output file carries the SQL that produced it and the component that consumes
it, the same convention headline_figures.py uses, so a rendered series can be
traced back to a query without reading the frontend.

Note on `geo_level`: section1_internal.parquet holds BOTH 'nation' and 'national'
as distinct values. Migration and population series use 'nation'; avg_wage_eur
uses 'national'. This is a wart, not a bug, and the queries below preserve
whichever the data actually carries. Filtering wages on 'nation' returns zero
rows silently, which is exactly the kind of trap this project keeps finding.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import duckdb

log = logging.getLogger(__name__)

REPO = Path(__file__).resolve().parents[2]
PROCESSED = REPO / "data" / "processed"
# Written into the frontend's public directory: these are served as static assets
# and fetched by the islands at runtime.
OUT_DIR = REPO / "frontend" / "public" / "data" / "charts"

# The Parquet files, registered under the same names the old client-side queries
# used so the SQL below is a verbatim transcription rather than a rewrite.
SOURCES = {
    "s1.parquet": PROCESSED / "section1_internal.parquet",
    "s2.parquet": PROCESSED / "section2_corridor.parquet",
    "s3.parquet": PROCESSED / "section3_diaspora.parquet",
}


@dataclass(frozen=True)
class Series:
    key: str
    consumer: str
    note: str
    sql: str


# Constants that were JS template interpolations in the components. Inlined here
# with the component's own constant name recorded, so the substitution is
# auditable rather than silent.
SNAPSHOT_YEAR = 2020                              # Section3App.SNAPSHOT_YEAR
DESA_SOURCE = "un_desa_bilateral_2020"            # Section3App.DESA_SOURCE
CITIZEN_SOURCE = "eurostat_migr_pop1ctz"          # Section3App.CITIZEN_SOURCE
FLOW_SOURCE = "oecd_mig_flows_B11"                # Section3App.FLOW_SOURCE
FLOW_Y0, FLOW_Y1 = 2008, 2023                     # Section3App.FLOW_Y0 / FLOW_Y1
FLOW_CODES = ("DEU", "CZE", "AUT")                # Section3App.FLOW_CODES
WAGE_YEAR = 2024                                  # WageBarChart.WAGE_YEAR

SERIES: list[Series] = [
    # ---- landing page -----------------------------------------------------
    Series(
        key="hero_registered_departures",
        consumer="src/components/HeroCounter.tsx",
        note=(
            "The landing hero. Registered departures at national level over "
            "2004-2024, the window the mirror comparison can also speak to. The "
            "component takes a data key rather than a number, so an unsourced "
            "hero stays unrepresentable: there is no prop that accepts a value."
        ),
        sql=f"""
            SELECT sum(value) AS total
            FROM 's1.parquet'
            WHERE metric = 'migr_out'
              AND geo_level = 'nation'
              AND year BETWEEN 2004 AND 2024
              AND age_bracket = 'all'
              AND sex = 'all'
              AND education = 'all'
        """,
    ),
    # ---- section 1, /internal --------------------------------------------
    # MapVariantA ran this once per scroll step, substituting the metric. Three
    # steps carry a metric; the first is the bare map. One key each, so one key
    # remains one SQL statement.
    *[
        Series(
            key=f"s1_map_okres_{metric}_2024",
            consumer="src/components/MapVariantA.tsx",
            note=f"Okres-level {metric} for 2024, colouring the scroll map at one step.",
            sql=f"""
                SELECT geo_code, value
                FROM 's1.parquet'
                WHERE metric = '{metric}'
                  AND year = 2024
                  AND geo_level = 'okres'
                  AND age_bracket = 'all'
                  AND education = 'all'
            """,
        )
        for metric in ("population", "cohort_retention", "total_change")
    ],
    Series(
        key="s1_cohort_retention_okres",
        consumer="src/components/charts/CohortRetentionChart.tsx",
        note=(
            "Cohort retention per okres: people aged 35-39 in 2024 over people "
            "aged 15-19 in 2004 in the same district. The chart takes its median "
            "from these rows rather than a literal, so the reference line cannot "
            "drift from the dots."
        ),
        sql="""
            SELECT geo_name, geo_code, value AS retention_pct
            FROM 's1.parquet'
            WHERE metric = 'cohort_retention'
              AND year = 2024
              AND geo_level = 'okres'
              AND sex = 'all'
            ORDER BY value DESC
        """,
    ),
    Series(
        key="s1_wages_kraj",
        consumer="src/components/charts/WageBarChart.tsx",
        note="Average gross monthly wage by kraj, the bars.",
        sql=f"""
            SELECT geo_name, value AS wage_eur
            FROM 's1.parquet'
            WHERE metric = 'avg_wage_eur'
              AND geo_level = 'kraj'
              AND year = {WAGE_YEAR}
            ORDER BY value DESC
        """,
    ),
    Series(
        key="s1_wage_national",
        consumer="src/components/charts/WageBarChart.tsx",
        note=(
            "The national average wage, drawn as the reference line. Note "
            "geo_level = 'national' and not 'nation': this metric uses the other "
            "spelling, and 'nation' returns zero rows."
        ),
        sql=f"""
            SELECT value AS wage_eur
            FROM 's1.parquet'
            WHERE metric = 'avg_wage_eur'
              AND geo_level = 'national'
              AND year = {WAGE_YEAR}
        """,
    ),
    Series(
        key="s1_population_change_okres",
        consumer="src/components/charts/RankedChangeChart.tsx",
        note=(
            "Percentage population change per okres, 2004 to 2025. geo_level = "
            "'okres' already excludes the SK_CAP aggregate, which carries "
            "geo_level = 'okres_aggregate'."
        ),
        sql="""
            WITH pop AS (
              SELECT geo_name, geo_code, year, value
              FROM 's1.parquet'
              WHERE metric = 'population'
                AND geo_level = 'okres'
                AND year IN (2004, 2025)
                AND sex = 'all'
                AND age_bracket = 'all'
                AND education = 'all'
            )
            SELECT a.geo_name AS geo_name,
              a.geo_code AS geo_code,
              ROUND(100.0 * (b.value - a.value) / a.value, 1) AS pct_change
            FROM pop a
            JOIN pop b ON a.geo_code = b.geo_code
            WHERE a.year = 2004 AND b.year = 2025
            ORDER BY pct_change DESC
        """,
    ),
    Series(
        key="s1_region_trends",
        consumer="src/components/charts/RegionTrendChart.tsx",
        note="Population by NUTS2 oblast per year, indexed to 2004 in the chart.",
        sql="""
            SELECT year, geo_code, value
            FROM 's1.parquet'
            WHERE metric = 'population'
              AND geo_level = 'oblast'
              AND geo_code IN ('SK01','SK02','SK03','SK04')
              AND age_bracket = 'all'
              AND education = 'all'
              AND sex = 'all'
            ORDER BY year
        """,
    ),
    # ---- section 2, /corridor --------------------------------------------
    Series(
        key="s2_regions",
        consumer="src/components/Section2App.tsx",
        note="Slovaks registered per Czech kraj per year, colouring the scroll map.",
        sql="""
            SELECT cz_geo_code, value, year
            FROM 's2.parquet'
            WHERE pathway = 'all'
              AND cz_geo_code != 'CZ'
              AND sex = 'all'
              AND source = 'csu_CIZ003T003'
              AND metric = 'stock'
            ORDER BY year, cz_geo_code
        """,
    ),
    Series(
        key="s2_stock_series",
        consumer="src/components/Section2App.tsx",
        note=(
            "The three co-plotted definitions: residence-registered stock, "
            "labour-market participation, and students enrolled. Deliberately "
            "three series rather than one number, because they count different "
            "things and neither is wrong."
        ),
        sql="""
            SELECT year, pathway, value
            FROM 's2.parquet'
            WHERE sex = 'all'
              AND cz_geo_code = 'CZ'
              AND year BETWEEN 2015 AND 2024
              AND (
                (pathway = 'all' AND source = 'csu_CIZ003T003' AND metric = 'stock')
                OR (pathway = 'labour' AND employment_status = 'total' AND metric = 'stock')
                OR (pathway = 'student' AND field_or_sector = 'ED5-8' AND metric = 'students_enrolled')
              )
            ORDER BY year, pathway
        """,
    ),
    Series(
        key="s2_labour_2024",
        consumer="src/components/Section2App.tsx",
        note=(
            "Employees plus trade-licence holders for 2024. Summed over "
            "employment_status because the 'total' row is not available on this "
            "cut, and the two components do not overlap."
        ),
        sql="""
            SELECT 2024 as year, 'labour' as pathway, SUM(value) as value
            FROM 's2.parquet'
            WHERE pathway = 'labour'
              AND year = 2024
              AND sex = 'all'
              AND age_bracket = 'all'
              AND education = 'all'
              AND employment_status IN ('employed', 'self_employed')
        """,
    ),
    Series(
        key="s2_students_by_level",
        consumer="src/components/Section2App.tsx",
        note="Slovak students in Czechia by ISCED level. No nationality-crossed field-of-study dimension exists in any held source.",
        sql="""
            SELECT year, field_or_sector as level, value
            FROM 's2.parquet'
            WHERE pathway = 'student'
              AND sex = 'all'
              AND field_or_sector IN ('ED6', 'ED7', 'ED8')
              AND year BETWEEN 2013 AND 2024
            ORDER BY year, level
        """,
    ),
    # ---- section 3, /diaspora --------------------------------------------
    Series(
        key="s3_born_stock",
        consumer="src/components/Section3App.tsx",
        note=(
            "Slovak-born stock by destination and year, UN DESA 2020 revision. "
            "data_type travels with every row so a citizenship-based figure is "
            "never read as a birthplace one: Czechia is the single type-C row "
            "among the destinations and it is the largest number on the map."
        ),
        sql=f"""
            SELECT destination_iso3 AS code, year, value,
                   COALESCE(data_type, '') AS data_type
            FROM 's3.parquet'
            WHERE metric = 'stock'
              AND source = '{DESA_SOURCE}'
              AND sex = 'all'
              AND slovak_def = 'born'
              AND age_bracket = 'all'
              AND education = 'all'
            ORDER BY destination_iso3, year
        """,
    ),
    Series(
        key="s3_citizen_stock",
        consumer="src/components/Section3App.tsx",
        note=f"Slovak-citizen stock by destination for {SNAPSHOT_YEAR}, the other side of the definitional contrast.",
        sql=f"""
            SELECT destination_iso3 AS code, value
            FROM 's3.parquet'
            WHERE metric = 'stock'
              AND source = '{CITIZEN_SOURCE}'
              AND slovak_def = 'citizen'
              AND sex = 'all'
              AND age_bracket = 'all'
              AND education = 'all'
              AND year = {SNAPSHOT_YEAR}
        """,
    ),
    Series(
        key="s3_arrival_flows",
        consumer="src/components/Section3App.tsx",
        note=(
            "Annual arrivals into Germany, Czechia and Austria. B11 only: B11-B16 "
            "are stacked in one OECD CSV distinguished by a MEASURE column, and "
            "B15 is a population stock, which once made the inflow series sum to "
            "7.4M. Held separately from the stock rows and never joined to them, "
            "because adding or netting the two would mix definitions."
        ),
        sql=f"""
            SELECT destination_iso3 AS code, year, value
            FROM 's3.parquet'
            WHERE metric = 'inflow'
              AND source = '{FLOW_SOURCE}'
              AND sex = 'all'
              AND age_bracket = 'all'
              AND education = 'all'
              AND year BETWEEN {FLOW_Y0} AND {FLOW_Y1}
              AND destination_iso3 IN ({', '.join(f"'{c}'" for c in FLOW_CODES)})
            ORDER BY destination_iso3, year
        """,
    ),
]


def _tidy(sql: str) -> str:
    """Collapse the indentation the triple-quoted literals carry."""
    return "\n".join(line.rstrip() for line in sql.strip().split("\n"))


def run() -> list[tuple[str, int, int]]:
    for name, path in SOURCES.items():
        if not path.exists():
            raise FileNotFoundError(
                f"{path} is missing. Run the transforms first: "
                f"python -m pipeline.transform.section1 (and section2, section3)."
            )

    con = duckdb.connect()
    for name, path in SOURCES.items():
        # Registered as a view under the Parquet filename the components used, so
        # the SQL above needed no rewriting when it moved here.
        con.execute(f"CREATE VIEW '{name}' AS SELECT * FROM read_parquet('{path}')")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    keys = {s.key for s in SERIES}
    if len(keys) != len(SERIES):
        raise ValueError("duplicate series key")

    results = []
    for s in SERIES:
        sql = _tidy(s.sql)
        cur = con.execute(sql)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        if not rows:
            # A silently empty series is how a wrong filter reaches production.
            raise ValueError(f"{s.key} returned zero rows. Query or data changed:\n{sql}")

        payload = {
            "_comment": "GENERATED by pipeline/analysis/chart_data.py. Do not edit by hand.",
            "key": s.key,
            "consumer": s.consumer,
            "note": s.note,
            "sql": sql,
            "row_count": len(rows),
            "rows": rows,
        }
        out = OUT_DIR / f"{s.key}.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        results.append((s.key, len(rows), out.stat().st_size))
        log.info("%s: %d rows, %d bytes", s.key, len(rows), out.stat().st_size)

    # A manifest, so the frontend and any reader can enumerate what exists.
    manifest = {
        "_comment": "GENERATED by pipeline/analysis/chart_data.py.",
        "series": [
            {"key": s.key, "consumer": s.consumer, "note": s.note, "row_count": n, "bytes": b}
            for s, (_, n, b) in zip(SERIES, results)
        ],
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    results = run()
    total = sum(b for _, _, b in results)
    print()
    for key, n, b in results:
        print(f"  {key:34s} {n:6d} rows  {b:8,d} bytes")
    print(f"\n  {len(results)} series, {total:,} bytes total ({total / 1024:.1f} KB)")
    print(f"  written to {OUT_DIR.relative_to(REPO)}")

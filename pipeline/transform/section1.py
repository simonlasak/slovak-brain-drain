"""
Stage 2 Transform — Section 1: Internal demographics.

Reads from:
- data/raw/susr_datacube/om7011rr/ (population movement at okres level)
- data/raw/susr_datacube/om7102rr/ (population by sex at okres level)
- data/raw/susr_datacube/om7104rr/ (population change at okres level)
- data/raw/susr_datacube/om7007rr/ (age groups at okres level)
- data/raw/susr_datacube/pr0204qs/ (average wage - economy, national)
- data/raw/susr_datacube/np3112qr/ (average wage - economy, by kraj)

Writes to:
- data/processed/section1_internal.parquet
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_SUSR = REPO_ROOT / "data" / "raw" / "susr_datacube"
OUT_PATH = REPO_ROOT / "data" / "processed" / "section1_internal.parquet"

INDICATOR_MAP_OM7011 = {
    "IN010051": ("population", "Permanently living population on 1 January"),
    "IN010054": ("births", "Birth"),
    "IN010061": ("deaths", "Mortality"),
    "IN010076": ("internal_net", "Natural increase"),
    "IN010078": ("intl_in", "Immigrants (in-migrants) on permanent residence"),
    "IN010079": ("intl_out", "Emigrants (out-migrants) from permanent residence"),
    "IN010080": ("intl_net", "Net migration"),
    "IN010082": ("total_change", "Total increase of population"),
}

# om7007rr (age structure) carries two population indicators on the same
# dimensions. They are different quantities and must not share a metric name.
# `population_midyear` is kept as the primary age-structure series because it is
# the one the cohort-retention derivation uses.
INDICATOR_MAP_OM7007 = {
    "IN010052": "population_midyear",
    "IN010053": "population_yearend",
}

GEO_LEVEL_MAP = {
    2: "kraj",   # SK01, SK02, ...
    3: "okres",  # SK010, SK021, ...
}


def _classify_geo(code: str) -> str | None:
    if not code.startswith("SK"):
        return None
    if len(code) == 3:
        return "kraj"  # SK0 = national
    elif len(code) == 4:
        return "kraj"  # SK01..SK04 = NUTS-2 regions
    elif len(code) == 5:
        return "kraj"  # SK010..SK042 = NUTS-3 kraje
    elif len(code) == 6 or code == "SK_CAP":
        return "okres"  # SK0101..SK0813 = LAU-1 okresy
    return None


def _parse_jsonstat_cube(fpath: Path) -> list[dict]:
    data = json.loads(fpath.read_text(encoding="utf-8"))
    dims = data.get("dimension", {})
    values = data.get("value", [])
    if not values:
        return []

    dim_names = list(dims.keys())
    dim_sizes = []
    dim_labels = []

    for dname in dim_names:
        cats = dims[dname].get("category", {})
        indices = cats.get("index", {})
        labels = cats.get("label", {})
        if isinstance(indices, dict):
            ordered = sorted(indices.items(), key=lambda x: x[1])
            codes = [k for k, _ in ordered]
        else:
            codes = list(labels.keys())
        dim_sizes.append(len(codes))
        dim_labels.append({"codes": codes, "labels": labels})

    rows = []
    for flat_idx, val in enumerate(values):
        if val is None:
            continue
        coords = {}
        remainder = flat_idx
        for i in range(len(dim_sizes) - 1, -1, -1):
            coords[dim_names[i]] = dim_labels[i]["codes"][remainder % dim_sizes[i]]
            remainder //= dim_sizes[i]
        coords["_value"] = val
        coords["_labels"] = {
            dn: dim_labels[i]["labels"].get(coords[dn], coords[dn])
            for i, dn in enumerate(dim_names)
        }
        rows.append(coords)
    return rows


def transform_population_movement() -> pl.DataFrame:
    """Parse om7011rr — population, births, deaths, migration at okres/kraj level."""
    cube_dir = RAW_SUSR / "om7011rr"
    all_rows = []
    # Log-and-drop, not silent pass-through: an unrecognised code must announce
    # itself. The same guard in section3 caught GBR missing from the M49 map,
    # which would otherwise have dropped the second-largest destination.
    skipped_indicators: dict[str, int] = {}
    skipped_geo: set[str] = set()

    for fpath in sorted(cube_dir.glob("om7011rr_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        for row in parsed:
            geo_code = row.get("om7011rr_vuc", "")
            geo_level = _classify_geo(geo_code)
            if geo_level is None:
                skipped_geo.add(geo_code)
                continue

            indicator_code = row.get("om7011rr_ukaz", "")
            if indicator_code not in INDICATOR_MAP_OM7011:
                skipped_indicators[indicator_code] = (
                    skipped_indicators.get(indicator_code, 0) + 1
                )
                continue

            metric, _ = INDICATOR_MAP_OM7011[indicator_code]
            geo_name = row["_labels"].get("om7011rr_vuc", geo_code)

            all_rows.append({
                "year": year,
                "geo_level": geo_level,
                "geo_code": geo_code,
                "geo_name": geo_name,
                "age_bracket": "all",
                "sex": "all",
                "education": "all",
                "metric": metric,
                "value": float(row["_value"]),
                "is_interpolated": None,
                "source": "susr_om7011rr",
            })

    if skipped_indicators:
        log.info(
            "transform.section1.om7011rr_unmapped_indicators %s "
            "(intentional: 28 of 34 cube indicators are not used)",
            dict(sorted(skipped_indicators.items())),
        )
    if skipped_geo:
        log.info(
            "transform.section1.om7011rr_unclassified_geo %s",
            sorted(skipped_geo)[:12],
        )

    return pl.DataFrame(all_rows)


def transform_wages() -> pl.DataFrame:
    """Parse pr0204qs — average monthly wage for the whole economy (national)."""
    cube_dir = RAW_SUSR / "pr0204qs"
    all_rows = []

    for fpath in sorted(cube_dir.glob("pr0204qs_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        for row in parsed:
            val = row.get("_value")
            if val is None or val == 0:
                continue
            all_rows.append({
                "year": year,
                "geo_level": "national",
                "geo_code": "SK0",
                "geo_name": "Slovenská republika",
                "age_bracket": "all",
                "sex": "all",
                "education": "all",
                "metric": "avg_wage_eur",
                "value": float(val),
                "is_interpolated": None,
                "source": "susr_pr0204qs",
            })
            break  # one value per year (national average)

    return pl.DataFrame(all_rows)


KRAJ_CODES = {
    "SK010": "Region of Bratislava",
    "SK021": "Region of Trnava",
    "SK022": "Region of Trenčín",
    "SK023": "Region of Nitra",
    "SK031": "Region of Žilina",
    "SK032": "Region of Banská Bystrica",
    "SK041": "Region of Prešov",
    "SK042": "Region of Košice",
}


def transform_wages_regional() -> pl.DataFrame:
    """Parse np3112qr — average monthly wage by kraj (NUTS3)."""
    cube_dir = RAW_SUSR / "np3112qr"
    if not cube_dir.exists():
        log.warning("transform.section1.wages_regional: np3112qr not fetched, skipping")
        return pl.DataFrame()

    all_rows = []
    for fpath in sorted(cube_dir.glob("np3112qr_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        for row in parsed:
            geo_code = row.get("nuts13", "")
            if geo_code not in KRAJ_CODES:
                continue
            val = row.get("_value")
            if val is None:
                continue
            geo_name = row["_labels"].get("nuts13", KRAJ_CODES[geo_code])
            all_rows.append({
                "year": year,
                "geo_level": "kraj",
                "geo_code": geo_code,
                "geo_name": geo_name,
                "age_bracket": "all",
                "sex": "all",
                "education": "all",
                "metric": "avg_wage_eur",
                "value": float(val),
                "is_interpolated": None,
                "source": "susr_np3112qr",
            })

    return pl.DataFrame(all_rows)


def transform_age_structure() -> pl.DataFrame:
    """Parse om7007rr — age groups at okres level."""
    cube_dir = RAW_SUSR / "om7007rr"
    all_rows = []

    AGE_CODE_MAP = {
        "Y_LE4": "0-14",
        "Y5-9": "0-14",
        "Y10-14": "0-14",
        "Y15-19": "15-19",
        "Y20-24": "20-24",
        "Y25-29": "25-29",
        "Y30-34": "30-34",
        "Y35-39": "35-39",
        "Y40-44": "40-44",
        "Y45-49": "45-49",
        "Y50-54": "50-54",
        "Y55-59": "55-59",
        "Y60-64": "60-64",
        "Y65-69": "65+",
        "Y70-74": "65+",
        "Y75-79": "65+",
        "Y80-84": "65+",
        "Y85-89": "65+",
        "Y90-94": "65+",
        "Y_GE95": "65+",
        "Y_GE100": "65+",
    }

    for fpath in sorted(cube_dir.glob("om7007rr_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        for row in parsed:
            geo_code = row.get("om7007rr_vuc", "")
            geo_level = _classify_geo(geo_code)
            if geo_level is None:
                continue

            age_code = row.get("om7007rr_vsk", "")
            age_bracket = AGE_CODE_MAP.get(age_code)
            if age_bracket is None:
                continue

            # The cube stacks two different population indicators: IN010052 is
            # the mid-year count and IN010053 the 31-December count. Both were
            # previously written as metric='population' with nothing to tell them
            # apart, which produced up to 14 contradictory rows per
            # district-year-age tuple. Keep them as distinct metrics.
            indicator_code = row.get("om7007rr_ukaz", "")
            metric = INDICATOR_MAP_OM7007.get(indicator_code)
            if metric is None:
                continue

            geo_name = row["_labels"].get("om7007rr_vuc", geo_code)
            val = row.get("_value")
            if val is None or val == 0:
                continue

            all_rows.append({
                "year": year,
                "geo_level": geo_level,
                "geo_code": geo_code,
                "geo_name": geo_name,
                "age_bracket": age_bracket,
                "sex": "all",
                "education": "all",
                "metric": metric,
                "value": float(val),
                "is_interpolated": None,
                "source": "susr_om7007rr",
            })

    if not all_rows:
        return pl.DataFrame()

    # Several fine age codes map onto one display bracket (Y_LE4, Y5-9 and
    # Y10-14 all become "0-14", and seven codes from Y65-69 up become "65+").
    # Appending them individually left one row per source code, so a single
    # district-year-bracket tuple carried up to 14 contradictory values. Sum
    # them into the bracket they belong to.
    return (
        pl.DataFrame(all_rows)
        .group_by([
            "year", "geo_level", "geo_code", "geo_name",
            "age_bracket", "sex", "education", "metric",
            "is_interpolated", "source",
        ])
        .agg(pl.col("value").sum())
        .select([
            "year", "geo_level", "geo_code", "geo_name", "age_bracket", "sex",
            "education", "metric", "value", "is_interpolated", "source",
        ])
    )


def derive_cohort_metrics(df_age: pl.DataFrame) -> pl.DataFrame:
    """Derive cohort_retention and young_change_pct from the age-structure frame.

    RECOVERED DERIVATION. These metrics shipped in the committed parquet with
    source='derived_om7007rr' but no code in the pipeline produced them: the
    derivation was run outside version control and lost. They were recovered by
    reverse-engineering the deployed values against the raw cube.

    `cohort_retention` = 100 * (people aged 35-39 in 2024) / (people aged 15-19
    in 2004), same district. A synthetic cohort: it combines migration and
    mortality and does not track the same individuals.

    The cube publishes two population indicators per year, IN010052 (mid-year)
    and IN010053 (31 December). The original averaged the two for BOTH the
    numerator and the denominator. Using either indicator alone reproduces the
    deployed values to within 2.6 percentage points on four high-churn urban
    districts; averaging reproduces all 80 to within 0.05pp, which is the
    rounding to one decimal. That is what identifies the definition.

    `young_change_pct` = percent change in the 15-34 population between 2004 and
    2024, recovered the same way (0 of 80 districts differ by more than 1pp).

    `young_share` is NOT derived here. No combination of age brackets and
    denominators reproduces it; the deployed series falls monotonically from 65
    to 42 across 2004-2025, which no age share does, so its definition remains
    unknown. Nothing in the frontend reads it, so it is dropped rather than
    guessed at.
    """
    base = df_age.filter(pl.col("geo_level") == "okres")

    def averaged(year: int, bracket: str, alias: str) -> pl.DataFrame:
        return (
            base.filter(
                (pl.col("year") == year)
                & (pl.col("age_bracket") == bracket)
                & (pl.col("metric").is_in(["population_midyear", "population_yearend"]))
            )
            .group_by(["geo_code", "geo_name"])
            .agg(pl.col("value").mean().alias(alias))
        )

    def averaged_range(year: int, brackets: list[str], alias: str) -> pl.DataFrame:
        # Sum the brackets within each indicator, then average the indicators.
        per_indicator = (
            base.filter(
                (pl.col("year") == year)
                & (pl.col("age_bracket").is_in(brackets))
                & (pl.col("metric").is_in(["population_midyear", "population_yearend"]))
            )
            .group_by(["geo_code", "metric"])
            .agg(pl.col("value").sum().alias("v"))
        )
        return per_indicator.group_by("geo_code").agg(pl.col("v").mean().alias(alias))

    rows: list[pl.DataFrame] = []

    cohort = (
        averaged(2004, "15-19", "base")
        .join(averaged(2024, "35-39", "later").drop("geo_name"), on="geo_code")
        .filter(pl.col("base") > 0)
        .with_columns((100 * pl.col("later") / pl.col("base")).round(1).alias("value"))
    )
    rows.append(cohort.select([
        pl.lit(2024).cast(pl.Int64).alias("year"),
        pl.lit("okres").alias("geo_level"),
        "geo_code", "geo_name",
        pl.lit("all").alias("age_bracket"),
        pl.lit("all").alias("sex"),
        pl.lit("all").alias("education"),
        pl.lit("cohort_retention").alias("metric"),
        "value",
        pl.lit(None).cast(pl.Boolean).alias("is_interpolated"),
        pl.lit("derived_om7007rr").alias("source"),
    ]))

    young = ["15-19", "20-24", "25-29", "30-34"]
    yc = (
        averaged_range(2004, young, "base")
        .join(averaged_range(2024, young, "later"), on="geo_code")
        .join(base.select(["geo_code", "geo_name"]).unique(), on="geo_code")
        .filter(pl.col("base") > 0)
        .with_columns(
            (100 * (pl.col("later") - pl.col("base")) / pl.col("base")).round(1).alias("value")
        )
    )
    rows.append(yc.select([
        pl.lit(2024).cast(pl.Int64).alias("year"),
        pl.lit("okres").alias("geo_level"),
        "geo_code", "geo_name",
        pl.lit("all").alias("age_bracket"),
        pl.lit("all").alias("sex"),
        pl.lit("all").alias("education"),
        pl.lit("young_change_pct").alias("metric"),
        "value",
        pl.lit(None).cast(pl.Boolean).alias("is_interpolated"),
        pl.lit("derived_om7007rr").alias("source"),
    ]))

    return pl.concat(rows, how="vertical_relaxed")


def run() -> pl.DataFrame:
    log.info("transform.section1.start")

    df_pop = transform_population_movement()
    log.info("transform.section1.population rows=%d", len(df_pop))

    df_wages = transform_wages()
    log.info("transform.section1.wages rows=%d", len(df_wages))

    df_wages_regional = transform_wages_regional()
    log.info("transform.section1.wages_regional rows=%d", len(df_wages_regional))

    df_age = transform_age_structure()
    log.info("transform.section1.age_structure rows=%d", len(df_age))

    df_cohort = derive_cohort_metrics(df_age)
    log.info("transform.section1.cohort rows=%d", len(df_cohort))

    frames = [f for f in [df_pop, df_wages, df_wages_regional, df_age, df_cohort] if len(f) > 0]
    df = pl.concat(frames, how="vertical_relaxed")

    # Hard guard. cohort_retention is Section 1's headline metric: the 89 percent
    # median, the Senec and Snina outliers, and both beeswarm charts read it.
    # It was previously derived outside the pipeline, so a transform run emitted a
    # parquet silently missing it. Refuse to write rather than ship a file that
    # would blank the section.
    REQUIRED_METRICS = {
        "cohort_retention": 79,   # one row per okres, excluding the SK_CAP aggregate
        "population": 1,
        "avg_wage_eur": 1,
        "total_change": 1,
        "intl_out": 1,
    }
    counts = dict(df.group_by("metric").len().iter_rows())
    missing = {
        m: (minimum, counts.get(m, 0))
        for m, minimum in REQUIRED_METRICS.items()
        if counts.get(m, 0) < minimum
    }
    if missing:
        raise ValueError(
            "section1 transform refusing to write: required metrics missing or "
            "short. metric -> (minimum expected, actual): "
            f"{missing}. Fix the derivation before writing; a parquet without "
            "these silently blanks rendered Section 1 content."
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUT_PATH)
    log.info("transform.section1.done rows=%d path=%s", len(df), OUT_PATH)
    return df


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    df = run()
    print(f"Section 1: {len(df):,} rows written to {OUT_PATH}")
    print(f"Metrics: {df['metric'].unique().sort().to_list()}")
    print(f"Years: {df['year'].min()}–{df['year'].max()}")
    print(f"Geo levels: {df['geo_level'].unique().to_list()}")
    print(f"Geo codes: {df['geo_code'].n_unique()}")

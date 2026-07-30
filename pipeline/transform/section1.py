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

# The second element of each tuple is the cube's OWN label for the indicator.
# Keep them verbatim: the metric name must be checkable against what SUSR calls
# the quantity, because a metric named after what we wanted rather than what the
# indicator is cannot be caught by any downstream check.
#
# IN010076 was previously named `internal_net`, implying net INTERNAL migration.
# It is natural increase, births minus deaths, and has nothing to do with
# migration. The identity total_change = IN010076 + IN010080 closes exactly at
# every geo level and year, which confirms the reading.
#
# IN010078/79/80 were named intl_in / intl_out / intl_net, implying
# INTERNATIONAL migration. They are not international. SUSR publishes ONE
# migration family whose meaning depends entirely on the geographic level it is
# read at:
#
#   geo_level='nation'  the only unit with no "other district" to move to, so
#                       these ARE international.
#   any sub-national    moves across THAT unit's boundary, internal moves
#                       included. The okres sum runs 11-29x the national figure,
#                       which is the evidence for the distinction: an
#                       international series cannot exceed its own national total.
#
# The national figure also matches Eurostat migr_emi1ctz for SK to the person,
# but that is a transcription check and nothing more: Eurostat does not collect
# migration data, member states file it, so that series IS this one. It confirms
# our parse, not the level.
#
# So the names now say what the indicator is (migration across the unit's
# boundary) and the geo_level says which boundary. No cube we hold separates
# internal from international below the national level: searched every indicator
# of all 13 held SUSR cubes, and only om7011rr, om7013rr and om7104rr carry
# migration at all, all three with this same undifferentiated family.
#
# `internal_in` and `internal_out` therefore never existed as data. They were
# declared in the output schema and in 04-spec.md, and nothing ever produced
# them, because the source cannot.
INDICATOR_MAP_OM7011 = {
    "IN010051": ("population", "Permanently living population on 1 January"),
    "IN010054": ("births", "Birth"),
    # Live births, kept as its own metric because it is what natural increase is
    # computed from. It runs ~180/yr below IN010054 nationally, and conflating the
    # two is why the older migration-accounting check carries a residual.
    "IN010106": ("births_live", "Live births"),
    "IN010061": ("deaths", "Mortality"),
    "IN010076": ("natural_increase", "Natural increase"),
    "IN010078": ("migr_in", "Immigrants (in-migrants) on permanent residence"),
    "IN010079": ("migr_out", "Emigrants (out-migrants) from permanent residence"),
    "IN010080": ("migr_net", "Net migration"),
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

# Every geo code in the SUSR cubes gets an explicit level. Slovakia has exactly
# 79 okresy, and the cubes carry 80 six-character codes: the extra is SK_CAP,
# "Bratislava (districts I - V)", an aggregate of SK0101-SK0105. It was
# previously classified as an okres by an explicit special case, so it entered
# every district-level statistic alongside its own five components. The same
# applied to SK0422_0425 ("Kosice (districts I - IV)"), and SK0 (the nation) was
# labelled a kraj.
#
# Aggregates are LABELLED, not deleted, so they remain available for display
# while being excludable from district statistics.
GEO_LEVELS = {
    "SK0": "nation",
    # NUTS-2 oblasti
    "SK01": "oblast", "SK02": "oblast", "SK03": "oblast", "SK04": "oblast",
    # NUTS-3 kraje
    "SK010": "kraj", "SK021": "kraj", "SK022": "kraj", "SK023": "kraj",
    "SK031": "kraj", "SK032": "kraj", "SK041": "kraj", "SK042": "kraj",
    # City / country split published alongside the territorial hierarchy
    "M": "urban_rural", "V": "urban_rural",
    # Multi-district aggregates, NOT okresy
    "SK_CAP": "okres_aggregate",       # Bratislava I-V
    "SK0422_0425": "okres_aggregate",  # Kosice I-IV
}

# The 79 true okresy are the six-character codes minus the SK_CAP aggregate,
# which is also six characters and so cannot be separated by length alone.
OKRES_AGGREGATES = {"SK_CAP"}


def _classify_geo(code: str) -> str | None:
    """Map a SUSR geo code to its territorial level.

    Returns None only for codes with no known level; the caller must log and
    drop those rather than defaulting them into a level.
    """
    if code in GEO_LEVELS:
        return GEO_LEVELS[code]
    if len(code) == 6 and code.startswith("SK") and code not in OKRES_AGGREGATES:
        return "okres"
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
        raise ValueError(
            "section1: unclassified geo codes in om7011rr: "
            f"{sorted(skipped_geo)}. Every code must be assigned a level in "
            "GEO_LEVELS; refusing to guess, because defaulting an aggregate to "
            "okres is what contaminated the district statistics with SK_CAP."
        )

    return pl.DataFrame(all_rows)


# pr0204qs is a QUARTERLY cube. Its quarter dimension carries both single
# quarters and cumulative periods, and "1. Q." sorts first. Taking the first row
# per year therefore yields Q1, not the annual average: for 2024 that is 1,447
# EUR against an annual 1,524. The regional cube np3112qr publishes only the
# annual aggregate ("1Q4Q"), so a Q1 national figure was being compared against
# annual regional figures. Select the cumulative full-year period explicitly.
WAGE_ANNUAL_PERIOD = "1. - 4. Q."
WAGE_NOMINAL_UNIT = "EUR"


def transform_wages() -> pl.DataFrame:
    """Parse pr0204qs — average monthly wage for the whole economy (national).

    Takes the full-year cumulative period only. A year whose fourth quarter is
    not yet published has no annual figure and is skipped rather than falling
    back to a partial-year value that would not be comparable to the others.
    """
    cube_dir = RAW_SUSR / "pr0204qs"
    all_rows = []
    missing_annual = []

    for fpath in sorted(cube_dir.glob("pr0204qs_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        annual = [
            row for row in parsed
            if row["_labels"].get("pr0204qs_stv") == WAGE_ANNUAL_PERIOD
            and row["_labels"].get("pr0204qs_mj") == WAGE_NOMINAL_UNIT
            and row.get("_value") not in (None, 0)
        ]
        if not annual:
            if parsed:
                missing_annual.append(year)
            continue
        if len(annual) > 1:
            raise ValueError(
                f"section1: pr0204qs_{year} has {len(annual)} rows matching "
                f"period={WAGE_ANNUAL_PERIOD} unit={WAGE_NOMINAL_UNIT}; expected "
                "exactly one. The cube's dimensions changed, so the selection is "
                "no longer unambiguous."
            )

        all_rows.append({
            "year": year,
            "geo_level": "national",
            "geo_code": "SK0",
            "geo_name": "Slovenská republika",
            "age_bracket": "all",
            "sex": "all",
            "education": "all",
            "metric": "avg_wage_eur",
            "value": float(annual[0]["_value"]),
            "is_interpolated": None,
            "source": "susr_pr0204qs",
        })

    if missing_annual:
        log.warning(
            "transform.section1.wages: no full-year figure for %s, skipped",
            missing_annual,
        )

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

        # This cube publishes only the annual aggregate ("1Q4Q") and a single
        # EUR indicator, so one row per kraj per year. If a quarterly breakdown
        # or a second indicator ever appears, the rows below would silently
        # duplicate each kraj and the chart would show whichever survived the
        # last write. Fail instead.
        seen_kraj: set[str] = set()

        for row in parsed:
            geo_code = row.get("nuts13", "")
            if geo_code not in KRAJ_CODES:
                continue
            val = row.get("_value")
            if val is None:
                continue
            if geo_code in seen_kraj:
                raise ValueError(
                    f"section1: np3112qr_{year} has more than one value for "
                    f"{geo_code}. The cube gained a dimension (period or "
                    "indicator), so the annual EUR figure must now be selected "
                    "explicitly, as transform_wages does for pr0204qs."
                )
            seen_kraj.add(geo_code)
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
    unclassified_geo: set[str] = set()

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
                unclassified_geo.add(geo_code)
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

    if unclassified_geo:
        raise ValueError(
            "section1: unclassified geo codes in om7007rr: "
            f"{sorted(unclassified_geo)}. Every code must be assigned a level in "
            "GEO_LEVELS; refusing to guess."
        )

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
        # The hero and the mirror comparison both read this at national level.
        "migr_out": 22,
        "births_live": 1,
        "natural_increase": 1,
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

    # The national wage series is a quarterly cube reduced to one figure per
    # year. Selecting the wrong period yields a plausible number that is not
    # comparable to the regional series, which is annual only: the deployed
    # chart drew its national reference line at Q1 2024 (1,447 EUR) while the
    # bars were annual. Both series must agree at the national level, so check
    # the national figure sits above the lowest kraj and below the highest.
    wage = df.filter(pl.col("metric") == "avg_wage_eur")
    nat = wage.filter(pl.col("geo_level") == "national")
    kraj = wage.filter(pl.col("geo_level") == "kraj")
    for year in sorted(set(nat["year"]) & set(kraj["year"])):
        n = nat.filter(pl.col("year") == year)["value"][0]
        k = kraj.filter(pl.col("year") == year)["value"]
        if not (k.min() <= n <= k.max()):
            raise ValueError(
                f"section1 transform refusing to write: national average wage "
                f"for {year} is {n:.0f} EUR but the eight kraj span "
                f"{k.min():.0f}-{k.max():.0f}. The two series are on different "
                "reference periods (pr0204qs is quarterly, np3112qr is annual)."
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

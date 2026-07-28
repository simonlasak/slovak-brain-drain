"""
Stage 2 Transform — Section 3: Global diaspora.

Reads from:
- data/raw/oecd/mig_popf_svk.csv (Slovak nationals/born in OECD countries)
- data/raw/oecd/mig_flows_from_svk.csv (migration flows from Slovakia)
- data/raw/un_desa/migrant_stock_bilateral_2020.xlsx (bilateral stock)

Writes to:
- data/processed/section3_diaspora.parquet
"""
from __future__ import annotations

import logging
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_OECD = REPO_ROOT / "data" / "raw" / "oecd"
RAW_UN_DESA = REPO_ROOT / "data" / "raw" / "un_desa"
OUT_PATH = REPO_ROOT / "data" / "processed" / "section3_diaspora.parquet"


def transform_oecd_popf() -> pl.DataFrame:
    """OECD population of foreign/foreign-born — Slovaks in OECD countries."""
    fpath = RAW_OECD / "mig_popf_svk_abroad.csv"
    if not fpath.exists():
        fpath = RAW_OECD / "mig_popf_svk.csv"
    df = pl.read_csv(fpath, infer_schema_length=10000)

    rows = []
    for row in df.iter_rows(named=True):
        year = row.get("TIME_PERIOD")
        if year is None:
            continue
        year = int(year)
        if year < 1990:
            continue

        destination = row.get("REF_AREA", "")
        if not destination or destination == "SVK":
            continue

        value = row.get("OBS_VALUE")
        if value is None or float(value) == 0:
            continue

        sex_raw = row.get("SEX", "_T")
        sex = {"_T": "all", "M": "M", "F": "F"}.get(str(sex_raw), "all")

        rows.append({
            "year": year,
            "slovak_def": "born",
            "destination_iso3": str(destination),
            "sex": sex,
            "age_bracket": "all",
            "education": "all",
            "metric": "stock",
            "value": float(value),
            "is_interpolated": False,
            "source": "oecd_mig_popf",
        })

    return pl.DataFrame(rows)


# OECD DSD_MIG MEASURE codes present in mig_flows_svk_abroad.csv. The file
# stacks five different measures in one table, distinguished ONLY by this
# column: every other dimension (year, citizenship, sex, age, education, unit)
# is identical across them. Reading OBS_VALUE without filtering on MEASURE
# therefore produced several contradictory rows per country-year and silently
# mixed stocks into the flow series.
#
# Identified by cross-validation against independent sources:
#   B11 inflow of Slovak citizens   CZE ~5.8-7.2k/yr, matches the "6,000 to
#                                   7,000 per year" figure Section 2 takes
#                                   from OECD commentary
#   B12 outflow / departures        smaller counter-flow
#   B13 asylum applications         effectively zero for Slovaks
#   B14 stock of foreign population (in the popf file, not this one)
#   B15 stock of Slovak population  CZE series equals CSU CIZ003T003 exactly
#                                   but shifted one year (start- vs end-of-year
#                                   convention), so it is NOT a flow
#   B16 naturalisations             low hundreds
#
# Only B11 is a genuine inflow of Slovaks, so only B11 becomes metric='inflow'.
# B12 and B16 are kept under their own metric names because they are real and
# may be wanted later; B13 and B15 are dropped (B13 is noise, B15 duplicates
# Section 2's residence series on a different year convention).
OECD_FLOW_MEASURES = {
    "B11": "inflow",
    "B12": "outflow",
    "B16": "naturalisations",
}

# Greece reports B15 for 2022 as 780,000, which is three orders of magnitude
# above every neighbouring observation and above the entire Slovak diaspora.
# It is a unit error (thousands reported as persons) in the upstream file. B15
# is dropped anyway, but guard the threshold so no future measure smuggles it
# back in.
IMPLAUSIBLE_VALUE = 500_000


def transform_oecd_flows() -> pl.DataFrame:
    """OECD migration flows — Slovaks arriving in and leaving OECD countries.

    Splits the stacked MEASURE codes into distinct metrics instead of
    collapsing them into a single undifferentiated 'inflow'.
    """
    fpath = RAW_OECD / "mig_flows_svk_abroad.csv"
    if not fpath.exists():
        fpath = RAW_OECD / "mig_flows_from_svk.csv"
    df = pl.read_csv(fpath, infer_schema_length=10000)

    if "MEASURE" not in df.columns:
        raise ValueError(
            f"{fpath.name} has no MEASURE column; the OECD schema has changed "
            "and the measures can no longer be separated. Refusing to emit a "
            "silently mixed series."
        )

    rows = []
    dropped: dict[str, int] = {}
    for row in df.iter_rows(named=True):
        year = row.get("TIME_PERIOD")
        if year is None or str(year).strip() == "":
            continue
        year = int(year)
        if year < 1990:
            continue

        destination = row.get("REF_AREA", "")
        if not destination or destination == "SVK":
            continue

        measure = str(row.get("MEASURE", "")).strip()
        metric = OECD_FLOW_MEASURES.get(measure)
        if metric is None:
            dropped[measure] = dropped.get(measure, 0) + 1
            continue

        value = row.get("OBS_VALUE")
        if value is None or str(value).strip() == "" or float(value) == 0:
            continue
        value = float(value)
        if value > IMPLAUSIBLE_VALUE:
            log.warning(
                "transform.section3.implausible_value measure=%s dest=%s year=%s value=%s (dropped)",
                measure, destination, year, value,
            )
            continue

        sex_raw = row.get("SEX", "_T")
        sex = {"_T": "all", "M": "M", "F": "F"}.get(str(sex_raw), "all")

        rows.append({
            "year": year,
            "slovak_def": "citizen",
            "destination_iso3": str(destination),
            "sex": sex,
            "age_bracket": "all",
            "education": "all",
            "metric": metric,
            "value": value,
            "is_interpolated": False,
            "source": f"oecd_mig_flows_{measure}",
        })

    if dropped:
        log.info("transform.section3.flows_measures_dropped %s", dropped)

    return pl.DataFrame(rows)


# UN DESA location code for Slovakia, used to select the origin row.
SVK_LOCATION_CODE = 703
# Aggregate rows (WORLD, regions, development groups) share the 900+ code space
# and must not be mistaken for destination countries.
UN_AGGREGATE_MIN = 900


def transform_un_desa() -> pl.DataFrame:
    """UN DESA bilateral migrant stock — Slovak-born by destination country.

    Table 1 of the 2020 revision is a destination-by-origin matrix: one row per
    destination, one column per origin, with a block of columns per reference
    year. We take the Slovakia origin column for every destination row.

    This is the only source with broad country coverage (51 destinations in
    2020 versus roughly 22 from OECD), which is why Section 3's map uses a UN
    DESA snapshot year rather than an annual series.
    """
    fpath = RAW_UN_DESA / "migrant_stock_bilateral_2020.xlsx"
    if not fpath.exists():
        log.warning("transform.section3.un_desa_missing path=%s", fpath)
        return pl.DataFrame()

    import openpyxl

    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    ws = wb["Table 1"]

    rows: list[dict] = []
    header: list | None = None
    # (sex, year) -> column index. Table 1 repeats the whole year block three
    # times: both sexes, then males, then females, labelled only in a banner row
    # above the year header. Keying by year alone would let the male and female
    # blocks overwrite the combined one and silently halve every figure.
    sex_year_cols: dict[tuple[str, int], int] = {}
    sex_blocks: list[tuple[int, str]] = []

    for raw in ws.iter_rows(values_only=True):
        if header is None:
            # Banner row naming each block; capture where each sex starts.
            for idx, cell in enumerate(raw or ()):
                if cell is None:
                    continue
                text = str(cell).lower()
                if "international migrant stock" not in text:
                    continue
                if "both sexes" in text:
                    sex_blocks.append((idx, "all"))
                elif "male" in text and "female" not in text:
                    sex_blocks.append((idx, "M"))
                elif "female" in text:
                    sex_blocks.append((idx, "F"))

            # The sheet carries several rows of citation preamble; the real
            # header is the row whose first cell is "Index".
            if raw and str(raw[0]).strip() == "Index":
                header = list(raw)
                if not sex_blocks:
                    raise ValueError(
                        "UN DESA Table 1: could not locate the sex block banners, "
                        "so year columns cannot be attributed to a sex."
                    )
                sex_blocks.sort()
                for idx, cell in enumerate(header):
                    text = str(cell).strip() if cell is not None else ""
                    if not (text.isdigit() and 1990 <= int(text) <= 2100):
                        continue
                    # Attribute this year column to the last block that starts
                    # at or before it.
                    sex = None
                    for start, label in sex_blocks:
                        if idx >= start:
                            sex = label
                    if sex is not None:
                        sex_year_cols[(sex, int(text))] = idx
                if not sex_year_cols:
                    raise ValueError("UN DESA Table 1: no year columns found")
            continue

        # Columns are positional: 3 = destination location code,
        # 6 = origin location code (0-indexed).
        dest_code = raw[3]
        origin_code = raw[6]
        if dest_code is None or origin_code is None:
            continue
        try:
            dest_code = int(dest_code)
            origin_code = int(origin_code)
        except (TypeError, ValueError):
            continue

        if origin_code != SVK_LOCATION_CODE:
            continue
        # Skip WORLD / regional / development-group aggregate destinations.
        if dest_code >= UN_AGGREGATE_MIN:
            continue

        for (sex, year), col in sex_year_cols.items():
            value = raw[col] if col < len(raw) else None
            if value is None:
                continue
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue
            if value <= 0:
                continue

            rows.append({
                "year": year,
                "slovak_def": "born",
                # Keep the UN M49 numeric code as a zero-padded string so it
                # matches the `m49` property emitted by the world-boundaries
                # transform; the frontend joins via that mapping.
                "destination_iso3": str(dest_code).zfill(3),
                "sex": sex,
                "age_bracket": "all",
                "education": "all",
                "metric": "stock",
                "value": value,
                "is_interpolated": False,
                "source": "un_desa_bilateral_2020",
            })

    wb.close()
    return pl.DataFrame(rows)


def run() -> pl.DataFrame:
    log.info("transform.section3.start")

    df_popf = transform_oecd_popf()
    log.info("transform.section3.popf rows=%d", len(df_popf))

    df_flows = transform_oecd_flows()
    log.info("transform.section3.flows rows=%d", len(df_flows))

    df_desa = transform_un_desa()
    log.info("transform.section3.un_desa rows=%d", len(df_desa))

    frames = [f for f in [df_popf, df_flows, df_desa] if len(f) > 0]
    df = pl.concat(frames, how="vertical_relaxed")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUT_PATH)
    log.info("transform.section3.done rows=%d path=%s", len(df), OUT_PATH)
    return df


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    df = run()
    print(f"Section 3: {len(df):,} rows written to {OUT_PATH}")
    print(f"Metrics: {df['metric'].unique().sort().to_list()}")
    print(f"Years: {df['year'].min()}–{df['year'].max()}")
    print(f"Destinations: {df['destination_iso3'].n_unique()}")
    print(f"Top destinations (stock):")
    top = (df.filter(pl.col('metric') == 'stock')
           .group_by('destination_iso3')
           .agg(pl.col('value').max())
           .sort('value', descending=True)
           .head(10))
    print(top)

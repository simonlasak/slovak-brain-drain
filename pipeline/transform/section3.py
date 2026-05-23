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


def transform_oecd_flows() -> pl.DataFrame:
    """OECD migration flows — Slovaks arriving in other OECD countries."""
    fpath = RAW_OECD / "mig_flows_svk_abroad.csv"
    if not fpath.exists():
        fpath = RAW_OECD / "mig_flows_from_svk.csv"
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
            "slovak_def": "citizen",
            "destination_iso3": str(destination),
            "sex": sex,
            "age_bracket": "all",
            "education": "all",
            "metric": "inflow",
            "value": float(value),
            "is_interpolated": False,
            "source": "oecd_mig_flows",
        })

    return pl.DataFrame(rows)


def run() -> pl.DataFrame:
    log.info("transform.section3.start")

    df_popf = transform_oecd_popf()
    log.info("transform.section3.popf rows=%d", len(df_popf))

    df_flows = transform_oecd_flows()
    log.info("transform.section3.flows rows=%d", len(df_flows))

    frames = [f for f in [df_popf, df_flows] if len(f) > 0]
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

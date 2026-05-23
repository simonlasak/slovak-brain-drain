"""
Stage 2 Transform — Section 2: SK↔CZ corridor.

Reads from:
- data/raw/csu_foreigners/CIZ002T002.csv (Slovaks in CZ by type, sex, year)
- data/raw/csu_foreigners/CIZ003T003.csv (Slovaks in CZ by Czech region)
- data/raw/csu_foreigners/CIZ03.csv (economic activity of foreigners)
- data/raw/csu_foreigners/msmt_slovak_students_cz.csv (students by year/sex/level)

Writes to:
- data/processed/section2_corridor.parquet
"""
from __future__ import annotations

import logging
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_CSU = REPO_ROOT / "data" / "raw" / "csu_foreigners"
OUT_PATH = REPO_ROOT / "data" / "processed" / "section2_corridor.parquet"


def transform_stock() -> pl.DataFrame:
    """CIZ002T002 — Slovaks in CZ by residence type, sex, annual."""
    fpath = RAW_CSU / "CIZ002T002.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"DRPOVOLPOBYT001": pl.Utf8, "Pohlciz": pl.Utf8, "STOBCAN5.STOBCAN1": pl.Utf8, "STOBCAN5.STOBCAN2": pl.Utf8})

    # Filter to Slovensko (code 703)
    df_sk = df.filter(pl.col("STOBCAN5.STOBCAN2") == "703")

    rows = []
    for row in df_sk.iter_rows(named=True):
        year_str = row.get("CASR3112", "")
        if not year_str or len(year_str) < 4:
            continue
        year = int(year_str[:4])

        sex_code = row.get("Pohlciz", "0")
        sex = {"0": "all", "1": "M", "2": "F"}.get(str(sex_code), "all")

        value = row.get("Hodnota")
        if value is None:
            continue

        rows.append({
            "year": year,
            "flow_direction": "sk_to_cz",
            "pathway": "all",
            "sk_geo_code": "SK",
            "cz_geo_code": "CZ",
            "age_bracket": "all",
            "sex": sex,
            "education": "all",
            "field_or_sector": "all",
            "metric": "stock",
            "value": float(value),
            "is_interpolated": False,
            "source": "csu_CIZ002T002",
        })

    return pl.DataFrame(rows)


def transform_labour() -> pl.DataFrame:
    """CIZ03 — Economic activity of foreigners (Slovaks in CZ labour market)."""
    fpath = RAW_CSU / "CIZ03.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"STOBCAN": pl.Utf8, "POHL1": pl.Utf8})

    # Filter to Slovenská republika (code 703)
    df_sk = df.filter(pl.col("STOBCAN") == "703")

    rows = []
    for row in df_sk.iter_rows(named=True):
        year_raw = row.get("CasR", "")
        if not year_raw:
            continue
        year = int(str(year_raw)[:4])

        sex_code = row.get("POHL1", "0")
        sex = {"0": "all", "1": "M", "2": "F"}.get(str(sex_code), "all")

        value = row.get("Hodnota")
        if value is None:
            continue

        rows.append({
            "year": year,
            "flow_direction": "sk_to_cz",
            "pathway": "labour",
            "sk_geo_code": "SK",
            "cz_geo_code": "CZ",
            "age_bracket": "all",
            "sex": sex,
            "education": "all",
            "field_or_sector": "all",
            "metric": "stock",
            "value": float(value),
            "is_interpolated": False,
            "source": "csu_CIZ03",
        })

    return pl.DataFrame(rows)


def transform_students() -> pl.DataFrame:
    """MŠMT/Eurostat — Slovak students at Czech universities."""
    fpath = RAW_CSU / "msmt_slovak_students_cz.csv"
    df = pl.read_csv(fpath)

    rows = []
    for row in df.iter_rows(named=True):
        year = int(row["year"])
        sex_raw = row["sex"]
        sex = {"T": "all", "M": "M", "F": "F"}.get(sex_raw, "all")

        isced = row["isced_level"]
        edu_map = {
            "ED5": "isced_3-4",
            "ED5-8": "all",
            "ED6": "isced_5-8",
            "ED7": "isced_5-8",
            "ED8": "isced_5-8",
        }
        education = edu_map.get(isced, "all")

        value = row["students"]
        if value is None or value == 0:
            continue

        rows.append({
            "year": year,
            "flow_direction": "sk_to_cz",
            "pathway": "student",
            "sk_geo_code": "SK",
            "cz_geo_code": "CZ",
            "age_bracket": "all",
            "sex": sex,
            "education": education,
            "field_or_sector": isced,
            "metric": "students_enrolled",
            "value": float(value),
            "is_interpolated": False,
            "source": "eurostat_educ_uoe_mobs02",
        })

    return pl.DataFrame(rows)


def transform_regional() -> pl.DataFrame:
    """CIZ003T003 — Slovaks in CZ by Czech region (kraj)."""
    fpath = RAW_CSU / "CIZ003T003.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"STOBCAN5.STOBCAN1": pl.Utf8, "STOBCAN5.STOBCAN2": pl.Utf8, "Uz02jk": pl.Utf8})

    # Filter to Slovensko
    df_sk = df.filter(pl.col("STOBCAN5.STOBCAN2") == "703")

    rows = []
    for row in df_sk.iter_rows(named=True):
        year_str = row.get("CASR3112", "")
        if not year_str or len(year_str) < 4:
            continue
        year = int(year_str[:4])

        cz_region = row.get("Uz02jk", "CZ")
        value = row.get("Hodnota")
        if value is None:
            continue

        rows.append({
            "year": year,
            "flow_direction": "sk_to_cz",
            "pathway": "all",
            "sk_geo_code": "SK",
            "cz_geo_code": str(cz_region),
            "age_bracket": "all",
            "sex": "all",
            "education": "all",
            "field_or_sector": "all",
            "metric": "stock",
            "value": float(value),
            "is_interpolated": False,
            "source": "csu_CIZ003T003",
        })

    return pl.DataFrame(rows)


def run() -> pl.DataFrame:
    log.info("transform.section2.start")

    df_stock = transform_stock()
    log.info("transform.section2.stock rows=%d", len(df_stock))

    df_labour = transform_labour()
    log.info("transform.section2.labour rows=%d", len(df_labour))

    df_students = transform_students()
    log.info("transform.section2.students rows=%d", len(df_students))

    df_regional = transform_regional()
    log.info("transform.section2.regional rows=%d", len(df_regional))

    frames = [f for f in [df_stock, df_labour, df_students, df_regional] if len(f) > 0]
    df = pl.concat(frames, how="vertical_relaxed")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(OUT_PATH)
    log.info("transform.section2.done rows=%d path=%s", len(df), OUT_PATH)
    return df


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    df = run()
    print(f"Section 2: {len(df):,} rows written to {OUT_PATH}")
    print(f"Pathways: {df['pathway'].unique().sort().to_list()}")
    print(f"Metrics: {df['metric'].unique().sort().to_list()}")
    print(f"Years: {df['year'].min()}–{df['year'].max()}")

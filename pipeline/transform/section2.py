"""
Stage 2 Transform - Section 2: SK to CZ corridor.

Reads from:
- data/raw/csu_foreigners/CIZ002T002.csv (Slovaks in CZ by type, sex, year)
- data/raw/csu_foreigners/CIZ003T003.csv (Slovaks in CZ by Czech region)
- data/raw/csu_foreigners/CIZ03.csv (economic activity of foreigners)
- data/raw/csu_foreigners/msmt_slovak_students_cz.csv (students by year/sex/level)
- data/raw/csu_foreigners/CIZ004T002.csv (age structure of foreigners, EU27 proxy)

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

EMPLOYMENT_STATUS_MAP = {
    "zaměstnanost cizinců": "total",
    "pracovněprávní vztahy cizinců v postavení zaměstnanců": "employed",
    "cizinci s platným živnostenským oprávněním": "self_employed",
}

AGE_BAND_MAP = {
    0: "all",
    400000600005000: "0-4",
    400005610010000: "5-9",
    410010610015000: "10-14",
    410015610020000: "15-19",
    410020610025000: "20-24",
    410025610030000: "25-29",
    410030610035000: "30-34",
    410035610040000: "35-39",
    410040610045000: "40-44",
    410045610050000: "45-49",
    410050610055000: "50-54",
    410055610060000: "55-59",
    410060610065000: "60-64",
    410065610070000: "65-69",
    410070610075000: "70-74",
    410075610080000: "75-79",
    410080610085000: "80-84",
    410085799999000: "85+",
}

PROXY_NOTE = (
    "EU27 citizens in CZ used as proxy for Slovak age structure. "
    "Slovak-specific age data not available in CSU open data."
)


def transform_stock() -> pl.DataFrame:
    """CIZ002T002 - Slovaks in CZ by residence type, sex, annual."""
    fpath = RAW_CSU / "CIZ002T002.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"DRPOVOLPOBYT001": pl.Utf8, "Pohlciz": pl.Utf8, "STOBCAN5.STOBCAN1": pl.Utf8, "STOBCAN5.STOBCAN2": pl.Utf8})

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
            "is_interpolated": None,
            "source": "csu_CIZ002T002",
            "employment_status": "n/a",
            "is_proxy": False,
            "proxy_note": "",
        })

    return pl.DataFrame(rows)


def transform_labour() -> pl.DataFrame:
    """CIZ03 - Economic activity of foreigners (Slovaks in CZ labour market)."""
    fpath = RAW_CSU / "CIZ03.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"STOBCAN": pl.Utf8, "POHL1": pl.Utf8})

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

        ukazatel = row.get("Ukazatel", "")
        employment_status = EMPLOYMENT_STATUS_MAP.get(ukazatel.strip().lower(), "unknown")

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
            "is_interpolated": None,
            "source": "csu_CIZ03",
            "employment_status": employment_status,
            "is_proxy": False,
            "proxy_note": "",
        })

    return pl.DataFrame(rows)


def transform_students() -> pl.DataFrame:
    """Eurostat educ_uoe_mobs02 - Slovak students enrolled at Czech universities (stock)."""
    import gzip

    fpath = REPO_ROOT / "data" / "raw" / "eurostat" / "educ_uoe_mobs02.tsv.gz"

    rows = []
    with gzip.open(fpath, "rt") as f:
        header = f.readline().strip()
        years_str = header.split("\t")[1:]
        years = [int(y.strip()) for y in years_str]

        for line in f:
            parts = line.strip().split("\t")
            dims = parts[0].split(",")
            if len(dims) < 6:
                continue
            partner = dims[2]
            sex_code = dims[3]
            isced = dims[4]
            geo = dims[5]

            if partner != "SK" or geo != "CZ":
                continue
            if isced not in ("ED5-8", "ED6", "ED7", "ED8"):
                continue

            sex = {"T": "all", "M": "M", "F": "F"}.get(sex_code, "all")
            edu_map = {
                "ED5-8": "all",
                "ED6": "isced_5-8",
                "ED7": "isced_5-8",
                "ED8": "isced_5-8",
            }
            education = edu_map.get(isced, "all")

            values = parts[1:]
            for i, val_str in enumerate(values):
                val_clean = val_str.strip().replace(" ", "")
                val_num = "".join(c for c in val_clean if c.isdigit())
                if not val_num:
                    continue
                value = int(val_num)
                if value == 0:
                    continue

                rows.append({
                    "year": years[i],
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
                    "is_interpolated": None,
                    "source": "eurostat_educ_uoe_mobs02",
                    "employment_status": "n/a",
                    "is_proxy": False,
                    "proxy_note": "",
                })

    return pl.DataFrame(rows)


def transform_regional() -> pl.DataFrame:
    """CIZ003T003 - Slovaks in CZ by Czech region (kraj)."""
    fpath = RAW_CSU / "CIZ003T003.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000, schema_overrides={"STOBCAN5.STOBCAN1": pl.Utf8, "STOBCAN5.STOBCAN2": pl.Utf8, "Uz02jk": pl.Utf8})

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
            "is_interpolated": None,
            "source": "csu_CIZ003T003",
            "employment_status": "n/a",
            "is_proxy": False,
            "proxy_note": "",
        })

    return pl.DataFrame(rows)


def transform_age() -> pl.DataFrame:
    """CIZ004T002 - Age structure of EU27 citizens in CZ (proxy for Slovak age)."""
    fpath = RAW_CSU / "CIZ004T002.csv"
    df = pl.read_csv(fpath, encoding="utf-8", infer_schema_length=10000)

    # Filter to EU27 only (STOBCAN6 = 76)
    df_eu27 = df.filter(pl.col("STOBCAN6") == 76)

    rows = []
    for row in df_eu27.iter_rows(named=True):
        year_str = row.get("CASR3112", "")
        if not year_str or len(year_str) < 4:
            continue
        year = int(year_str[:4])

        vek5 = row.get("VEK5")
        age_group = AGE_BAND_MAP.get(vek5)
        if age_group is None:
            continue
        # Skip the "Celkem" (total) row; we only want individual bands
        if age_group == "all":
            continue

        sex_code = row.get("Pohlciz", 0)
        sex = {0: "all", 1: "M", 2: "F"}.get(sex_code, "all")

        value = row.get("Hodnota")
        if value is None:
            continue

        rows.append({
            "year": year,
            "flow_direction": "sk_to_cz",
            "pathway": "all",
            "sk_geo_code": "SK",
            "cz_geo_code": "CZ",
            "age_bracket": age_group,
            "sex": sex,
            "education": "all",
            "field_or_sector": "all",
            "metric": "age_structure_proxy",
            "value": float(value),
            "is_interpolated": None,
            "source": "csu_CIZ004T002",
            "employment_status": "n/a",
            "is_proxy": True,
            "proxy_note": PROXY_NOTE,
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

    df_age = transform_age()
    log.info("transform.section2.age rows=%d", len(df_age))

    frames = [f for f in [df_stock, df_labour, df_students, df_regional, df_age] if len(f) > 0]
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
    print(f"Years: {df['year'].min()}-{df['year'].max()}")

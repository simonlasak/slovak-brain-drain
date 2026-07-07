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

    for fpath in sorted(cube_dir.glob("om7011rr_*.json")):
        if "manifest" in fpath.name:
            continue
        year = int(fpath.stem.split("_")[-1])
        parsed = _parse_jsonstat_cube(fpath)

        for row in parsed:
            geo_code = row.get("om7011rr_vuc", "")
            geo_level = _classify_geo(geo_code)
            if geo_level is None:
                continue

            indicator_code = row.get("om7011rr_ukaz", "")
            if indicator_code not in INDICATOR_MAP_OM7011:
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
                "is_interpolated": False,
                "source": "susr_om7011rr",
            })

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
                "is_interpolated": False,
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
                "is_interpolated": False,
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
                "metric": "population",
                "value": float(val),
                "is_interpolated": False,
                "source": "susr_om7007rr",
            })

    return pl.DataFrame(all_rows)


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

    frames = [f for f in [df_pop, df_wages, df_wages_regional, df_age] if len(f) > 0]
    df = pl.concat(frames, how="vertical_relaxed")

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

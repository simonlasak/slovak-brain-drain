"""
Full ŠÚ SR DataCube fetch — downloads all tables listed in config.yaml.

The DataCube API has a result-size limit ("Too many results!" at ~50k cells).
Strategy: for each cube, we fetch year-by-year using the pattern
    /api/v2/dataset/{cube}/{geo_all}/{year}/{indicator_all}/{sex_all}
and concatenate. Each cube's dimension layout is declared in CUBE_SCHEMAS below,
discovered empirically from the API.

Outputs one JSON-stat file per cube per year in data/raw/susr_datacube/.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path

from pipeline.fetch._base import (
    FetchResult,
    fetch_and_save,
    load_config,
    make_client,
    setup_logging,
    REPO_ROOT,
)

log = logging.getLogger(__name__)

SUSR_BASE = "https://data.statistics.sk/api/v2"

YEARS = list(range(2004, 2026))


@dataclass(frozen=True)
class CubeSchema:
    """Describes how to slice a cube for the API's result-size limit."""
    dims: int
    year_position: int
    fetch_pattern: str


CUBE_SCHEMAS: dict[str, CubeSchema] = {
    # 3 dims: geo / year / indicator
    "om7011rr": CubeSchema(3, 1, "all/{year}/all"),
    "om7014rr": CubeSchema(3, 1, "all/{year}/all"),
    "om7104rr": CubeSchema(3, 1, "all/{year}/all"),
    # 4 dims: geo / year / indicator / sex
    "om7013rr": CubeSchema(4, 1, "all/{year}/all/all"),
    "om7102rr": CubeSchema(4, 1, "all/{year}/all/SPOLU"),
    # 4 dims at obec level — constrained to population indicator + total sex
    "om7101rr": CubeSchema(4, 1, "all/{year}/IN010113/SPOLU"),
    # Wages: year / structure / indicator / unit
    "pr0204qs": CubeSchema(4, 0, "{year}/all/all/all"),
    "pr0205qs": CubeSchema(4, 0, "{year}/all/all/all"),
    # 5 dims: geo / year / type / sex / age — slice by year+sex
    "om7004rr": CubeSchema(5, 1, "all/{year}/all/SPOLU/all"),
    # 5 dims: geo / year / indicator / sex / age group — slice by year+sex
    "om7007rr": CubeSchema(5, 1, "all/{year}/all/SPOLU/all"),
    "om7009rr": CubeSchema(5, 1, "all/{year}/all/SPOLU/all"),
    # 6 dims: year / month / spec / nace / unit / indicator
    "od0008ms": CubeSchema(6, 0, "{year}/all/all/all/all/all"),
    # om5001rr excluded — unknown dimension structure, returns 400
}


def fetch_susr_all(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("susr_datacube")
    cfg = load_config()
    http_cfg = cfg.get("http", {})
    delay_ms = http_cfg.get("delay_ms", 200)
    source_cfg = cfg["sources"]["susr_datacube"]
    tables = source_cfg.get("tables", {})

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "susr_datacube"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=120) as client:
        for cube_code, meta in tables.items():
            schema = CUBE_SCHEMAS.get(cube_code)
            if not schema:
                log.warning("fetch.susr.no_schema cube=%s — skipping", cube_code)
                continue

            cube_dir = out_dir / cube_code
            cube_dir.mkdir(parents=True, exist_ok=True)

            for year in YEARS:
                path_params = schema.fetch_pattern.format(year=year)
                url = f"{SUSR_BASE}/dataset/{cube_code}/{path_params}?lang=en&type=json"
                raw_path = cube_dir / f"{cube_code}_{year}.json"

                try:
                    result = fetch_and_save(
                        url=url,
                        raw_path=raw_path,
                        source="susr_datacube",
                        license=source_cfg.get("license", "CC-BY-4.0"),
                        client=client,
                        extra_manifest={
                            "cube_code": cube_code,
                            "year": year,
                            "title": meta.get("title", ""),
                            "granularity": meta.get("granularity", ""),
                            "provider": "Štatistický úrad SR",
                        },
                        delay_ms=delay_ms,
                    )
                    results.append(result)
                except Exception as exc:
                    if "400" in str(exc) or "Too many" in str(exc):
                        log.warning("fetch.susr.too_large cube=%s year=%d — skipping", cube_code, year)
                    elif "404" in str(exc) or "500" in str(exc):
                        log.debug("fetch.susr.no_data cube=%s year=%d", cube_code, year)
                    else:
                        raise

    fetched = sum(1 for r in results if not r.skipped)
    skipped = sum(1 for r in results if r.skipped)
    total_bytes = sum(r.bytes_written for r in results if not r.skipped)
    log.info(
        "fetch.susr_datacube.summary fetched=%d skipped=%d total_bytes=%d",
        fetched, skipped, total_bytes,
    )
    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]ŠÚ SR DataCube — fetching all configured tables (year-by-year)[/bold]\n")
    try:
        results = fetch_susr_all()
        fetched = [r for r in results if not r.skipped]
        skipped = [r for r in results if r.skipped]
        console.print(f"[bold]Done:[/bold] {len(fetched)} fetched, {len(skipped)} skipped, "
                      f"{sum(r.bytes_written for r in fetched):,} bytes total")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

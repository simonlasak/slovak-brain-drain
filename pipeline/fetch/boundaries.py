"""
Fetch module for geographic boundaries.

Sources:
- Slovakia: drakh/slovakia-gps-data (GitHub raw) — GeoJSON/TopoJSON at okres level
- World: topojson/world-atlas (GitHub raw) — countries TopoJSON for choropleth

Both are static files on GitHub; idempotent via hash check.
"""
from __future__ import annotations

import logging
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

SK_BOUNDARIES_URL = (
    "https://raw.githubusercontent.com/drakh/slovakia-gps-data/master/"
    "GeoJSON/epsg_4326/districts_epsg_4326.geojson"
)
WORLD_TOPO_URL = (
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
)


def fetch_boundaries(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("boundaries")
    cfg = load_config()
    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "boundaries"
    results: list[FetchResult] = []

    with make_client(cfg) as client:
        results.append(
            fetch_and_save(
                url=SK_BOUNDARIES_URL,
                raw_path=out_dir / "sk_okresy.geojson",
                source="boundaries_sk",
                license="see source (drakh/slovakia-gps-data)",
                client=client,
            )
        )
        results.append(
            fetch_and_save(
                url=WORLD_TOPO_URL,
                raw_path=out_dir / "world_countries_110m.json",
                source="boundaries_world",
                license="ISC",
                client=client,
            )
        )

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    try:
        results = fetch_boundaries()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.source}/{r.filename}: {status}")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

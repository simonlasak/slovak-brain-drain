"""
Fetch module for UN DESA International Migrant Stock.

The bilateral migrant stock data is published as Excel files.
We download the "by destination and origin" table which gives us
Slovak emigrants by destination country and immigrants by origin.

Source: https://www.un.org/development/desa/pd/content/international-migrant-stock
Direct download URL for the bilateral stock table (2020 revision):
  https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/undesa_pd_2020_ims_stock_by_sex_destination_and_origin.xlsx
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

UN_DESA_STOCK_URL = (
    "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/"
    "undesa_pd_2020_ims_stock_by_sex_destination_and_origin.xlsx"
)


def fetch_un_desa(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("un_desa")
    cfg = load_config()
    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "un_desa"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=120) as client:
        results.append(
            fetch_and_save(
                url=UN_DESA_STOCK_URL,
                raw_path=out_dir / "migrant_stock_bilateral_2020.xlsx",
                source="un_desa_migrant_stock",
                license="open data (UN)",
                client=client,
            )
        )

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    try:
        results = fetch_un_desa()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.source}/{r.filename}: {status}")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

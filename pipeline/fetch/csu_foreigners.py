"""
Fetch module for ČSÚ (Czech Statistical Office) Foreigners data.

Source: https://csu.gov.cz/foreigners-in-the-czech-republic
Open data: https://csu.gov.cz/open-data

Strategy: ČSÚ publishes tables on foreign nationals in CZ as XLSX/CSV.
We specifically need data on Slovak citizens in CZ for the corridor analysis
(Section 2). The open-data portal provides structured downloads.

Key tables:
- Foreigners by citizenship (Slovaks in CZ over time)
- Foreigners by type of residence permit
- Foreigners by region (kraj) of residence
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

CSU_OPEN_DATA_URLS: dict[str, str] = {
    "foreigners_by_citizenship": (
        "https://vdb.czso.cz/vdbvo2/exportOD.jsp?"
        "nahession=&typdat=CSV&ciession=&datession=&filession=&datession="
        "&filession=&format=CSV&katalog=31032"
    ),
    "foreigners_by_region": (
        "https://vdb.czso.cz/vdbvo2/exportOD.jsp?"
        "nahession=&typdat=CSV&ciession=&datession=&filession=&datession="
        "&filession=&format=CSV&katalog=31033"
    ),
}

CSU_PUBLICATION_URLS: dict[str, str] = {
    "cizinci_2023_tables": (
        "https://www.czso.cz/documents/10180/191186976/"
        "29002724t.xlsx"
    ),
}


def fetch_csu_foreigners(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("csu_foreigners")
    cfg = load_config()
    http_cfg = cfg.get("http", {})
    delay_ms = http_cfg.get("delay_ms", 200)

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "csu_foreigners"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=120) as client:
        for name, url in CSU_OPEN_DATA_URLS.items():
            result = fetch_and_save(
                url=url,
                raw_path=out_dir / f"{name}.csv",
                source="csu_foreigners",
                license="CC-BY-4.0",
                client=client,
                extra_manifest={"table": name},
                delay_ms=delay_ms,
            )
            results.append(result)

        for name, url in CSU_PUBLICATION_URLS.items():
            ext = url.split(".")[-1]
            result = fetch_and_save(
                url=url,
                raw_path=out_dir / f"{name}.{ext}",
                source="csu_foreigners",
                license="CC-BY-4.0",
                client=client,
                extra_manifest={"publication": name},
                delay_ms=delay_ms,
            )
            results.append(result)

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]ČSÚ Foreigners — fetching Czech statistics[/bold]\n")
    try:
        results = fetch_csu_foreigners()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.filename}: {status}")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

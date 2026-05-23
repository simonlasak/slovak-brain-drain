"""
Fetch module for Eurostat data via bulk download (gzipped TSV).

The JSON statistics API has a strict response size limit (413 for large datasets).
Instead, we use Eurostat's bulk download facility which provides full datasets
as gzipped TSV files at predictable URLs:

    https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/{code}/?format=TSV&compressed=true

These are typically 1-50 MB compressed and contain the full dataset.
We filter to relevant countries/regions in the transform stage.
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

EUROSTAT_BULK_BASE = (
    "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data"
)


def fetch_eurostat(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("eurostat")
    cfg = load_config()
    http_cfg = cfg.get("http", {})
    delay_ms = http_cfg.get("delay_ms", 200)
    source_cfg = cfg["sources"]["eurostat"]
    tables = source_cfg.get("tables", {})

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "eurostat"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=180) as client:
        for dataset_code, title in tables.items():
            url = f"{EUROSTAT_BULK_BASE}/{dataset_code}/?format=TSV&compressed=true"
            raw_path = out_dir / f"{dataset_code}.tsv.gz"

            try:
                result = fetch_and_save(
                    url=url,
                    raw_path=raw_path,
                    source="eurostat",
                    license="open data (Eurostat)",
                    client=client,
                    extra_manifest={"dataset": dataset_code, "title": title},
                    delay_ms=delay_ms,
                )
                results.append(result)
            except Exception as exc:
                log.error("fetch.eurostat.failed dataset=%s error=%s", dataset_code, exc)
                continue

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]Eurostat — fetching bulk TSV datasets[/bold]\n")
    try:
        results = fetch_eurostat()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.filename}: {status}")
        console.print(f"\n[bold]Total:[/bold] {len(results)} datasets")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

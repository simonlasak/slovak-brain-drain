"""
Fetch module for IZ Bratislava LAU1 panel dataset from Zenodo.

Source: https://zenodo.org/records/17549749
Uses the Zenodo API to discover file download URLs from the record,
then downloads all data files.
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

ZENODO_RECORD_ID = "17549749"
ZENODO_API_URL = f"https://zenodo.org/api/records/{ZENODO_RECORD_ID}"


def fetch_iz_bratislava(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("iz_bratislava")
    cfg = load_config()
    http_cfg = cfg.get("http", {})
    delay_ms = http_cfg.get("delay_ms", 200)

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "iz_bratislava_lau1"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=120) as client:
        log.info("fetch.iz_bratislava.discover url=%s", ZENODO_API_URL)
        resp = client.get(ZENODO_API_URL)
        resp.raise_for_status()
        record = resp.json()

        files = record.get("files", [])
        if not files:
            log.warning("fetch.iz_bratislava.no_files record=%s", ZENODO_RECORD_ID)
            return results

        for file_info in files:
            filename = file_info["key"]
            download_url = file_info["links"]["self"]
            result = fetch_and_save(
                url=download_url,
                raw_path=out_dir / filename,
                source="iz_bratislava_lau1",
                license="CC-BY",
                client=client,
                extra_manifest={
                    "zenodo_record": ZENODO_RECORD_ID,
                    "zenodo_checksum": file_info.get("checksum", ""),
                },
                delay_ms=delay_ms,
            )
            results.append(result)

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]IZ Bratislava LAU1 panel — Zenodo download[/bold]\n")
    try:
        results = fetch_iz_bratislava()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.filename}: {status}")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

"""
Fetch module for OECD migration data via SDMX REST API.

Dataflows:
- DF_MIG: Migration flows (inflows/outflows by nationality/country of birth)
- DF_MIG_EMP_EDU: Immigrants by employment and education level
- DF_MIG_POPF: Population of foreign/foreign-born by nationality
- DF_MIG_INT: International migration database

We fetch CSV format (csvfilealiased) which is large but complete and easy to parse.
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

OECD_SDMX_BASE = "https://sdmx.oecd.org/public/rest/data"

OECD_QUERIES: dict[str, dict] = {
    "mig_flows_from_svk": {
        "url": f"{OECD_SDMX_BASE}/OECD.ELS.IMD,DSD_MIG@DF_MIG,1.0/SVK..........?format=csvfilealiased",
        "filename": "mig_flows_from_svk.csv",
        "description": "Migration flows from Slovakia to OECD countries",
    },
    "mig_flows_to_svk": {
        "url": f"{OECD_SDMX_BASE}/OECD.ELS.IMD,DSD_MIG@DF_MIG,1.0/.SVK.........?format=csvfilealiased",
        "filename": "mig_flows_to_svk.csv",
        "description": "Migration flows to Slovakia from OECD countries",
    },
    "mig_emp_edu_svk": {
        "url": f"{OECD_SDMX_BASE}/OECD.ELS.IMD,DSD_MIG@DF_MIG_EMP_EDU,1.0/SVK..........?format=csvfilealiased",
        "filename": "mig_emp_edu_svk.csv",
        "description": "Slovak immigrants abroad by employment and education",
    },
    "mig_popf_svk": {
        "url": f"{OECD_SDMX_BASE}/OECD.ELS.IMD,DSD_MIG_F@DF_MIG_POPF,1.0/SVK..........?format=csvfilealiased",
        "filename": "mig_popf_svk.csv",
        "description": "Population of Slovak nationals/born in OECD countries",
    },
    "mig_int_svk": {
        "url": f"{OECD_SDMX_BASE}/OECD.ELS.IMD,DSD_MIG_INT@DF_MIG_INT,1.0/SVK.........?format=csvfilealiased",
        "filename": "mig_int_svk.csv",
        "description": "International migration flows — Slovakia",
    },
}


def fetch_oecd(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("oecd")
    cfg = load_config()
    http_cfg = cfg.get("http", {})
    delay_ms = http_cfg.get("delay_ms", 200)

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "oecd"
    results: list[FetchResult] = []

    with make_client(cfg, timeout=180) as client:
        for query_name, query_info in OECD_QUERIES.items():
            try:
                result = fetch_and_save(
                    url=query_info["url"],
                    raw_path=out_dir / query_info["filename"],
                    source="oecd",
                    license="OECD terms",
                    client=client,
                    extra_manifest={
                        "query": query_name,
                        "description": query_info["description"],
                    },
                    delay_ms=delay_ms,
                )
                results.append(result)
            except Exception as exc:
                log.error("fetch.oecd.failed query=%s error=%s", query_name, exc)
                continue

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]OECD — fetching migration data[/bold]\n")
    try:
        results = fetch_oecd()
        for r in results:
            status = "[dim]skipped[/dim]" if r.skipped else f"[green]{r.bytes_written:,} bytes[/green]"
            console.print(f"  {r.filename}: {status}")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

"""
Stage 0 step 6 — smoke test.

Run from repo root:

    .venv/bin/python -m pipeline.run_smoke

Goal: prove that the pipeline shape works end-to-end on one tiny cube
(`om7102rr`, Population by Sex — okres) before we wire up any of the
larger Tier 1 fetches.

Outputs:
- data/raw/susr_datacube/om7102rr.csv
- data/raw/susr_datacube/om7102rr.csv.manifest.json
- pipeline/logs/smoke-{date}.log

If anything fails with an SSL or connection error, this is most likely
the corporate proxy on the AWS machine. Stop here and surface to Šimon.
"""
from __future__ import annotations

import logging
import sys
from datetime import date
from pathlib import Path

from rich.console import Console
from rich.table import Table

from pipeline.fetch.susr import CorporateProxyError, smoke_test

REPO_ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = REPO_ROOT / "pipeline" / "logs"
RAW_DIR = REPO_ROOT / "data" / "raw" / "susr_datacube"


def _setup_logging() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"smoke-{date.today().isoformat()}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )
    return log_path


def main() -> int:
    console = Console()
    log_path = _setup_logging()

    console.print("[bold]Stage 0 smoke test[/bold] — fetching ŠÚ SR DataCube cube om7102rr")
    console.print(f"  log:  {log_path.relative_to(REPO_ROOT)}")
    console.print(f"  out:  {RAW_DIR.relative_to(REPO_ROOT)}")
    console.print()

    try:
        result = smoke_test(out_dir=RAW_DIR)
    except CorporateProxyError as exc:
        console.print(f"[bold red]CORPORATE PROXY ERROR[/bold red]\n{exc}")
        console.print(
            "\nDo not retry blindly. Diagnose:\n"
            "  1. Is data.statistics.sk reachable from this machine? "
            "(curl -v https://data.statistics.sk/api/v2/dataset/om7102rr?lang=en&type=csv | head)\n"
            "  2. Is there an HTTPS_PROXY / SSL_CERT_FILE that needs setting?\n"
            "  3. Is the corporate cert chain trusted by Python's CA bundle?\n"
        )
        return 2
    except Exception as exc:  # noqa: BLE001
        console.print(f"[bold red]UNEXPECTED ERROR[/bold red] {type(exc).__name__}: {exc}")
        return 1

    # Summarise the result
    table = Table(show_header=True, header_style="bold")
    table.add_column("field")
    table.add_column("value", overflow="fold")
    table.add_row("cube",         result.cube_code)
    table.add_row("format",       result.fmt)
    table.add_row("url",          result.url)
    table.add_row("fetched_at",   result.fetched_at)
    table.add_row("bytes",        f"{result.bytes_written:,}")
    table.add_row("sha256",       result.sha256[:24] + "…")
    table.add_row("raw file",     str(result.raw_path.relative_to(REPO_ROOT)))
    table.add_row("manifest",     str(result.manifest_path.relative_to(REPO_ROOT)))
    console.print(table)

    # Sanity-check the JSON-stat shape — top-level keys, dimensions, value count
    console.print("\n[bold]JSON-stat shape:[/bold]")
    import json
    with result.raw_path.open(encoding="utf-8") as fh:
        payload = json.load(fh)

    label = payload.get("label", "<no label>")
    update = payload.get("update", "<no update>")
    dims = payload.get("dimension", {})
    values = payload.get("value", [])

    console.print(f"  label   : {label}")
    console.print(f"  updated : {update}")
    console.print(f"  dims    : {len(dims)}  →  {', '.join(dims.keys())}")
    console.print(f"  values  : {len(values)} cells")

    # Show one example value cross-product (first geo, the chosen year/indicator/sex)
    geo_dim = dims.get("om7102rr_vuc", {})
    geo_labels = geo_dim.get("category", {}).get("label", {})
    if geo_labels and values:
        first_geo_code = next(iter(geo_labels.keys()))
        first_geo_label = geo_labels[first_geo_code]
        console.print(f"\n[bold]Example cell:[/bold]")
        console.print(f"  {first_geo_code} ({first_geo_label}) → {values[0]:,} persons")

    console.print("\n[bold green]smoke test passed[/bold green]")
    console.print(
        "[dim]Pipeline shape verified: HTTPS reachable, JSON-stat parses, "
        "manifest sidecar written, data round-trips through Python.[/dim]"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

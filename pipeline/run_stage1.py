"""
Stage 1 orchestrator — fetch all sources in priority order.

Run from repo root:
    .venv/bin/python -m pipeline.run_stage1

Behaviour:
- Runs each fetch module sequentially (respecting rate limits)
- Continues past failures — collects errors for the checkpoint report
- At the end, prints the Human Checkpoint 1 summary:
  total bytes, failed sources, spot-check sample, manifest list.
"""
from __future__ import annotations

import json
import logging
import random
import sys
import traceback
from datetime import date
from pathlib import Path

from rich.console import Console
from rich.table import Table

from pipeline.fetch._base import REPO_ROOT, setup_logging

LOG_DIR = REPO_ROOT / "pipeline" / "logs"
console = Console()


def _run_module(name: str, fetch_fn) -> tuple[str, list, str | None]:
    """Run a fetch function, return (name, results, error_or_None)."""
    try:
        results = fetch_fn()
        return name, results, None
    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        logging.getLogger(__name__).error("stage1.%s.failed %s", name, error_msg)
        return name, [], error_msg


def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"fetch-stage1-{date.today().isoformat()}.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )

    console.print("[bold]Stage 1: Fetch (parallel, with manifest)[/bold]")
    console.print(f"  log: {log_path.relative_to(REPO_ROOT)}\n")

    from pipeline.fetch.boundaries import fetch_boundaries
    from pipeline.fetch.un_desa import fetch_un_desa
    from pipeline.fetch.susr_full import fetch_susr_all
    from pipeline.fetch.eurostat import fetch_eurostat
    from pipeline.fetch.iz_bratislava import fetch_iz_bratislava
    from pipeline.fetch.census_2021 import fetch_census_2021
    from pipeline.fetch.csu_foreigners import fetch_csu_foreigners
    from pipeline.fetch.oecd import fetch_oecd
    from pipeline.fetch.notable_people import fetch_notable_people

    modules = [
        ("1. Boundaries", fetch_boundaries),
        ("2. UN DESA bilateral", fetch_un_desa),
        ("3. ŠÚ SR DataCube", fetch_susr_all),
        ("4. Eurostat", fetch_eurostat),
        ("5. IZ Bratislava LAU1", fetch_iz_bratislava),
        ("6. Census 2021", fetch_census_2021),
        ("7. ČSÚ Foreigners", fetch_csu_foreigners),
        ("8. OECD", fetch_oecd),
        ("9. Notable people", fetch_notable_people),
    ]

    all_results = []
    failures = []

    for module_name, fetch_fn in modules:
        console.print(f"[bold]{module_name}[/bold] ... ", end="")
        name, results, error = _run_module(module_name, fetch_fn)
        if error:
            console.print(f"[red]FAILED[/red] — {error}")
            failures.append((name, error))
        else:
            fetched = sum(1 for r in results if not r.skipped)
            skipped = sum(1 for r in results if r.skipped)
            total = sum(r.bytes_written for r in results if not r.skipped)
            console.print(f"[green]OK[/green] ({fetched} fetched, {skipped} skipped, {total:,} bytes)")
            all_results.extend(results)

    # ─── Human Checkpoint 1 report ───────────────────────────────
    console.print("\n" + "═" * 60)
    console.print("[bold]HUMAN CHECKPOINT 1[/bold]")
    console.print("═" * 60)

    total_bytes = sum(r.bytes_written for r in all_results if not r.skipped)
    console.print(f"\n[bold]Total bytes fetched:[/bold] {total_bytes:,}")
    console.print(f"[bold]Files fetched:[/bold] {sum(1 for r in all_results if not r.skipped)}")
    console.print(f"[bold]Files skipped (unchanged):[/bold] {sum(1 for r in all_results if r.skipped)}")

    if failures:
        console.print(f"\n[bold red]Failed sources ({len(failures)}):[/bold red]")
        for name, err in failures:
            console.print(f"  ✗ {name}: {err}")
    else:
        console.print("\n[bold green]All sources fetched successfully.[/bold green]")

    # Spot-check: 5 random rows from 3 random JSON files
    json_results = [r for r in all_results if r.raw_path.suffix == ".json" and not r.skipped]
    if json_results:
        console.print("\n[bold]Spot-check sample (random data from 3 files):[/bold]")
        sample_files = random.sample(json_results, min(3, len(json_results)))
        for r in sample_files:
            console.print(f"\n  [dim]{r.source}/{r.filename}[/dim]")
            try:
                data = json.loads(r.raw_path.read_text(encoding="utf-8"))
                if "value" in data and isinstance(data["value"], list):
                    values = data["value"][:5]
                    console.print(f"    first 5 values: {values}")
                elif isinstance(data, dict):
                    keys = list(data.keys())[:5]
                    console.print(f"    top-level keys: {keys}")
            except Exception:
                console.print("    [dim](binary or non-JSON)[/dim]")

    # Manifest listing
    console.print("\n[bold]Manifests written:[/bold]")
    for r in all_results:
        if not r.skipped:
            rel = r.manifest_path.relative_to(REPO_ROOT)
            console.print(f"  {rel}")

    console.print("\n" + "═" * 60)
    if failures:
        console.print("[yellow]Some sources failed. Review errors above before proceeding.[/yellow]")
        return 1
    else:
        console.print("[bold green]Stage 1 complete. Awaiting Šimon's confirmation to proceed.[/bold green]")
        return 0


if __name__ == "__main__":
    sys.exit(main())

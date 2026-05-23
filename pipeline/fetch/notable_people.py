"""
Fetch module for Notable People research data.

This source is qualitative and partly manual — there's no single API to hit.
The module provides structure for:
- A manually curated JSON file of notable Slovak emigrants
- Optional Wikidata SPARQL queries to augment the list

For now this is a placeholder that validates the manual data file exists
and writes a manifest for it. The actual research is done by Šimon.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from pipeline.fetch._base import (
    FetchResult,
    load_config,
    setup_logging,
    write_manifest,
    REPO_ROOT,
)

log = logging.getLogger(__name__)

MANUAL_DATA_FILE = "notable_people.json"

TEMPLATE = {
    "_comment": "Manually curated list of notable Slovak emigrants. Edit this file directly.",
    "_schema_version": 1,
    "people": [
        {
            "name": "Example Person",
            "field": "science",
            "birth_year": 1980,
            "origin_city": "Bratislava",
            "destination_country": "USA",
            "departure_year": 2005,
            "category": "academic",
            "source_url": "https://example.com",
            "notes": "",
        }
    ],
}


def ensure_data_file(out_dir: Path) -> Path:
    data_path = out_dir / MANUAL_DATA_FILE
    if not data_path.exists():
        out_dir.mkdir(parents=True, exist_ok=True)
        data_path.write_text(
            json.dumps(TEMPLATE, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        log.info("fetch.notable_people.created_template path=%s", data_path)
    return data_path


def fetch_notable_people(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("notable_people")
    cfg = load_config()
    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "notable_people"

    data_path = ensure_data_file(out_dir)
    content = data_path.read_bytes()
    sha = hashlib.sha256(content).hexdigest()
    fetched_at = datetime.now(tz=timezone.utc).isoformat()

    manifest_path = write_manifest(
        source="notable_people",
        filename=MANUAL_DATA_FILE,
        url="manual",
        fetched_at=fetched_at,
        raw_path=data_path,
        sha256=sha,
        bytes_written=len(content),
        license="original research",
        extra={"type": "manual_curation"},
    )

    return [
        FetchResult(
            source="notable_people",
            filename=MANUAL_DATA_FILE,
            url="manual",
            fetched_at=fetched_at,
            bytes_written=len(content),
            sha256=sha,
            raw_path=data_path,
            manifest_path=manifest_path,
        )
    ]


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]Notable People — ensuring manual data file[/bold]\n")
    results = fetch_notable_people()
    for r in results:
        console.print(f"  {r.filename}: {r.bytes_written:,} bytes (sha: {r.sha256[:12]})")
    console.print("\n[dim]Edit data/raw/notable_people/notable_people.json to add entries.[/dim]")

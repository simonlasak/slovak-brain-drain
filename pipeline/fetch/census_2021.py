"""
Fetch module for Census 2021 (SODB 2021) from scitanie.sk.

Data is served as static pre-generated JSON files at:
    https://www.scitanie.sk/themes/web-sodb/assets/public/disem/data/

File naming: Z{type:02d}_{indicator:02d}_{territory}_{territory_spec}_{territory_unit}.json?v=10
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import httpx

from pipeline.fetch._base import (
    FetchResult,
    load_config,
    setup_logging,
    write_manifest,
    REPO_ROOT,
)

log = logging.getLogger(__name__)

BASE_URL = "https://www.scitanie.sk/themes/web-sodb/assets/public/disem/data"
VERSION = "10"
HEADERS = {
    "Referer": "https://www.scitanie.sk/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}
KRAJ_CODES = ["SK01", "SK02", "SK03", "SK04", "SK05", "SK06", "SK07", "SK08"]

INDICATORS: dict[int, str] = {}


def discover_indicators(client: httpx.Client) -> dict[int, str]:
    indicators = {}
    for n in range(1, 31):
        url = f"{BASE_URL}/Z01_{n:02d}_SR_SK0_SR.json?v={VERSION}"
        r = client.get(url)
        if r.status_code == 200:
            data = r.json()
            name_en = data.get("table", {}).get("name_en", f"indicator_{n:02d}")
            indicators[n] = name_en
            log.info("census.discover indicator=%02d name=%s", n, name_en)
        elif r.status_code == 404:
            break
        else:
            log.warning("census.discover indicator=%02d status=%d", n, r.status_code)
        time.sleep(0.5)
    return indicators


def _safe_label(name: str) -> str:
    return name.lower().replace(" ", "_").replace("/", "_")[:40]


def fetch_obec_data(
    client: httpx.Client, indicator_n: int, label: str, out_dir: Path, error_log: Path
) -> FetchResult | None:
    """Fetch obec-level data for one indicator. Falls back to kraj-by-kraj if needed."""
    filename = f"Z01_{indicator_n:02d}_{_safe_label(label)}_obec.json"
    raw_path = out_dir / filename

    # Try national OB file first
    url = f"{BASE_URL}/Z01_{indicator_n:02d}_SR_SK0_OB.json?v={VERSION}"
    log.info("census.fetch indicator=%02d url=%s", indicator_n, url)
    r = client.get(url)

    if r.status_code == 200:
        body = r.content
    else:
        log.warning("census.fetch.fallback indicator=%02d national_status=%d", indicator_n, r.status_code)
        # Fallback: fetch kraj-by-kraj and merge
        merged_data = {}
        all_ok = True
        for kraj in KRAJ_CODES:
            kraj_url = f"{BASE_URL}/Z01_{indicator_n:02d}_KR_{kraj}_OB.json?v={VERSION}"
            kr = client.get(kraj_url)
            if kr.status_code == 200:
                kraj_data = kr.json()
                table_data = kraj_data.get("table", {}).get("data", {})
                merged_data.update(table_data)
            else:
                log.error("census.fetch.kraj_failed indicator=%02d kraj=%s status=%d",
                          indicator_n, kraj, kr.status_code)
                with error_log.open("a") as f:
                    f.write(f"{kraj_url} -> {kr.status_code}\n")
                all_ok = False
            time.sleep(0.5)

        if not merged_data:
            with error_log.open("a") as f:
                f.write(f"FAILED: indicator {indicator_n:02d} — no data from any kraj\n")
            return None

        # Reconstruct the JSON structure with merged data
        merged_json = {
            "meta": {
                "type": 1,
                "indicator": indicator_n,
                "territory": "SR",
                "territorySpecification": "SK0",
                "territoryUnit": "OB",
                "merged_from_krajs": True,
            },
            "table": {
                "name": label,
                "name_en": label,
                "data": merged_data,
            },
        }
        body = json.dumps(merged_json, ensure_ascii=False).encode("utf-8")

    import hashlib
    from datetime import datetime, timezone

    sha = hashlib.sha256(body).hexdigest()
    raw_path.write_bytes(body)
    fetched_at = datetime.now(tz=timezone.utc).isoformat()

    manifest_path = write_manifest(
        source="scitanie_2021",
        filename=filename,
        url=url,
        fetched_at=fetched_at,
        raw_path=raw_path,
        sha256=sha,
        bytes_written=len(body),
        license="open data (scitanie.sk)",
        extra={"indicator": indicator_n, "indicator_label": label, "territory_unit": "OB"},
    )

    return FetchResult(
        source="scitanie_2021",
        filename=filename,
        url=url,
        fetched_at=fetched_at,
        bytes_written=len(body),
        sha256=sha,
        raw_path=raw_path,
        manifest_path=manifest_path,
    )


def fetch_census_2021(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("census_2021")
    cfg = load_config()
    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "scitanie_2021"
    out_dir.mkdir(parents=True, exist_ok=True)
    error_log = REPO_ROOT / "pipeline" / "logs" / "scitanie_errors.log"
    error_log.parent.mkdir(parents=True, exist_ok=True)

    results: list[FetchResult] = []

    with httpx.Client(timeout=60, headers=HEADERS, follow_redirects=True) as client:
        # Step 1: Discover indicators
        indicators = discover_indicators(client)

        # Save indicator manifest
        manifest_path = out_dir / "indicator_manifest.json"
        manifest_path.write_text(
            json.dumps(
                {str(k): v for k, v in indicators.items()},
                indent=2, ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        # Step 2: Fetch obec-level data for each indicator
        for n, label in indicators.items():
            result = fetch_obec_data(client, n, label, out_dir, error_log)
            if result:
                results.append(result)
            time.sleep(0.5)

    return results


if __name__ == "__main__":
    import sys
    from rich.console import Console

    console = Console()
    console.print("[bold]Census 2021 — fetching all indicators at obec level[/bold]\n")
    try:
        results = fetch_census_2021()
        total_bytes = sum(r.bytes_written for r in results)
        console.print(f"\n[bold]Done:[/bold] {len(results)} indicators fetched, {total_bytes:,} bytes total")
        for r in results:
            console.print(f"  {r.filename}: {r.bytes_written:,} bytes")
    except Exception as exc:
        console.print(f"[bold red]ERROR[/bold red] {exc}")
        sys.exit(1)

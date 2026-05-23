"""
Fetch module for ŠÚ SR DataCube (Štatistický úrad SR).

Endpoint pattern (see docs/02-data-manifest.md §1.1 and the help page at
https://data.statistics.sk/api/html/help-en.html):

    https://data.statistics.sk/api/v2/dataset/{cube_code}/{params}?lang=en&type={fmt}

Example concrete URLs we will hit:

    /api/v2/dataset/om7102rr?lang=en&type=json-stat
    /api/v2/dataset/om7102rr/all/all/all?lang=en&type=csv

Rules of the road for this source:
- License is CC-BY-4.0 → store license in the per-file manifest.
- Updates twice daily on weekdays at 10:00 and 22:00 CET → cache aggressively;
  rerun pipeline weekly at most.
- No auth, no rate limit documented; we self-impose 200ms between calls and
  cap at 4 concurrent (see config.yaml).
- Corporate-proxy SSL failures are NOT to be retried silently. Surface and
  stop, per the workflow rule.
"""
from __future__ import annotations

import hashlib
import json
import logging
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

log = logging.getLogger(__name__)

SUSR_BASE = "https://data.statistics.sk/api/v2"
SUSR_HOST = "data.statistics.sk"


@dataclass(frozen=True)
class FetchResult:
    """One successful fetch from a DataCube endpoint, with audit metadata."""

    cube_code: str
    fmt: str
    url: str
    fetched_at: str            # ISO-8601 UTC
    bytes_written: int
    sha256: str
    raw_path: Path
    manifest_path: Path


class CorporateProxyError(RuntimeError):
    """Raised when an SSL or connection error suggests a proxy is in the way.

    Per project workflow: do NOT retry silently. Surface and stop.
    """


def _client(timeout_seconds: int = 60, user_agent: str = "slovak-brain-drain/0.1") -> httpx.Client:
    return httpx.Client(
        timeout=timeout_seconds,
        headers={"User-Agent": user_agent, "Accept-Language": "en"},
        follow_redirects=True,
    )


def _build_url(cube_code: str, fmt: str = "json", path_params: str = "all/all/all/all") -> str:
    """Build a DataCube dataset URL.

    The number of `path_params` must equal the number of dimensions for the
    cube. Use `inspect_cube_dimensions()` first if you don't know the shape.

    Format notes (verified empirically against data.statistics.sk):
    - `type=json`     → returns JSON-stat 2.0 inline. Preferred for tooling.
    - `type=csv`      → 302 redirects to an HTML download page (not a CSV).
                        Avoid for programmatic fetching.
    - `type=json-stat`→ rejected (400). Use `type=json` instead.
    - `type=xlsx`     → binary download; works but not diff-friendly.
    """
    if fmt not in {"csv", "json", "xml", "xlsx", "ods"}:
        raise ValueError(f"unsupported DataCube format: {fmt}")
    if fmt == "csv":
        log.warning(
            "fetch.susr.csv_redirect_warning cube=%s "
            "DataCube redirects CSV requests to an HTML page; consider type=json",
            cube_code,
        )
    return f"{SUSR_BASE}/dataset/{cube_code}/{path_params}?lang=en&type={fmt}"


def _write_manifest(
    *,
    cube_code: str,
    fmt: str,
    url: str,
    fetched_at: str,
    raw_path: Path,
    sha256: str,
    bytes_written: int,
) -> Path:
    """Drop a sidecar JSON describing the fetch.  Idempotency is keyed on sha256."""
    manifest = {
        "source": "susr_datacube",
        "cube_code": cube_code,
        "format": fmt,
        "url": url,
        "fetched_at": fetched_at,
        "bytes": bytes_written,
        "sha256": sha256,
        "license": "CC-BY-4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "provider": "Štatistický úrad SR",
        "provider_url": "https://slovak.statistics.sk",
    }
    manifest_path = raw_path.with_suffix(raw_path.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest_path


def fetch_cube(
    cube_code: str,
    *,
    out_dir: Path,
    fmt: str = "json",
    path_params: str = "all/all/all/all",
    user_agent: str = "slovak-brain-drain/0.1",
    timeout_seconds: int = 60,
    log_first_success: bool = True,
) -> FetchResult:
    """Fetch a single DataCube table and write it under `out_dir/{cube_code}.{ext}`.

    The default `fmt='json'` returns JSON-stat 2.0, which is the format the
    DataCube tooling notes recommend and the only inline-served format.

    Raises:
        CorporateProxyError: on TLS / connection failures (do not retry).
        httpx.HTTPStatusError: on non-2xx responses.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    url = _build_url(cube_code, fmt=fmt, path_params=path_params)
    ext = {"json": ".json-stat.json", "csv": ".csv", "xlsx": ".xlsx"}.get(fmt, f".{fmt}")
    raw_path = out_dir / f"{cube_code}{ext}"

    log.info("fetch.susr.start cube=%s fmt=%s url=%s", cube_code, fmt, url)

    try:
        with _client(timeout_seconds=timeout_seconds, user_agent=user_agent) as client:
            response = client.get(url)
    except (httpx.ConnectError, httpx.ReadError, ssl.SSLError) as exc:
        # Corporate proxy is the most likely root cause on the AWS machine.
        # Surface and stop — do not retry.
        raise CorporateProxyError(
            f"Could not connect to {SUSR_HOST}: {exc!r}. "
            f"This is likely a corporate proxy / SSL interception issue. "
            f"Diagnose before retrying."
        ) from exc

    response.raise_for_status()
    body = response.content
    bytes_written = len(body)
    sha = hashlib.sha256(body).hexdigest()
    raw_path.write_bytes(body)

    fetched_at = datetime.now(tz=timezone.utc).isoformat()
    manifest_path = _write_manifest(
        cube_code=cube_code,
        fmt=fmt,
        url=url,
        fetched_at=fetched_at,
        raw_path=raw_path,
        sha256=sha,
        bytes_written=bytes_written,
    )

    if log_first_success:
        log.info("fetch.susr.first_success host=%s cube=%s bytes=%d sha=%s",
                 SUSR_HOST, cube_code, bytes_written, sha[:12])

    return FetchResult(
        cube_code=cube_code,
        fmt=fmt,
        url=url,
        fetched_at=fetched_at,
        bytes_written=bytes_written,
        sha256=sha,
        raw_path=raw_path,
        manifest_path=manifest_path,
    )


def smoke_test(out_dir: Optional[Path] = None) -> FetchResult:
    """Stage 0 step 6 — fetch one tiny cube end-to-end to prove the pipeline shape.

    Per `docs/04-spec.md`, target is `om7102rr` (Population by Sex — okres).

    Cube has 4 dimensions: vuc (geo) × obd (year) × ukaz (indicator) × poh (sex).
    We narrow it to: all geos × year 2024 × IN010113 (population at start of period)
    × SPOLU (total, both sexes). This returns ~15 KB of JSON-stat — small enough
    to validate pipeline shape but real enough to exercise the redirect / encoding
    paths.
    """
    out_dir = out_dir or Path("data/raw/susr_datacube")
    return fetch_cube(
        "om7102rr",
        out_dir=out_dir,
        fmt="json",
        path_params="all/2024/IN010113/SPOLU",
    )

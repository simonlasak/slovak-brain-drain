"""
Shared fetch infrastructure — manifest writing, idempotency, HTTP client, logging setup.

Every fetch module uses these helpers instead of rolling their own.
"""
from __future__ import annotations

import hashlib
import json
import logging
import ssl
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import yaml

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_config() -> dict:
    config_path = REPO_ROOT / "pipeline" / "config.yaml"
    with config_path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@dataclass(frozen=True)
class FetchResult:
    source: str
    filename: str
    url: str
    fetched_at: str
    bytes_written: int
    sha256: str
    raw_path: Path
    manifest_path: Path
    skipped: bool = False


class FetchError(RuntimeError):
    """Non-retryable fetch failure — surface immediately."""


def setup_logging(source_name: str) -> Path:
    log_dir = REPO_ROOT / "pipeline" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"fetch-{source_name}-{date.today().isoformat()}.log"
    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.addHandler(handler)
    if root.level > logging.INFO:
        root.setLevel(logging.INFO)
    return log_path


def make_client(
    config: Optional[dict] = None,
    timeout: Optional[int] = None,
    user_agent: Optional[str] = None,
) -> httpx.Client:
    cfg = config or load_config()
    http_cfg = cfg.get("http", {})
    return httpx.Client(
        timeout=timeout or http_cfg.get("timeout_seconds", 60),
        headers={
            "User-Agent": user_agent or http_cfg.get("user_agent", "slovak-brain-drain/0.1"),
            "Accept-Language": "en",
        },
        follow_redirects=True,
    )


# Query-string parameter names whose VALUES are credentials. Any URL that
# reaches a log line or a manifest is scrubbed of these first.
#
# This lives in the base layer rather than in the individual fetcher because
# fetch_and_save both logs the URL and writes it into a committed manifest. A
# fetcher that redacts only its own copy still leaks through those two paths, and
# manifests ARE committed while .env is not.
SECRET_QUERY_PARAMS = ("key", "api_key", "apikey", "token", "access_token")


def redact_url(url: str) -> str:
    """Replace the value of any credential-bearing query parameter."""
    if "?" not in url:
        return url
    base, _, query = url.partition("?")
    parts = []
    for pair in query.split("&"):
        name, sep, _value = pair.partition("=")
        if sep and name.lower() in SECRET_QUERY_PARAMS:
            parts.append(f"{name}=<redacted>")
        else:
            parts.append(pair)
    return f"{base}?{'&'.join(parts)}"


def write_manifest(
    *,
    source: str,
    filename: str,
    url: str,
    fetched_at: str,
    raw_path: Path,
    sha256: str,
    bytes_written: int,
    license: str = "",
    extra: Optional[dict] = None,
) -> Path:
    manifest = {
        "source": source,
        "filename": filename,
        # Redacted: manifests are committed to the repo.
        "url": redact_url(url),
        "fetched_at": fetched_at,
        "bytes": bytes_written,
        "sha256": sha256,
        "license": license,
    }
    if extra:
        manifest.update(extra)
    manifest_path = raw_path.parent / f"{raw_path.name}.manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest_path


def is_unchanged(raw_path: Path, new_sha256: str) -> bool:
    manifest_path = raw_path.parent / f"{raw_path.name}.manifest.json"
    if not manifest_path.exists():
        return False
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        return existing.get("sha256") == new_sha256
    except (json.JSONDecodeError, OSError):
        return False


def fetch_and_save(
    *,
    url: str,
    raw_path: Path,
    source: str,
    license: str = "",
    client: httpx.Client,
    extra_manifest: Optional[dict] = None,
    delay_ms: int = 200,
) -> FetchResult:
    """Fetch a URL, write to disk, write manifest. Skip if hash unchanged."""
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    filename = raw_path.name

    log.info("fetch.%s.start url=%s", source, redact_url(url))

    try:
        response = client.get(url)
    except (httpx.ConnectError, httpx.ReadError, ssl.SSLError) as exc:
        raise FetchError(
            f"Connection failed for {source} ({redact_url(url)}): {exc!r}. "
            f"Possible proxy/SSL issue — do not retry silently."
        ) from exc

    response.raise_for_status()
    body = response.content
    sha = hashlib.sha256(body).hexdigest()

    if is_unchanged(raw_path, sha):
        log.info("fetch.%s.skip_unchanged file=%s sha=%s", source, filename, sha[:12])
        manifest_path = raw_path.parent / f"{raw_path.name}.manifest.json"
        return FetchResult(
            source=source,
            filename=filename,
            url=redact_url(url),
            fetched_at=datetime.now(tz=timezone.utc).isoformat(),
            bytes_written=len(body),
            sha256=sha,
            raw_path=raw_path,
            manifest_path=manifest_path,
            skipped=True,
        )

    raw_path.write_bytes(body)
    fetched_at = datetime.now(tz=timezone.utc).isoformat()
    manifest_path = write_manifest(
        source=source,
        filename=filename,
        url=url,
        fetched_at=fetched_at,
        raw_path=raw_path,
        sha256=sha,
        bytes_written=len(body),
        license=license,
        extra=extra_manifest,
    )

    log.info("fetch.%s.done file=%s bytes=%d sha=%s", source, filename, len(body), sha[:12])

    if delay_ms > 0:
        time.sleep(delay_ms / 1000)

    return FetchResult(
        source=source,
        filename=filename,
        # Redacted: callers print this, and FetchResult is not a secret carrier.
        url=redact_url(url),
        fetched_at=fetched_at,
        bytes_written=len(body),
        sha256=sha,
        raw_path=raw_path,
        manifest_path=manifest_path,
    )

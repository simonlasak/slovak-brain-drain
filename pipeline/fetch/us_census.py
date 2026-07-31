"""
Fetch module for US Census American Community Survey (ACS) tables.

WHY THIS SOURCE. Section 3's subject is how the diaspora's size changes with the
definition of "Slovak". The United States is the strongest single case, because
the three definitions diverge further there than anywhere else:

    B05006  place of birth        Slovak-born residents, order 10^4
    B04006  ancestry              people claiming Slovak ancestry, order 10^5

The gap is roughly an order of magnitude, and it is not an error in either table:
they measure different things. Birth counts migrants; ancestry counts descent,
including the great-grandchildren of pre-1914 emigrants who have never held a
Slovak passport. No other destination makes the definitional point so cleanly.

CREDENTIALS. The API key is read from the CENSUS_API_KEY environment variable,
which is loaded from the untracked .env file. It is never hardcoded, never logged,
and never written into a manifest. A missing key fails immediately with an
actionable message rather than proceeding: the API answers keyless requests with
an HTML error page, which a JSON parser then fails on with an unrelated error
several steps downstream.

Run:  PYTHONPATH=. .venv/bin/python -m pipeline.fetch.us_census
"""
from __future__ import annotations

import json
import logging
import os
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

ACS_BASE = "https://api.census.gov/data"
ACS_YEAR = 2023
ACS_DATASET = "acs/acs5"

# The two tables that make the definitional contrast. Group queries return every
# line of the table, so the transform can pick the Slovak line without a second
# request.
TABLES = {
    "B05006": "Place of birth for the foreign-born population",
    "B04006": "People reporting ancestry",
}

ENV_KEY = "CENSUS_API_KEY"


def _load_dotenv(path: Path) -> None:
    """Populate os.environ from a .env file without adding a dependency.

    Only sets names that are not already in the environment, so a real
    environment variable always wins over the file.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        value = value.strip().strip('"').strip("'")
        if name and value and name not in os.environ:
            os.environ[name] = value


def get_api_key() -> str:
    """Return the Census API key, or fail with an actionable message.

    Never logs the value. The check exists because the API responds to an absent
    or invalid key with an HTML error page rather than a JSON error, so the
    failure otherwise surfaces as a parse error in an unrelated place.
    """
    _load_dotenv(REPO_ROOT / ".env")
    key = os.environ.get(ENV_KEY, "").strip()
    if not key:
        raise RuntimeError(
            f"{ENV_KEY} is not set. The US Census API returns an HTML error page "
            "rather than JSON when the key is missing, so this fails here instead "
            "of as a confusing parse error later.\n"
            f"  Add it to {REPO_ROOT / '.env'} as {ENV_KEY}=<key>\n"
            "  Request a free key at https://api.census.gov/data/key_signup.html\n"
            "  .env is gitignored; never commit the key or paste it into a prompt."
        )
    return key


def _redact(text: str, secret: str) -> str:
    """Remove the key from anything that might be logged or written to disk."""
    return text.replace(secret, "<CENSUS_API_KEY>") if secret else text


def fetch_us_census(out_dir: Path | None = None) -> list[FetchResult]:
    setup_logging("us_census")
    cfg = load_config()
    delay_ms = cfg.get("http", {}).get("delay_ms", 200)

    key = get_api_key()

    # httpx logs the full request URL at INFO, including the key, and that log is
    # written to pipeline/logs/. The directory is gitignored, so nothing reaches
    # the repo, but a key should not sit in plaintext on disk either. Silence the
    # request logger for the duration; _base already logs a redacted URL.
    httpx_logger = logging.getLogger("httpx")
    prior_level = httpx_logger.level
    httpx_logger.setLevel(logging.WARNING)

    out_dir = out_dir or REPO_ROOT / cfg["paths"]["raw"] / "us_census"
    results: list[FetchResult] = []

    try:
        results = _fetch_tables(cfg, out_dir, key, delay_ms)
    finally:
        httpx_logger.setLevel(prior_level)
    return results


def _fetch_tables(cfg: dict, out_dir: Path, key: str, delay_ms: int) -> list[FetchResult]:
    results: list[FetchResult] = []
    with make_client(cfg, timeout=120) as client:
        for table, title in TABLES.items():
            url = (
                f"{ACS_BASE}/{ACS_YEAR}/{ACS_DATASET}"
                f"?get=group({table})&for=us:1&key={key}"
            )
            raw_path = out_dir / f"{table}_{ACS_YEAR}.json"
            try:
                result = fetch_and_save(
                    url=url,
                    raw_path=raw_path,
                    source="us_census_acs",
                    license="public domain (US federal government)",
                    client=client,
                    # The URL carries the key, so the manifest records a redacted
                    # form. A manifest is committed; a key must never be.
                    extra_manifest={
                        "dataset": f"{ACS_DATASET} {ACS_YEAR}",
                        "table": table,
                        "title": title,
                        "url_redacted": _redact(url, key),
                    },
                    delay_ms=delay_ms,
                )
                results.append(result)
                log.info("us_census.fetched table=%s bytes=%d", table, result.bytes_written)
            except Exception as exc:
                # Redact before logging: an httpx error can echo the request URL.
                raise RuntimeError(
                    f"us_census: fetching {table} failed: "
                    f"{_redact(str(exc), key)}"
                ) from None

            # The API returns HTML on an auth failure with a 200 in some cases, so
            # verify the payload is the JSON array we expect rather than trusting
            # the status code.
            text = raw_path.read_text(encoding="utf-8")[:200].lstrip()
            if not text.startswith("["):
                raw_path.unlink(missing_ok=True)
                raise RuntimeError(
                    f"us_census: {table} did not return JSON. The first bytes were:\n"
                    f"  {_redact(text[:120], key)}\n"
                    f"This usually means {ENV_KEY} is invalid or rate-limited. The "
                    "partial file has been deleted rather than left for the "
                    "transform to trip over."
                )

    return results


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    try:
        res = fetch_us_census()
    except RuntimeError as exc:
        print(f"\n{exc}\n", file=sys.stderr)
        sys.exit(1)
    print()
    print("US CENSUS ACS")
    print("=" * 60)
    for r in res:
        print(f"  {r.filename}: {r.bytes_written:,} bytes")

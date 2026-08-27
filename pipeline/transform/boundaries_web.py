"""Optimise the boundary files for delivery to the browser.

    .venv/bin/python -m pipeline.transform.boundaries_web

WHY THIS EXISTS. The three GeoJSON files the maps draw were being copied into
frontend/public/data/ byte-identical to what the fetchers pulled down, carrying
whatever the upstream publisher happened to emit. That made sk_okresy.geojson
1.28 MB and, once DuckDB came out of the browser, the single largest asset on the
site by a wide margin: /internal transferred more geometry than everything else
on the page combined.

Two things were being shipped for nothing.

COORDINATE PRECISION. The upstream files carry up to 15 decimal places, which is
sub-nanometre. Five decimals is about 1.1 m at this latitude. Slovakia is roughly
430 km wide and the map renders about 900 px across, so one pixel is about 480 m:
five decimals is already some 400 times finer than a pixel. Everything past it is
bytes describing detail no screen can address.

Rounding is safe for shared borders specifically because it is deterministic.
Neighbouring districts store the same coordinates along a shared edge, and equal
inputs round to equal outputs, so edges that met before still meet exactly.

UNUSED PROPERTIES. cz_kraje.geojson shipped 17 attribute fields per feature, of
which the frontend reads two. sk_okresy shipped Shape_Leng, Shape_Area and
VYMERA_ha, which nothing reads at all.

WHAT THIS DELIBERATELY DOES NOT DO: simplify geometry. Dropping vertices with
Visvalingam or Douglas-Peucker would save more, but it moves borders, and doing it
without topology awareness opens gaps between neighbours. That needs mapshaper and
a visual check, so it is left as separate work. Everything here is invisible at
render scale.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger(__name__)

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "data" / "raw" / "boundaries"
PROCESSED = REPO / "data" / "processed"
OUT_DIR = REPO / "frontend" / "public" / "data"

# Five decimal places, about 1.1 m. See the module docstring for why that is far
# below one rendered pixel.
PRECISION = 5

# Only the properties the frontend actually reads, with the reader named so a
# future reduction is checkable rather than a guess. Anything not listed is
# dropped; anything listed and missing is an error, because a silently absent
# property means a map that cannot key its data to its shapes.
KEEP = {
    "sk_okresy.geojson": {
        "source": RAW / "sk_okresy.geojson",
        # IDN3 keys the district to a ŠÚ SR code via IDN3_TO_SK; NM3 is the
        # tooltip name. MapVariantA.tsx reads both.
        "props": ("IDN3", "NM3"),
    },
    "cz_kraje.geojson": {
        "source": RAW / "cz_kraje.geojson",
        # CorridorMap.tsx reads NUTS_ID to key the region and NUTS_NAME for the
        # tooltip, falling back to the id. The other 15 Eurostat attributes
        # (MOUNT_TYPE, NAME_FREN, EFTA_STAT and so on) are unread.
        "props": ("NUTS_ID", "NUTS_NAME"),
    },
    "world_countries.geojson": {
        # Already transformed from TopoJSON by boundaries_world.py, and already
        # lean at three properties. Included for the coordinate rounding.
        "source": PROCESSED / "boundaries_world.geojson",
        "props": ("iso3", "m49", "name"),
    },
}


def round_coords(coords, ndigits: int):
    """Round every coordinate pair, then drop points the rounding made adjacent.

    Rounding can collapse two nearly identical vertices onto each other, which
    leaves a zero-length segment. Those are removed, but a ring must keep at
    least four points and must stay closed, so the first point is re-appended if
    de-duplication ate the closing one.
    """
    if isinstance(coords[0], (int, float)):
        return [round(float(c), ndigits) for c in coords]

    if isinstance(coords[0][0], (int, float)):
        # A ring or line: a flat list of points.
        pts = [[round(float(x), ndigits) for x in pt] for pt in coords]
        deduped = [pts[0]]
        for pt in pts[1:]:
            if pt != deduped[-1]:
                deduped.append(pt)
        was_closed = pts[0] == pts[-1]
        if was_closed and deduped[0] != deduped[-1]:
            deduped.append(deduped[0])
        # A closed ring needs 4 points (3 distinct plus the repeat). If rounding
        # dropped it below that, keep the unrounded ring rather than emit an
        # invalid polygon.
        if was_closed and len(deduped) < 4:
            return pts
        return deduped

    return [round_coords(c, ndigits) for c in coords]


def count_points(coords) -> int:
    if isinstance(coords[0], (int, float)):
        return 1
    return sum(count_points(c) for c in coords)


def run() -> list[tuple[str, int, int, int, int]]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for name, spec in KEEP.items():
        src: Path = spec["source"]
        if not src.exists():
            raise FileNotFoundError(
                f"{src} is missing. Run pipeline.fetch.boundaries and "
                f"pipeline.transform.boundaries_world first."
            )

        gj = json.loads(src.read_text(encoding="utf-8"))
        if gj.get("type") != "FeatureCollection":
            raise ValueError(f"{name}: expected a FeatureCollection, got {gj.get('type')}")

        before_pts = 0
        after_pts = 0
        for feat in gj["features"]:
            props = feat.get("properties") or {}
            missing = [p for p in spec["props"] if p not in props]
            if missing:
                raise ValueError(
                    f"{name}: feature is missing {missing}, which the frontend reads. "
                    f"Upstream schema changed; fix KEEP rather than dropping it."
                )
            feat["properties"] = {p: props[p] for p in spec["props"]}

            geom = feat.get("geometry")
            if not geom or not geom.get("coordinates"):
                # Malta and Liechtenstein have no polygon at 110m; the world file
                # already documents that. Leave such features alone.
                continue
            before_pts += count_points(geom["coordinates"])
            geom["coordinates"] = round_coords(geom["coordinates"], PRECISION)
            after_pts += count_points(geom["coordinates"])

        out = OUT_DIR / name
        before_bytes = out.stat().st_size if out.exists() else src.stat().st_size
        # Compact separators: the pretty-printed whitespace was itself a
        # measurable share of these files.
        out.write_text(
            json.dumps(gj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        after_bytes = out.stat().st_size
        results.append((name, before_bytes, after_bytes, before_pts, after_pts))
        log.info("%s: %d -> %d bytes", name, before_bytes, after_bytes)

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    rows = run()
    print()
    tb = ta = 0
    for name, b, a, bp, ap in rows:
        tb += b
        ta += a
        pct = 100 * (1 - a / b)
        dropped = f", {bp - ap} points merged" if bp != ap else ""
        print(f"  {name:26s} {b / 1024:8.1f} KB -> {a / 1024:7.1f} KB  ({pct:4.1f}% smaller{dropped})")
    print(f"\n  total {tb / 1024:.1f} KB -> {ta / 1024:.1f} KB, saving {(tb - ta) / 1024:.1f} KB")

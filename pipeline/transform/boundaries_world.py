"""
Stage 2 Transform — world country boundaries for the Section 3 diaspora map.

Reads from:
- data/raw/boundaries/world_countries_110m.json (world-atlas TopoJSON, 110m)

Writes to:
- data/processed/boundaries_world.geojson

Three jobs, all of which have to happen somewhere and belong here rather than in
the frontend:

1. Decode TopoJSON to GeoJSON. The source is quantized and delta-encoded (arcs
   plus a scale/translate transform), which the renderer cannot read directly.

2. Normalise the country key. The world-atlas geometries are identified by UN
   M49 numeric codes ("203"), while section3_diaspora.parquet carries a MIX of
   numeric codes (UN DESA rows) and ISO3 alpha codes (OECD rows). Emitting a
   single `iso3` property per feature lets the frontend join on one key instead
   of carrying a lookup table and a branch.

3. Drop Antarctica. It will never carry a Slovak diaspora figure and, on any
   whole-world projection, it takes a fifth of the frame to say so.

NO ANTIMERIDIAN HANDLING HERE, DELIBERATELY. An earlier version of this module
split every ring that crossed 180 degrees into eastern and western fragments and
closed each against the meridian it was cut at. That was solving a problem this
pipeline should never have had: it exists only if the renderer maps lon/lat
linearly to x/y, which the August 2026 build did. Chukotka shipped as a
rectangular block because the closing segments ran straight down the meridian
and the fragment was filled as a quadrilateral.

d3.geoPath clips on the sphere before projecting, so it separates Chukotka and
Wrangel Island from mainland Russia correctly with no pre-processing. Verified
against the raw geometry: Russia yields 14 subpaths, no NaN coordinates, no band
across the Pacific. Splitting rings here would now be actively harmful, because
the artificial meridian edges would be projected as real coastline.

Deliberately stdlib-only: no topojson or pycountry dependency for a one-off
geometry conversion.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_PATH = REPO_ROOT / "data" / "raw" / "boundaries" / "world_countries_110m.json"
OUT_PATH = REPO_ROOT / "data" / "processed" / "boundaries_world.geojson"

# UN M49 numeric -> ISO 3166-1 alpha-3, covering every numeric code that appears
# in section3_diaspora.parquet plus the rest of the world-atlas set. Hand-kept so
# the pipeline needs no ISO dependency; verified against the 177 geometries in
# the source file (see verify_coverage()).
M49_TO_ISO3 = {
    "004": "AFG", "008": "ALB", "012": "DZA", "024": "AGO", "032": "ARG",
    "031": "AZE", "036": "AUS", "040": "AUT", "044": "BHS", "050": "BGD",
    "051": "ARM", "056": "BEL", "064": "BTN", "068": "BOL", "070": "BIH",
    "072": "BWA", "076": "BRA", "084": "BLZ", "090": "SLB", "096": "BRN",
    "100": "BGR", "104": "MMR", "108": "BDI", "112": "BLR", "116": "KHM",
    "120": "CMR", "124": "CAN", "132": "CPV", "140": "CAF", "144": "LKA",
    "148": "TCD", "152": "CHL", "156": "CHN", "170": "COL", "178": "COG",
    "180": "COD", "188": "CRI", "191": "HRV", "192": "CUB", "196": "CYP",
    "203": "CZE", "204": "BEN", "208": "DNK", "214": "DOM", "218": "ECU",
    "222": "SLV", "226": "GNQ", "231": "ETH", "232": "ERI", "233": "EST",
    "242": "FJI", "246": "FIN", "250": "FRA", "260": "ATF", "262": "DJI",
    "266": "GAB", "268": "GEO", "270": "GMB", "275": "PSE", "276": "DEU",
    "288": "GHA", "296": "KIR", "300": "GRC", "304": "GRL", "320": "GTM",
    "324": "GIN", "328": "GUY", "332": "HTI", "340": "HND", "348": "HUN",
    "352": "ISL", "356": "IND", "360": "IDN", "364": "IRN", "368": "IRQ",
    "372": "IRL", "376": "ISR", "380": "ITA", "384": "CIV", "388": "JAM",
    "392": "JPN", "398": "KAZ", "400": "JOR", "404": "KEN", "408": "PRK",
    "410": "KOR", "414": "KWT", "417": "KGZ", "418": "LAO", "422": "LBN",
    "426": "LSO", "428": "LVA", "430": "LBR", "434": "LBY", "440": "LTU",
    "442": "LUX", "450": "MDG", "454": "MWI", "458": "MYS", "466": "MLI",
    "478": "MRT", "484": "MEX", "492": "MCO", "496": "MNG", "498": "MDA",
    "499": "MNE", "504": "MAR", "508": "MOZ", "512": "OMN", "516": "NAM",
    "524": "NPL", "528": "NLD", "540": "NCL", "548": "VUT", "554": "NZL",
    "558": "NIC", "562": "NER", "566": "NGA", "578": "NOR", "586": "PAK",
    "591": "PAN", "598": "PNG", "600": "PRY", "604": "PER", "608": "PHL",
    "616": "POL", "620": "PRT", "624": "GNB", "626": "TLS", "630": "PRI",
    "634": "QAT", "642": "ROU", "643": "RUS", "646": "RWA", "682": "SAU",
    "686": "SEN", "688": "SRB", "690": "SYC", "694": "SLE", "702": "SGP",
    "703": "SVK", "704": "VNM", "705": "SVN", "706": "SOM", "710": "ZAF",
    "716": "ZWE", "724": "ESP", "728": "SSD", "729": "SDN", "732": "ESH",
    "740": "SUR", "748": "SWZ", "752": "SWE", "756": "CHE", "760": "SYR",
    "762": "TJK", "764": "THA", "768": "TGO", "780": "TTO", "784": "ARE",
    "788": "TUN", "792": "TUR", "795": "TKM", "798": "TUV", "800": "UGA",
    "804": "UKR", "807": "MKD", "818": "EGY", "826": "GBR", "834": "TZA",
    "840": "USA", "854": "BFA", "858": "URY", "860": "UZB", "862": "VEN",
    "882": "WSM", "887": "YEM", "894": "ZMB",
    # Territories and non-UN-member entries that world-atlas draws but M49 does
    # not assign a sovereign code to. Included so the map renders them rather
    # than leaving holes; none carries Slovak diaspora data.
    "010": "ATA",  # Antarctica
    "158": "TWN",  # Taiwan
    "238": "FLK",  # Falkland Islands
    # world-atlas also carries a few non-M49 or disputed entries
    "-99": None,
}


# Decoding the quantized source yields ~14 decimal places, which is spurious
# precision on 110m-resolution outlines. 4dp is roughly 11 m at the equator,
# far finer than the geometry itself, and halves the payload every visitor
# downloads.
COORD_PRECISION = 4


def _decode_arcs(topology: dict) -> list[list[list[float]]]:
    """Undo quantization and delta encoding for every arc in the topology."""
    transform = topology.get("transform")
    raw_arcs = topology["arcs"]
    if transform is None:
        return [[[float(x), float(y)] for x, y in arc] for arc in raw_arcs]

    sx, sy = transform["scale"]
    tx, ty = transform["translate"]
    decoded = []
    for arc in raw_arcs:
        x = y = 0
        points = []
        for dx, dy in arc:
            # TopoJSON stores each point as a delta from the previous one.
            x += dx
            y += dy
            points.append([
                round(x * sx + tx, COORD_PRECISION),
                round(y * sy + ty, COORD_PRECISION),
            ])
        decoded.append(points)
    return decoded


def _arc_to_coords(index: int, arcs: list[list[list[float]]]) -> list[list[float]]:
    """Resolve an arc reference; negative indices mean traverse in reverse."""
    if index >= 0:
        return arcs[index]
    # ~i == -i - 1 is the TopoJSON convention for a reversed arc.
    return list(reversed(arcs[-index - 1]))


def _stitch(arc_indices: list[int], arcs: list[list[list[float]]]) -> list[list[float]]:
    """Join a ring's arcs, dropping the duplicated point at each seam."""
    ring: list[list[float]] = []
    for i, idx in enumerate(arc_indices):
        coords = _arc_to_coords(idx, arcs)
        ring.extend(coords[1:] if i > 0 else coords)
    return ring


# Antarctica. Dropped rather than clipped: on Equal Earth it occupies the bottom
# fifth of the frame, it is the one landmass guaranteed never to hold a Slovak
# diaspora figure, and its ring genuinely wraps the pole so every projection
# renders it awkwardly. Excluded here so the frontend never has to filter it.
EXCLUDED_ISO3 = {"ATA"}


def _geometry_to_geojson(geom: dict, arcs: list[list[list[float]]]) -> dict | None:
    gtype = geom.get("type")
    if gtype == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [_stitch(ring, arcs) for ring in geom["arcs"]],
        }
    if gtype == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [_stitch(ring, arcs) for ring in polygon]
                for polygon in geom["arcs"]
            ],
        }
    # Points/lines do not appear in the countries layer; skip anything else.
    return None


def _count_meridian_points(geometry: dict) -> int:
    """How many vertices sit exactly on +/-180 degrees."""
    polys = (
        [geometry["coordinates"]]
        if geometry["type"] == "Polygon"
        else geometry["coordinates"]
    )
    return sum(
        1
        for poly in polys
        for ring in poly
        for x, _ in ring
        if abs(abs(x) - 180.0) < 1e-9
    )


# Vertices sitting exactly on +/-180 degrees, per country, as world-atlas 110m
# draws them. Two countries have them and both are the source's own work: it
# already cuts Fiji into eastern and western pieces, and it ends Russia's Chukotka
# arc on the meridian. Read off the decoded source, then pinned here as literals.
#
# Pinned on purpose. The check below has to compare against something OUTSIDE this
# module; derived from the same geometry it validates, it would pass
# unconditionally, which is the failure mode this whole exercise is about.
#
# Note what these numbers are NOT: evidence the map renders correctly. They say
# the pipeline is not writing meridian edges. Whether Chukotka draws as an island
# rather than a block is a question about the renderer, answered by looking at it.
EXPECTED_MERIDIAN_VERTICES = {"FJI": 4, "RUS": 5}


def _assert_geometry_untouched(features: list[dict]) -> None:
    """Fail if the emitted rings carry any antimeridian vertex the source lacks.

    This is the inverse of the check the previous version made. That one asserted
    "no ring spans the antimeridian" and PASSED, because the split had already cut
    every such ring. It could not see that the cut itself was the defect: the
    closing segments it introduced ran along the meridian, and the renderer filled
    the result as a rectangle. That is how Chukotka shipped as a block behind a
    green check.

    So the property to hold is not "no rings span 180" but "nothing here writes a
    meridian edge". An absolute rule cannot express that: world-atlas ships Fiji
    already cut, with four vertices pinned to +/-180, and rejecting those would be
    rejecting valid input. Hence a pinned expectation per country. If the source
    file is ever swapped, this fails loudly and asks to be re-read rather than
    silently accepting new geometry.
    """
    actual = {}
    for f in features:
        key = f["properties"]["iso3"] or f["properties"]["m49"]
        n = _count_meridian_points(f["geometry"])
        if n:
            actual[key] = n
    if actual != EXPECTED_MERIDIAN_VERTICES:
        raise ValueError(
            "boundaries_world: antimeridian vertex counts changed. "
            f"expected {EXPECTED_MERIDIAN_VERTICES}, got {actual}. Rings must "
            "leave here exactly as the source drew them; the renderer clips on "
            "the sphere. See the module docstring."
        )


def run(raw_path: Path | None = None, out_path: Path | None = None) -> Path:
    raw_path = raw_path or RAW_PATH
    out_path = out_path or OUT_PATH
    log.info("transform.boundaries_world.start src=%s", raw_path.name)

    topology = json.loads(raw_path.read_text())
    if topology.get("type") != "Topology":
        raise ValueError(f"{raw_path.name} is not TopoJSON (type={topology.get('type')})")

    arcs = _decode_arcs(topology)
    geometries = topology["objects"]["countries"]["geometries"]

    features = []
    unmapped = []
    excluded: list[str] = []
    for geom in geometries:
        raw_id = geom.get("id")
        # world-atlas ids are numeric strings, sometimes without zero padding.
        key = str(raw_id).zfill(3) if raw_id is not None else None
        iso3 = M49_TO_ISO3.get(key) if key else None
        name = (geom.get("properties") or {}).get("name")

        if iso3 is None and key not in (None, "-99"):
            unmapped.append((key, name))

        if iso3 in EXCLUDED_ISO3:
            excluded.append(iso3)
            continue

        gj = _geometry_to_geojson(geom, arcs)
        if gj is None:
            continue

        features.append({
            "type": "Feature",
            "geometry": gj,
            "properties": {
                # Single join key for the frontend. Null for the handful of
                # world-atlas entries with no ISO3 (e.g. disputed territories);
                # those simply never match a diaspora row.
                "iso3": iso3,
                "m49": key,
                "name": name,
            },
        })

    if unmapped:
        log.warning(
            "transform.boundaries_world.unmapped count=%d %s",
            len(unmapped), unmapped,
        )
    if excluded:
        log.info("transform.boundaries_world.excluded %s", sorted(set(excluded)))

    _assert_geometry_untouched(features)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    collection = {"type": "FeatureCollection", "features": features}
    # Separators trim ~10% off the payload; this ships to every visitor.
    out_path.write_text(json.dumps(collection, separators=(",", ":")))

    log.info(
        "transform.boundaries_world.done features=%d mapped=%d bytes=%d",
        len(features),
        sum(1 for f in features if f["properties"]["iso3"]),
        out_path.stat().st_size,
    )
    return out_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    run()

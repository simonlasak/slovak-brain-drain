"""
Mirror comparison: how far Slovak registered emigration falls short.

THE QUESTION. Slovakia records emigration through municipal deregistration,
which carries no penalty for skipping and no benefit for doing. If most people
who leave never deregister, the registered series is a floor rather than a
count. Destination countries have the opposite incentive structure: residence
registration gates healthcare, tax status and employment, so their counts of
resident Slovaks are comparatively complete. Comparing the two gives a lower
bound on how much Slovak registration misses.

THE METHOD. For a fixed panel of destination countries, over a fixed window:

    implied departures = rise in destination-reported Slovak citizens
                       + Slovaks naturalising in those countries

The naturalisation term matters. A Slovak who takes German citizenship leaves
the German count of Slovak citizens while remaining in Germany, so without that
term the stock change understates arrivals by exactly the number who naturalised.

That total is then compared against what SU SR recorded leaving over the same
window (om7011rr IN010079, national level only, since below the national level
the indicator counts moves out of the district including moves to other Slovak
districts).

WHY THE RESULT IS A FLOOR, NOT AN ESTIMATE. The panel omits several large Slovak
destinations, most importantly the United Kingdom (absent from Eurostat's
citizenship series after Brexit), Ireland, Spain, Switzerland and France. The
SU SR denominator covers departures to ALL destinations. So the numerator is
missing destinations that the denominator includes, which biases the ratio DOWN.
The true undercount is worse than this computes.

WHAT THIS IS NOT. It is not a count of Slovaks abroad, and it is not a net
migration figure. It measures one thing: the gap between two registers.

Run:  PYTHONPATH=. .venv/bin/python -m pipeline.analysis.mirror_comparison
"""
from __future__ import annotations

import gzip
import json
import logging
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_EUROSTAT = REPO_ROOT / "data" / "raw" / "eurostat"
PROCESSED = REPO_ROOT / "data" / "processed"
OUT_PATH = PROCESSED / "mirror_comparison.json"

# Eurostat codes Slovak citizenship as "SK" in both series.
SLOVAK_CITIZEN = "SK"

# The panel. Every country here reports Slovak citizens in migr_pop1ctz for the
# WHOLE window with no gap, which is what makes the endpoints comparable. A
# country with a hole in the middle would contribute a stock change measured over
# a different window from the others.
#
# Deliberately excluded and why:
#   GB  no post-Brexit Eurostat citizenship data. The single biggest omission.
#   IE  series too sparse to give clean endpoints.
#   ES  reports by country of birth more completely than by citizenship.
#   CH  non-EU reporting, gaps in the Slovak breakdown.
#   FR  Slovak breakdown not published for the full window.
PANEL = [
    "AT", "BE", "CZ", "DE", "FI", "HU", "IS", "IT",
    "LT", "LV", "NL", "NO", "RO", "SE", "SI",
]

# The window. 2013 is the first year the full panel reports without gaps.
YEAR_START = 2013
YEAR_END = 2025

# migr_pop1ctz stock is measured on 1 January. A stock dated 1 Jan 2013 reflects
# arrivals through 2012, so the flow window that produced the change from
# 1 Jan YEAR_START to 1 Jan YEAR_END is the calendar years YEAR_START..YEAR_END-1.
# The naturalisation flows and the SU SR departure flows must use that same
# window or the comparison mixes periods.
FLOW_YEAR_START = YEAR_START
FLOW_YEAR_END = YEAR_END - 1


def _parse_eurostat_tsv(path: Path) -> pl.DataFrame:
    """Read a Eurostat bulk TSV into long form.

    The bulk format puts the dimensions comma-separated in column 0 and one
    column per year. Values carry observation flags appended to the number
    (`4 b`, `12 p`, `: ` for missing), which must be stripped before casting or
    every flagged observation silently becomes null.
    """
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        header = fh.readline().rstrip("\n").split("\t")
        dim_names = header[0].split("\\")[0].split(",")
        years = [int(h.strip()) for h in header[1:] if h.strip()]

        records: list[dict] = []
        for line in fh:
            if not line.strip():
                continue
            cells = line.rstrip("\n").split("\t")
            dims = cells[0].split(",")
            if len(dims) != len(dim_names):
                continue
            row_dims = dict(zip(dim_names, dims))
            for year, raw in zip(years, cells[1:]):
                token = raw.strip()
                if not token or token.startswith(":"):
                    continue
                # Strip trailing observation flags: "4 b" -> "4".
                number = token.split(" ")[0].replace(",", "")
                if not number or number == ":":
                    continue
                try:
                    value = float(number)
                except ValueError:
                    continue
                records.append({**row_dims, "year": year, "value": value})

    if not records:
        raise ValueError(f"mirror: parsed no observations from {path.name}")
    return pl.DataFrame(records)


def load_slovak_citizen_stock() -> pl.DataFrame:
    """Slovak citizens resident in each reporting country, both sexes, all ages."""
    path = RAW_EUROSTAT / "migr_pop1ctz.tsv.gz"
    df = _parse_eurostat_tsv(path)
    out = df.filter(
        (pl.col("citizen") == SLOVAK_CITIZEN)
        & (pl.col("age") == "TOTAL")
        & (pl.col("sex") == "T")
        & (pl.col("unit") == "NR")
    ).select("geo", "year", "value")
    # One observation per country-year, or the endpoints are ambiguous.
    dup = out.group_by(["geo", "year"]).len().filter(pl.col("len") > 1)
    if len(dup):
        raise ValueError(
            f"mirror: migr_pop1ctz has {len(dup)} duplicated geo-year keys after "
            "filtering to Slovak citizens, both sexes, all ages, persons. A "
            "dimension is unconstrained."
        )
    return out


def load_slovak_naturalisations() -> pl.DataFrame:
    """Slovaks acquiring the citizenship of each reporting country, per year."""
    path = RAW_EUROSTAT / "migr_acq.tsv.gz"
    df = _parse_eurostat_tsv(path)
    out = df.filter(
        (pl.col("citizen") == SLOVAK_CITIZEN)
        & (pl.col("age") == "TOTAL")
        & (pl.col("sex") == "T")
        & (pl.col("unit") == "NR")
        & (pl.col("agedef") == "COMPLET")
    ).select("geo", "year", "value")
    dup = out.group_by(["geo", "year"]).len().filter(pl.col("len") > 1)
    if len(dup):
        raise ValueError(
            f"mirror: migr_acq has {len(dup)} duplicated geo-year keys after "
            "filtering. A dimension is unconstrained."
        )
    return out


def load_susr_registered_departures() -> pl.DataFrame:
    """SU SR registered emigration, NATIONAL level only.

    Below the national level intl_out counts moves out of the unit including
    moves to other Slovak districts, so it does not aggregate to a national
    emigration figure. geo_level='nation' is the only usable slice.
    """
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")
    out = df.filter(
        (pl.col("metric") == "intl_out")
        & (pl.col("geo_level") == "nation")
        & (pl.col("age_bracket") == "all")
        & (pl.col("sex") == "all")
        & (pl.col("education") == "all")
    ).select("year", "value").sort("year")
    if len(out) == 0:
        raise ValueError(
            "mirror: no national intl_out rows in section1_internal.parquet. "
            "Run the section1 transform first."
        )
    return out


def _stock_change(stock: pl.DataFrame, panel: list[str], y0: int, y1: int) -> dict:
    """Rise in reported Slovak citizens across a panel between two 1-January dates."""
    sub = stock.filter(pl.col("geo").is_in(panel) & pl.col("year").is_in([y0, y1]))
    wide = sub.pivot(on="year", index="geo", values="value")
    have = [c for c in (str(y0), str(y1)) if c in wide.columns]
    if len(have) < 2:
        raise ValueError(f"mirror: panel lacks endpoints {y0}/{y1}")
    complete = wide.drop_nulls()
    missing = sorted(set(panel) - set(complete["geo"].to_list()))
    per_country = {
        r["geo"]: r[str(y1)] - r[str(y0)]
        for r in complete.iter_rows(named=True)
    }
    return {
        "countries": sorted(per_country),
        "missing": missing,
        "start_total": float(complete[str(y0)].sum()),
        "end_total": float(complete[str(y1)].sum()),
        "change": float(sum(per_country.values())),
        "per_country": {k: float(v) for k, v in sorted(per_country.items())},
    }


def _naturalisation_total(nat: pl.DataFrame, panel: list[str], y0: int, y1: int) -> dict:
    """Slovaks naturalising across a panel over the flow years [y0, y1]."""
    sub = nat.filter(
        pl.col("geo").is_in(panel) & pl.col("year").is_between(y0, y1)
    )
    per_country = {
        r["geo"]: float(r["value"])
        for r in sub.group_by("geo").agg(pl.col("value").sum()).iter_rows(named=True)
    }
    reported_years = {
        r["geo"]: int(r["n"])
        for r in sub.group_by("geo").agg(pl.len().alias("n")).iter_rows(named=True)
    }
    expected = y1 - y0 + 1
    partial = sorted(g for g, n in reported_years.items() if n < expected)
    return {
        "total": float(sum(per_country.values())),
        "per_country": dict(sorted(per_country.items())),
        "countries_with_partial_years": partial,
        "expected_years_per_country": expected,
    }


def compute(panel: list[str] | None = None,
            year_start: int = YEAR_START,
            year_end: int = YEAR_END) -> dict:
    """Run one specification of the mirror comparison."""
    panel = panel or PANEL
    stock = load_slovak_citizen_stock()
    nat = load_slovak_naturalisations()
    susr = load_susr_registered_departures()

    flow_start, flow_end = year_start, year_end - 1
    st = _stock_change(stock, panel, year_start, year_end)
    nt = _naturalisation_total(nat, panel, flow_start, flow_end)

    implied = st["change"] + nt["total"]
    registered = float(
        susr.filter(pl.col("year").is_between(flow_start, flow_end))["value"].sum()
    )
    ratio = implied / registered if registered else float("nan")

    return {
        "panel": st["countries"],
        "panel_requested": sorted(panel),
        "panel_dropped_for_gaps": st["missing"],
        "stock_window": [year_start, year_end],
        "flow_window": [flow_start, flow_end],
        "stock_start": st["start_total"],
        "stock_end": st["end_total"],
        "stock_change": st["change"],
        "naturalisations": nt["total"],
        "implied_departures": implied,
        "susr_registered_departures": registered,
        "ratio": ratio,
        "stock_change_per_country": st["per_country"],
        "naturalisations_per_country": nt["per_country"],
        "naturalisation_years_incomplete": nt["countries_with_partial_years"],
    }


def specifications() -> list[dict]:
    """Five specifications. The headline is robust only if they agree in range.

    Each varies one choice that a reader could reasonably have made differently,
    so the spread shows how much the result depends on our judgement rather than
    on the data.
    """
    specs = []

    specs.append({
        "name": "headline",
        "description": (
            f"Constant {len(PANEL)}-country panel, {YEAR_START}-{YEAR_END} stock "
            "change plus naturalisations."
        ),
        **compute(),
    })

    # Stock change only. Recompute the derived fields rather than mutating a copy
    # of the headline, so the three stay consistent with each other.
    bare = compute()
    bare["naturalisations"] = 0.0
    bare["naturalisations_per_country"] = {}
    bare["implied_departures"] = bare["stock_change"]
    bare["ratio"] = bare["stock_change"] / bare["susr_registered_departures"]
    specs.append({
        "name": "no_naturalisation_adjustment",
        "description": (
            "Stock change only, ignoring naturalisations. A strict lower bound: "
            "every Slovak who took local citizenship is dropped from the count."
        ),
        **bare,
    })

    specs.append({
        "name": "excluding_czechia",
        "description": (
            "Czechia dropped. It is the largest single destination and reports on "
            "a different basis from the rest, so this tests whether one country "
            "carries the result."
        ),
        **compute(panel=[c for c in PANEL if c != "CZ"]),
    })

    specs.append({
        "name": "shorter_window_stock_2015_2023",
        "description": (
            "Stock endpoints 1 Jan 2015 to 1 Jan 2023, so flows over 2015-2022. "
            "Avoids both the early-window and the most recent provisional years."
        ),
        **compute(year_start=2015, year_end=2023),
    })

    specs.append({
        "name": "top_five_destinations_only",
        "description": (
            "Only the five destinations with the largest Slovak stock. Tests "
            "whether the many small-stock countries are inflating the total."
        ),
        **compute(panel=["CZ", "DE", "AT", "IT", "HU"]),
    })

    return specs


def run() -> dict:
    log.info("mirror.start")
    specs = specifications()
    ratios = [s["ratio"] for s in specs]

    result = {
        "question": (
            "How far short of reality does Slovak registered emigration fall?"
        ),
        "headline_ratio": specs[0]["ratio"],
        "headline_implied": specs[0]["implied_departures"],
        "headline_registered": specs[0]["susr_registered_departures"],
        "ratio_range": [min(ratios), max(ratios)],
        "specifications": specs,
        "caveats": [
            "The ratio is a FLOOR. The panel omits the United Kingdom (no "
            "post-Brexit Eurostat citizenship data), Ireland, Spain, "
            "Switzerland and France, while the SU SR denominator covers "
            "departures to all destinations. Missing destinations in the "
            "numerator bias the ratio down.",
            "Destination stock counts Slovak CITIZENS, not Slovak-born. A "
            "Slovak-born person who never held Slovak citizenship is absent; a "
            "dual national is present.",
            "A rise in reported stock is not the same as arrivals: it nets "
            "deaths and onward moves out of the destination. Both push the "
            "implied figure DOWN, so this also biases the ratio toward the floor.",
            "Destination registration is more complete than Slovak "
            "deregistration but is not a census. Its own undercount is unknown.",
            "SU SR intl_out is usable at the NATIONAL level only. Below that it "
            "counts moves out of the district including moves to other Slovak "
            "districts.",
        ],
        "sources": [
            "Eurostat migr_pop1ctz (population by citizenship), bulk TSV.",
            "Eurostat migr_acq (acquisition of citizenship by former "
            "citizenship), bulk TSV.",
            "SU SR DataCube om7011rr indicator IN010079 (emigrants from "
            "permanent residence), national level.",
        ],
    }

    PROCESSED.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("mirror.done ratio=%.2f path=%s", result["headline_ratio"], OUT_PATH)
    return result


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    res = run()

    print()
    print("MIRROR COMPARISON")
    print("=" * 72)
    h = res["specifications"][0]
    print(f"  panel ({len(h['panel'])}): {', '.join(h['panel'])}")
    if h["panel_dropped_for_gaps"]:
        print(f"  dropped for gaps: {h['panel_dropped_for_gaps']}")
    print(f"  stock window: 1 Jan {h['stock_window'][0]} -> 1 Jan {h['stock_window'][1]}")
    print(f"  flow window:  {h['flow_window'][0]}-{h['flow_window'][1]}")
    print()
    print(f"  Slovak citizens reported, start: {h['stock_start']:>12,.0f}")
    print(f"  Slovak citizens reported, end:   {h['stock_end']:>12,.0f}")
    print(f"  rise in reported stock:          {h['stock_change']:>12,.0f}")
    print(f"  plus naturalisations:            {h['naturalisations']:>12,.0f}")
    print(f"  = implied departures:            {h['implied_departures']:>12,.0f}")
    print(f"  SU SR registered departures:     {h['susr_registered_departures']:>12,.0f}")
    print(f"  RATIO:                           {h['ratio']:>12.2f}x")
    print()
    print("  specifications:")
    for s in res["specifications"]:
        print(f"    {s['name']:<34} {s['ratio']:>6.2f}x  "
              f"(implied {s['implied_departures']:>9,.0f} / "
              f"registered {s['susr_registered_departures']:>8,.0f})")
    print()
    print(f"  range across specifications: {res['ratio_range'][0]:.2f}x to {res['ratio_range'][1]:.2f}x")
    print()
    print("  Every figure above is a FLOOR: the panel omits the UK, IE, ES, CH, FR")
    print("  while the SU SR denominator covers all destinations.")

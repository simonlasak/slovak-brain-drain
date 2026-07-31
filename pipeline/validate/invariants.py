"""
Stage 3: Validate - Cross-source sanity checks.

Runs invariant checks against the processed parquet files and produces an HTML
report at pipeline/validate/report.html with green/yellow/red severity.

A note on what makes a check worth having: an assertion that cannot fail is not
a check. The first version of check_metric_definitions asserted
natural_increase + migr_net = total_change, which SUSR derives inside the same
cube, so it held by construction whatever we named the three metrics. Prefer
assertions that tie a metric to a DIFFERENT indicator, a different geographic
level, or a different publisher.
"""
from __future__ import annotations

import gzip
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = REPO_ROOT / "data" / "processed"
RAW_EUROSTAT = REPO_ROOT / "data" / "raw" / "eurostat"
REPORT_PATH = REPO_ROOT / "pipeline" / "validate" / "report.html"


def _eurostat_sk_emigration() -> dict[int, float]:
    """Total emigration from Slovakia per year, per Eurostat migr_emi1ctz.

    An independent publisher for the same quantity SUSR reports as IN010079 at
    the national level. Returns {} if the file is absent so the caller can report
    that rather than crash.
    """
    path = RAW_EUROSTAT / "migr_emi1ctz.tsv.gz"
    if not path.exists():
        return {}
    out: dict[int, float] = {}
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        header = fh.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        years = [int(h.strip()) for h in header[1:] if h.strip()]
        for line in fh:
            if not line.strip():
                continue
            cells = line.rstrip("\n").split("\t")
            row = dict(zip(dims, cells[0].split(",")))
            if not (row.get("geo") == "SK" and row.get("citizen") == "TOTAL"
                    and row.get("age") == "TOTAL" and row.get("sex") == "T"
                    and row.get("unit") == "NR"):
                continue
            for year, raw in zip(years, cells[1:]):
                token = raw.strip()
                if not token or token.startswith(":"):
                    continue
                number = token.split(" ")[0].replace(",", "")
                try:
                    out[year] = float(number)
                except ValueError:
                    continue
            break
    return out


@dataclass
class CheckResult:
    name: str
    severity: str  # green, yellow, red
    summary: str
    details: list[str] = field(default_factory=list)


def check_population_consistency() -> CheckResult:
    """Sum of okres populations should equal kraj; kraj should equal SR total."""
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")
    pop = df.filter(
        (pl.col("metric") == "population") &
        (pl.col("age_bracket") == "all") &
        (pl.col("education") == "all")
    )

    details = []
    worst = "green"

    for year in range(2004, 2026):
        yr_data = pop.filter(pl.col("year") == year)

        # NUTS-2 oblast totals. SK01..SK04 are oblasti, not kraje; the old
        # length-4 filter on geo_level='kraj' selected them only because the
        # taxonomy conflated the two levels.
        kraj_total = yr_data.filter(pl.col("geo_level") == "oblast")["value"].sum()

        # Okres-level totals
        okres_total = yr_data.filter(pl.col("geo_level") == "okres")["value"].sum()

        # SR total (SK0)
        sr_rows = yr_data.filter(pl.col("geo_code") == "SK0")
        sr_total = sr_rows["value"].sum() if len(sr_rows) > 0 else 0

        if sr_total > 0 and kraj_total > 0:
            pct_diff = abs(kraj_total - sr_total) / sr_total * 100
            if pct_diff > 5:
                details.append(f"{year}: kraj sum ({kraj_total:,.0f}) vs SR ({sr_total:,.0f}) = {pct_diff:.1f}% diff")
                worst = "yellow"

    if not details:
        details.append("All years: kraj sums match SR totals within 5%")

    return CheckResult(
        name="Population consistency (kraj vs SR total)",
        severity=worst,
        summary=f"{len(details)} observations",
        details=details,
    )


def check_population_reconciles() -> CheckResult:
    """pop[Y+1] - pop[Y] == total_change[Y], except at census re-basings.

    REPLACES check_migration_accounting, which reported 11 breaches at the
    national level. Those breaches were an artefact of the check, not of the
    data. Two defects:

    1. OFF BY ONE YEAR. `population` is dated 1 JANUARY, and total_change for
       year Y is the change DURING Y, so it reconciles against
       pop[Y+1] - pop[Y]. The old check compared it against pop[Y] - pop[Y-1],
       i.e. each year's flows against the PREVIOUS year's change. That alone
       produced 9 of the 11 breaches, with residuals as large as 8,638 in years
       where the correctly-aligned identity is exact to the person.
    2. WRONG BIRTH SERIES. It used `births` (IN010054, all births) where SUSR
       computes natural increase from live births (IN010106), a further ~180/yr.

    Correctly aligned, the identity is exact for every year except two, and both
    are real: the 2011 and 2021 census re-basings. SUSR re-anchors the population
    series to each census without restating the flow components, so the residual
    IS the census correction. Those two are reported as yellow, with the size of
    the correction, because they are a documented property of the source that a
    reader of any long time series needs to know about.
    """
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")

    def series(metric: str) -> dict[int, float]:
        f = df.filter(
            (pl.col("metric") == metric)
            & (pl.col("geo_level") == "nation")
            & (pl.col("age_bracket") == "all")
            & (pl.col("education") == "all")
        )
        return {r["year"]: r["value"] for r in f.select("year", "value").iter_rows(named=True)}

    pop = series("population")
    total_change = series("total_change")

    # Years where SUSR re-anchors the population series to a census. The flow
    # components are not restated, so the identity cannot close across them.
    CENSUS_REBASE_YEARS = {2010: 2011, 2020: 2021}

    details: list[str] = []
    worst = "green"
    exact = 0
    unexplained = 0

    for year in sorted(total_change):
        if year not in pop or (year + 1) not in pop:
            continue
        observed = pop[year + 1] - pop[year]
        residual = observed - total_change[year]
        if abs(residual) <= 0.5:
            exact += 1
            continue
        if year in CENSUS_REBASE_YEARS:
            details.append(
                f"{year}->{CENSUS_REBASE_YEARS[year]} census re-basing: population moved "
                f"{observed:+,.0f} but flows explain {total_change[year]:+,.0f}. The "
                f"{residual:+,.0f} residual is the census correction, not a data error."
            )
            if worst == "green":
                worst = "yellow"
            continue
        unexplained += 1
        worst = "red"
        details.append(
            f"{year}: population moved {observed:+,.0f}, total_change says "
            f"{total_change[year]:+,.0f}, residual {residual:+,.0f} and this year is "
            "not a known census re-basing"
        )

    details.insert(
        0,
        f"identity exact to the person for {exact} of {exact + unexplained + len(CENSUS_REBASE_YEARS)} "
        "year transitions at national level",
    )

    return CheckResult(
        name="Population reconciles with total change (census re-basings excepted)",
        severity=worst,
        summary=("PASS: only the 2011 and 2021 census re-basings break the identity"
                 if worst != "red" else
                 f"FAIL: {unexplained} unexplained break(s) in the population identity"),
        details=details,
    )


def check_metric_definitions() -> CheckResult:
    """Tie each named metric to something other than its own siblings.

    Three of the four assertions below are internal cross-checks against a
    DIFFERENT indicator of the same publisher, and one is a transcription check.
    None is an independent measurement of the level: for that, see the mirror
    comparison, where the destination side is reported by other states.

    WHY NOT THE OBVIOUS IDENTITY. natural_increase + migr_net = total_change is
    tautological: SUSR derives all three inside the same cube, so the identity
    holds by construction no matter what we NAME them. Verified directly against
    the raw cube - swapping the labels on any two of the three would leave the
    sum untouched. A check that cannot fail cannot catch the next mislabelling,
    so it is not a check.

    These four assertions can each fail. Each pins one metric to a quantity
    derived from a DIFFERENT indicator or a different source:

    1. natural_increase == live_births - deaths. Ties it to the birth and death
       series. Note it is LIVE births (IN010106), not all births (IN010054);
       the two differ by ~180/yr nationally, which is one of the two reasons
       the old check_migration_accounting carried a permanent residual.
    2. migr_net == migr_in - migr_out. Ties the net series to its own gross
       components rather than to the total.
    3. National migr_out == Eurostat migr_emi1ctz for SK. This is a PROVENANCE
       check, not an accuracy check, and it is the weakest of the four. Eurostat
       does not collect migration data; member states report it, so this series
       IS SUSR's own, redistributed. An exact match therefore proves only that
       our parse of the cube matches what SUSR filed with Eurostat - it inherits
       the same deregistration undercount and cannot corroborate the level.
       Useful as a transcription check on our own reading; not evidence about
       reality. The claim that the national level is international rests on
       assertion 4 (the sub-national divergence), not on this one.
    4. Sub-national migration must NOT tile to the national figure. If a future
       transform made it tile, the series would have silently become something
       else. The okres sum currently runs 8-12x the national figure because
       below the national level these indicators count moves across that unit's
       boundary, internal moves included.
    """
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")
    details: list[str] = []
    worst = "green"

    def fail(msg: str) -> None:
        nonlocal worst
        worst = "red"
        details.append(msg)

    wide = (df
        .filter(pl.col("metric").is_in(
            ["natural_increase", "migr_in", "migr_out", "migr_net",
             "births_live", "deaths", "total_change"]))
        .pivot(on="metric", index=["year", "geo_level", "geo_code"], values="value")
    )

    # 1. natural_increase == live births - deaths
    if {"births_live", "deaths", "natural_increase"} <= set(wide.columns):
        sub = wide.drop_nulls(subset=["births_live", "deaths", "natural_increase"])
        bad = sub.filter(
            (pl.col("births_live") - pl.col("deaths") - pl.col("natural_increase")).abs() > 0.5
        )
        if len(bad):
            fail(f"natural_increase != live_births - deaths for {len(bad):,} of {len(sub):,} observations")
        else:
            details.append(f"natural_increase == live_births - deaths for all {len(sub):,} observations")
    else:
        fail("cannot check natural_increase: births_live, deaths or natural_increase missing")

    # 2. migr_net == migr_in - migr_out
    if {"migr_in", "migr_out", "migr_net"} <= set(wide.columns):
        sub = wide.drop_nulls(subset=["migr_in", "migr_out", "migr_net"])
        bad = sub.filter(
            (pl.col("migr_in") - pl.col("migr_out") - pl.col("migr_net")).abs() > 0.5
        )
        if len(bad):
            fail(f"migr_net != migr_in - migr_out for {len(bad):,} of {len(sub):,} observations")
        else:
            details.append(f"migr_net == migr_in - migr_out for all {len(sub):,} observations")
    else:
        fail("cannot check migr_net: migr_in, migr_out or migr_net missing")

    # 3. National emigration must match Eurostat, an independent source.
    euro = _eurostat_sk_emigration()
    nat_out = {
        r["year"]: r["value"]
        for r in df.filter(
            (pl.col("metric") == "migr_out") & (pl.col("geo_level") == "nation")
        ).select("year", "value").iter_rows(named=True)
    }
    shared = sorted(set(euro) & set(nat_out))
    if not shared:
        fail("no overlapping years between national migr_out and Eurostat migr_emi1ctz")
    else:
        mism = [y for y in shared if abs(euro[y] - nat_out[y]) > 0.5]
        if mism:
            fail(
                f"national migr_out disagrees with Eurostat migr_emi1ctz in {len(mism)} "
                f"of {len(shared)} shared years, e.g. "
                + ", ".join(f"{y}: SUSR={nat_out[y]:,.0f} vs Eurostat={euro[y]:,.0f}" for y in mism[:3])
            )
        else:
            details.append(
                f"national migr_out matches Eurostat migr_emi1ctz for all "
                f"{len(shared)} shared years ({min(shared)}-{max(shared)}). This is "
                "a transcription check only: Eurostat redistributes SUSR's own "
                "filing, so it cannot corroborate the level"
            )

    # 4. Sub-national migration must NOT tile to the national total.
    for level in ("okres", "oblast", "kraj"):
        nat = df.filter((pl.col("metric") == "migr_out") & (pl.col("geo_level") == "nation"))
        sub = df.filter((pl.col("metric") == "migr_out") & (pl.col("geo_level") == level))
        if len(nat) == 0 or len(sub) == 0:
            continue
        n_tot = nat.group_by("year").agg(pl.col("value").sum().alias("n"))
        s_tot = sub.group_by("year").agg(pl.col("value").sum().alias("s"))
        j = n_tot.join(s_tot, on="year").filter(pl.col("n") > 0)
        if len(j) == 0:
            continue
        ratios = (j["s"] / j["n"]).to_list()
        if max(ratios) < 1.5:
            fail(
                f"migr_out at geo_level='{level}' now tiles to the national total "
                f"(max ratio {max(ratios):.2f}x). It previously ran far above it "
                "because sub-national rows count internal moves too. Either the "
                "source changed meaning or the transform started filtering."
            )
        else:
            details.append(
                f"migr_out at '{level}' sums to {min(ratios):.1f}-{max(ratios):.1f}x the "
                "national figure, as expected: sub-national rows include internal moves"
            )

    return CheckResult(
        name="Metric definitions (each metric tied to a different indicator)",
        severity=worst,
        summary=("PASS: all four definition checks hold" if worst == "green"
                 else "FAIL: a metric does not measure what its name says"),
        details=details,
    )


def check_no_ambiguous_keys() -> CheckResult:
    """No parquet may hold two rows with the same key and different values.

    A duplicate key means a dimension of the source cube was dropped rather than
    selected from: the rows that differ only in the dropped dimension all land on
    one key. Whichever a chart happens to pick then wins silently, and summing
    them double-counts. This is the shape behind the SK_CAP aggregate, the
    quarter collapse in the wage cube, and the residence-type collapse in
    CIZ002T002.
    """
    specs = {
        "section1_internal.parquet": [
            "year", "geo_level", "geo_code", "age_bracket", "sex", "education",
            "metric", "source",
        ],
        "section2_corridor.parquet": [
            "year", "flow_direction", "pathway", "sk_geo_code", "cz_geo_code",
            "age_bracket", "sex", "education", "field_or_sector", "metric",
            "source", "employment_status",
        ],
        "section3_diaspora.parquet": [
            "year", "slovak_def", "destination_iso3", "sex", "age_bracket",
            "education", "metric", "source", "measure_code",
        ],
    }

    details = []
    worst = "green"
    for fname, key in specs.items():
        path = PROCESSED / fname
        if not path.exists():
            continue
        df = pl.read_parquet(path)
        key = [c for c in key if c in df.columns]
        dup = (df
            .group_by(key)
            .agg(pl.len().alias("n"), pl.col("value").n_unique().alias("nv"))
            .filter(pl.col("n") > 1)
        )
        if len(dup) == 0:
            details.append(f"{fname}: {len(df):,} rows, all keys unique")
            continue
        worst = "red"
        conflicting = dup.filter(pl.col("nv") > 1)
        extra = int(dup.select((pl.col("n") - 1).sum()).item())
        details.append(
            f"{fname}: {len(dup):,} duplicated keys covering {extra:,} redundant "
            f"rows, of which {len(conflicting):,} hold CONFLICTING values"
        )
        for r in conflicting.head(4).iter_rows(named=True):
            shown = {k: r[k] for k in key if k in ("year", "metric", "source", "sex")}
            details.append(f"    {shown} -> {r['n']} rows, {r['nv']} distinct values")

    return CheckResult(
        name="No ambiguous keys (a dropped dimension collapses rows)",
        severity=worst,
        summary=("PASS: every row uniquely keyed" if worst == "green"
                 else "FAIL: a source dimension was dropped rather than selected from"),
        details=details,
    )


def check_subtotal_double_counting() -> CheckResult:
    """Every parquet must let a total be summed without double-counting subtotals.

    THE HOLE THIS CLOSES. check_no_ambiguous_keys verifies that no two rows share
    a key, which is a property of the TRANSFORMS. It says nothing about whether an
    ad-hoc query written later will sum a total together with its own parts. That
    is how the USA naturalisation figure became 15,751: a query summed sex='all'
    and sex='F' rows together, and the female subtotal was counted twice. Every
    number in a prose draft comes from queries like that one.

    This check reports, for each dimension that carries an 'all'/'total' member
    alongside its parts, how badly an unfiltered SUM would overstate. It is
    intentionally advisory rather than red: the file is CORRECT, holding both a
    total and its components is normal, and the fix is to constrain the query. The
    point is that the size of the trap is on the record rather than discovered by
    shipping a wrong figure.

    Enforcement of the actual rule lives elsewhere: any figure entering prose must
    come from pipeline/analysis/headline_figures.py, which carries its SQL and is
    asserted to return exactly one row.
    """
    specs = [
        ("section1_internal.parquet", ["sex", "age_bracket", "education", "geo_level"]),
        ("section2_corridor.parquet", ["sex", "age_bracket", "education",
                                       "employment_status", "pathway"]),
        ("section3_diaspora.parquet", ["sex", "age_bracket", "education"]),
    ]
    TOTAL_MEMBERS = {"all", "total", "_T", "T"}

    details: list[str] = []
    for fname, dims in specs:
        path = PROCESSED / fname
        if not path.exists():
            continue
        df = pl.read_parquet(path)
        for dim in dims:
            if dim not in df.columns:
                continue
            members = set(df[dim].unique().to_list())
            totals = members & TOTAL_MEMBERS
            parts = members - TOTAL_MEMBERS - {None}
            if not totals or not parts:
                continue
            total_sum = df.filter(pl.col(dim).is_in(list(totals)))["value"].sum()
            part_sum = df.filter(pl.col(dim).is_in(list(parts)))["value"].sum()
            if not total_sum:
                continue
            overstate = (total_sum + part_sum) / total_sum
            details.append(
                f"{fname} dim '{dim}': totals={sorted(totals)} parts={sorted(parts)}. "
                f"An unfiltered SUM overstates by {overstate:.2f}x "
                f"({total_sum:,.0f} -> {total_sum + part_sum:,.0f}). Constrain "
                f"{dim} in every query."
            )

    if not details:
        details.append("No dimension carries a total alongside its parts.")

    return CheckResult(
        name="Subtotal double-counting exposure (advisory)",
        severity="yellow" if len(details) > 1 or "overstates" in details[0] else "green",
        summary=f"{len(details)} dimension(s) where an unconstrained SUM double-counts",
        details=details,
    )


def check_cz_corridor_crosscheck() -> CheckResult:
    """Slovaks in CZ per CSU vs SK emigration data."""
    df2 = pl.read_parquet(PROCESSED / "section2_corridor.parquet")
    df3 = pl.read_parquet(PROCESSED / "section3_diaspora.parquet")

    # CSU stock (section 2)
    csu_stock = (df2
        .filter(
            (pl.col("pathway") == "all") &
            (pl.col("metric") == "stock") &
            (pl.col("sex") == "all") &
            (pl.col("cz_geo_code") == "CZ")
        )
        .select("year", "value")
        .sort("year")
    )

    # OECD/UN DESA stock for CZE (section 3)
    diaspora_cz = (df3
        .filter(
            (pl.col("destination_iso3").is_in(["CZE", "203"])) &
            (pl.col("metric") == "stock") &
            (pl.col("sex") == "all")
        )
        .select("year", "value")
        .sort("year")
    )

    details = []
    worst = "green"

    csu_dict = {r["year"]: r["value"] for r in csu_stock.iter_rows(named=True)}
    dias_dict = {r["year"]: r["value"] for r in diaspora_cz.iter_rows(named=True)}

    for year in sorted(set(csu_dict.keys()) & set(dias_dict.keys())):
        csu_val = csu_dict[year]
        dias_val = dias_dict[year]
        if csu_val > 0:
            pct_diff = (dias_val - csu_val) / csu_val * 100
            details.append(f"{year}: CSU={csu_val:,.0f}, OECD/DESA={dias_val:,.0f} ({pct_diff:+.1f}%)")
            if abs(pct_diff) > 30:
                worst = "yellow"

    if not details:
        details.append("No overlapping years between CSU and diaspora data for CZ")
        worst = "yellow"

    return CheckResult(
        name="CZ corridor cross-check (CSU vs OECD/DESA)",
        severity=worst,
        summary=f"Discrepancy is expected (different definitions); quantified below",
        details=details,
    )


def check_un_desa_vs_oecd() -> CheckResult:
    """UN DESA vs OECD stock should be within +/-15% for same year."""
    df3 = pl.read_parquet(PROCESSED / "section3_diaspora.parquet")

    oecd = df3.filter(pl.col("source") == "oecd_mig_popf")
    desa = df3.filter(pl.col("source") == "un_desa_bilateral_2020")

    details = []
    worst = "green"

    # Compare for overlapping destinations and years
    oecd_agg = (oecd
        .filter(pl.col("sex") == "all")
        .group_by("year", "destination_iso3")
        .agg(pl.col("value").sum().alias("oecd_val"))
    )
    desa_agg = (desa
        .filter(pl.col("sex") == "all")
        .group_by("year", "destination_iso3")
        .agg(pl.col("value").sum().alias("desa_val"))
    )

    joined = oecd_agg.join(desa_agg, on=["year", "destination_iso3"], how="inner")

    if len(joined) == 0:
        details.append("No direct overlap between OECD popf and UN DESA (different country codes: ISO3 vs numeric)")
        details.append("This is expected - OECD uses ISO3 (CZE), DESA uses numeric (203). Harmonization needed in frontend.")
        worst = "yellow"
    else:
        for row in joined.iter_rows(named=True):
            if row["oecd_val"] > 0:
                pct = abs(row["desa_val"] - row["oecd_val"]) / row["oecd_val"] * 100
                if pct > 15:
                    details.append(f"{row['year']} {row['destination_iso3']}: OECD={row['oecd_val']:,.0f} DESA={row['desa_val']:,.0f} ({pct:.0f}% diff)")
                    worst = "yellow"

    if not details:
        details.append("All overlapping entries within 15%")

    return CheckResult(
        name="UN DESA vs OECD stock comparison",
        severity=worst,
        summary=f"{len(details)} observations",
        details=details,
    )


def check_eurostat_vs_susr() -> CheckResult:
    """Eurostat and SUSR national figures should approximately match."""
    df1 = pl.read_parquet(PROCESSED / "section1_internal.parquet")

    # SUSR population at SK0 level
    susr_pop = (df1
        .filter(
            (pl.col("metric") == "population") &
            (pl.col("geo_code") == "SK0") &
            (pl.col("age_bracket") == "all") &
            (pl.col("education") == "all")
        )
        .select("year", "value")
        .sort("year")
    )

    details = []
    worst = "green"

    if len(susr_pop) > 0:
        latest = susr_pop.tail(1).row(0, named=True)
        details.append(f"SUSR SR population {latest['year']}: {latest['value']:,.0f}")
        details.append("Eurostat bulk TSV not yet parsed into section1 for direct comparison")
        details.append("Cross-check deferred to frontend layer (DuckDB query on raw Eurostat TSV)")
        worst = "yellow"
    else:
        details.append("No SK0 population data found in section1")
        worst = "red"

    return CheckResult(
        name="Eurostat vs SUSR national figures",
        severity=worst,
        summary="Partial check - Eurostat raw available but not directly comparable in current transform",
        details=details,
    )


def generate_report(results: list[CheckResult]) -> str:
    """Generate HTML report."""
    severity_colors = {"green": "#2d6a4f", "yellow": "#e9c46a", "red": "#e63946"}
    severity_bg = {"green": "#d8f3dc", "yellow": "#fff3cd", "red": "#f8d7da"}

    rows_html = ""
    for r in results:
        color = severity_colors[r.severity]
        bg = severity_bg[r.severity]
        details_html = "".join(f"<li>{d}</li>" for d in r.details)
        rows_html += f"""
        <div style="border-left: 4px solid {color}; background: {bg}; padding: 12px 16px; margin: 12px 0; border-radius: 4px;">
            <h3 style="margin: 0; color: {color};">[{r.severity.upper()}] {r.name}</h3>
            <p style="margin: 4px 0; font-style: italic;">{r.summary}</p>
            <ul style="margin: 4px 0; padding-left: 20px; font-size: 0.9em;">
                {details_html}
            </ul>
        </div>
        """

    red_count = sum(1 for r in results if r.severity == "red")
    yellow_count = sum(1 for r in results if r.severity == "yellow")
    green_count = sum(1 for r in results if r.severity == "green")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Stage 3 Validation Report - Slovak Brain Drain</title>
    <style>
        body {{ font-family: 'Inter Tight', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }}
        h1 {{ border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }}
        .summary {{ font-size: 1.1em; margin: 20px 0; padding: 12px; background: #f8f9fa; border-radius: 4px; }}
    </style>
</head>
<body>
    <h1>Stage 3: Data Validation Report</h1>
    <div class="summary">
        <strong>Results:</strong> {green_count} green, {yellow_count} yellow, {red_count} red
        <br>
        <strong>Verdict:</strong> {"RED FLAGS - human decision required" if red_count > 0 else "No blocking issues. Yellow flags are documented discrepancies."}
    </div>
    {rows_html}
    <hr>
    <p style="font-size: 0.8em; color: #666;">Generated by pipeline/validate/invariants.py</p>
</body>
</html>"""
    return html


def check_geo_levels_tile() -> CheckResult:
    """Every territorial level must sum to the national total, every year.

    Slovakia's geography is published as nested levels that each cover the whole
    country: 4 oblasti, 8 kraje, 79 okresy. Any level therefore has to sum to the
    national figure. A level that overshoots is double-counting, which is exactly
    what happened when SK_CAP ("Bratislava districts I - V") was classified as an
    okres and summed alongside its own five components: the okres level ran 7.9
    percent above the national total in 2004, rising to 8.8 percent by 2025.

    This check would have caught that in May. It is cheap and it is the one
    invariant that makes an aggregate-labelled-as-a-unit impossible to miss.

    `okres_aggregate` and `urban_rural` are deliberately excluded: the former is a
    partial subset by construction, the latter is an orthogonal city/country
    split rather than a territorial tiling.
    """
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")
    pop = df.filter((pl.col("metric") == "population") & (pl.col("age_bracket") == "all"))

    national = {
        r["year"]: r["value"]
        for r in pop.filter(pl.col("geo_level") == "nation").iter_rows(named=True)
    }

    details: list[str] = []
    worst = "green"

    if not national:
        return CheckResult(
            name="Geo levels tile to national total",
            severity="red",
            summary="no national-level rows found",
            details=["Cannot verify tiling: no geo_level='nation' population rows."],
        )

    TILING_LEVELS = ["oblast", "kraj", "okres"]
    for level in TILING_LEVELS:
        sums = (
            pop.filter(pl.col("geo_level") == level)
            .group_by("year")
            .agg(pl.col("value").sum().alias("s"))
        )
        if len(sums) == 0:
            details.append(f"{level}: NO ROWS")
            worst = "red"
            continue

        failures = []
        for r in sums.iter_rows(named=True):
            nat = national.get(r["year"])
            if nat is None or nat == 0:
                continue
            pct = abs(r["s"] - nat) / nat * 100
            # Tolerance is for float noise only, not for a real discrepancy.
            if pct > 0.01:
                failures.append(
                    f"{r['year']}: {level} sum={r['s']:,.0f} vs national={nat:,.0f} ({pct:.1f}%)"
                )

        if failures:
            worst = "red"
            details.append(f"{level}: {len(failures)} of {len(sums)} years do NOT tile")
            details.extend(failures[:5])
        else:
            details.append(f"{level}: tiles exactly in all {len(sums)} years")

    return CheckResult(
        name="Geo levels tile to national total",
        severity=worst,
        summary=f"{len(TILING_LEVELS)} levels checked across {len(national)} years",
        details=details,
    )


def run() -> list[CheckResult]:
    log.info("validate.start")

    results = [
        check_population_consistency(),
        check_geo_levels_tile(),
        check_no_ambiguous_keys(),
        check_metric_definitions(),
        check_subtotal_double_counting(),
        check_population_reconciles(),
        check_cz_corridor_crosscheck(),
        check_un_desa_vs_oecd(),
        check_eurostat_vs_susr(),
    ]

    html = generate_report(results)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(html, encoding="utf-8")
    log.info("validate.done report=%s", REPORT_PATH)

    for r in results:
        log.info("validate.check name=%s severity=%s", r.name, r.severity)

    return results


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    results = run()

    print("\n" + "=" * 65)
    print("  STAGE 3: VALIDATION REPORT")
    print("=" * 65)
    for r in results:
        icon = {"green": "OK", "yellow": "!!", "red": "XX"}[r.severity]
        print(f"\n  [{icon}] {r.name}")
        print(f"      {r.summary}")
        for d in r.details[:5]:
            print(f"        - {d}")
        if len(r.details) > 5:
            print(f"        ... and {len(r.details) - 5} more")

    red = sum(1 for r in results if r.severity == "red")
    print(f"\n{'=' * 65}")
    if red:
        print(f"  {red} RED FLAG(S) - require human decision before proceeding")
    else:
        print("  No blocking issues. Report written to pipeline/validate/report.html")
    print("=" * 65)

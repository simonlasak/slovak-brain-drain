"""
Stage 3: Validate - Cross-source sanity checks.

Runs 5 invariant checks against the processed parquet files and produces
an HTML report at pipeline/validate/report.html with green/yellow/red severity.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import polars as pl

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = REPO_ROOT / "data" / "processed"
REPORT_PATH = REPO_ROOT / "pipeline" / "validate" / "report.html"


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


def check_migration_accounting() -> CheckResult:
    """pop[t] = pop[t-1] + births - deaths + intl_net + internal_net (approx)."""
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")

    pop = df.filter(
        (pl.col("metric") == "population") &
        (pl.col("age_bracket") == "all") &
        (pl.col("education") == "all") &
        (pl.col("geo_level") == "nation") &
        (pl.col("geo_code") == "SK0")
    ).sort("year")

    births = df.filter(
        (pl.col("metric") == "births") & (pl.col("geo_code") == "SK0")
    ).sort("year")

    deaths = df.filter(
        (pl.col("metric") == "deaths") & (pl.col("geo_code") == "SK0")
    ).sort("year")

    intl_net = df.filter(
        (pl.col("metric") == "intl_net") & (pl.col("geo_code") == "SK0")
    ).sort("year")

    details = []
    worst = "green"

    pop_dict = {r["year"]: r["value"] for r in pop.iter_rows(named=True)}
    births_dict = {r["year"]: r["value"] for r in births.iter_rows(named=True)}
    deaths_dict = {r["year"]: r["value"] for r in deaths.iter_rows(named=True)}
    intl_dict = {r["year"]: r["value"] for r in intl_net.iter_rows(named=True)}

    for year in range(2005, 2026):
        if year not in pop_dict or (year - 1) not in pop_dict:
            continue
        actual_change = pop_dict[year] - pop_dict[year - 1]
        b = births_dict.get(year, 0)
        d = deaths_dict.get(year, 0)
        m = intl_dict.get(year, 0)
        expected_change = b - d + m

        if abs(actual_change) > 0:
            residual = actual_change - expected_change
            pct = abs(residual) / abs(actual_change) * 100 if actual_change != 0 else 0
            if pct > 20:
                details.append(f"{year}: actual change={actual_change:,.0f}, computed={expected_change:,.0f}, residual={residual:,.0f} ({pct:.0f}%)")
                worst = "yellow"

    if not details:
        details.append("Migration accounting holds within 20% for all years at SR level")

    return CheckResult(
        name="Migration accounting (pop change vs births-deaths+migration)",
        severity=worst,
        summary=f"{'PASS' if worst == 'green' else 'FLAGS'}: {len(details)} observations",
        details=details,
    )


def check_component_identity() -> CheckResult:
    """total_change must equal natural_increase + intl_net exactly, everywhere.

    SUSR publishes the components and the total as separate indicators of the
    same cube, so this identity is a property of the source, not an estimate. It
    is the check that names each indicator correctly: IN010076 was mapped to
    `internal_net`, implying net internal migration, when it is natural increase.
    A metric named after what we wanted rather than what the indicator is cannot
    be caught downstream, but it cannot survive this identity.

    Note this is exact, unlike check_migration_accounting, which compares against
    the `births` series (IN010054, all births) where the natural-increase
    indicator uses live births (IN010106). That difference is why the looser
    check carries a permanent residual.
    """
    df = pl.read_parquet(PROCESSED / "section1_internal.parquet")

    wide = (df
        .filter(pl.col("metric").is_in(["natural_increase", "intl_net", "total_change"]))
        .pivot(on="metric", index=["year", "geo_level", "geo_code"], values="value")
    )
    needed = {"natural_increase", "intl_net", "total_change"}
    missing_cols = needed - set(wide.columns)
    if missing_cols:
        return CheckResult(
            name="Component identity (natural increase + net migration = total change)",
            severity="red",
            summary=f"FAIL: metrics absent from section1: {sorted(missing_cols)}",
            details=[
                "Cannot verify the identity because a component is missing. If an "
                "indicator was renamed, the rename dropped a quantity the identity "
                "depends on."
            ],
        )

    checked = wide.drop_nulls(subset=list(needed)).with_columns(
        (pl.col("natural_increase") + pl.col("intl_net") - pl.col("total_change")).abs().alias("resid")
    )
    bad = checked.filter(pl.col("resid") > 0.5)

    if len(bad) == 0:
        return CheckResult(
            name="Component identity (natural increase + net migration = total change)",
            severity="green",
            summary=f"PASS: identity exact for all {len(checked):,} year x geo observations",
            details=[
                "natural_increase + intl_net = total_change to the unit, at every "
                "geo level. Confirms IN010076 is natural increase, not migration.",
            ],
        )

    details = [
        f"{r['geo_code']} {r['year']}: natural={r['natural_increase']:,.0f} "
        f"net_mig={r['intl_net']:,.0f} total={r['total_change']:,.0f} "
        f"residual={r['resid']:,.0f}"
        for r in bad.head(8).iter_rows(named=True)
    ]
    return CheckResult(
        name="Component identity (natural increase + net migration = total change)",
        severity="red",
        summary=f"FAIL: identity broken for {len(bad):,} of {len(checked):,} observations",
        details=details + [
            "An indicator is mapped to the wrong metric name, or two indicators "
            "were collapsed onto one name.",
        ],
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
        check_component_identity(),
        check_migration_accounting(),
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

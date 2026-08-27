"""Extract the DZS 2023 survey figures §2 quotes, with their verbatim sentences.

    .venv/bin/python -m pipeline.transform.dzs_survey

WHY THIS EXISTS, and it is not only portability. §2 renders a stacked bar of Slovak
students' post-graduation intentions whose three shares were typed straight into the
chart component: 54 / 33 / 13, summing to exactly 100.

The report does not say that. Page 83 of the 2023 report says 54 percent plan to
stay, 13 percent want to use their knowledge in their country of origin, and 13
percent want to try another foreign country. That is 80. The remaining 20 points are
not attributed to anything in the source, and "Return to Slovakia 33%" appears
nowhere: it reconciles the bar to 100 and nothing else.

So this module does two jobs. It pins each quoted figure to the sentence that
supports it, so the chart can render the published numbers instead of a set that
adds up; and it writes them to data/processed/, which is committed, so the figures
survive on a machine without the 738 MB of raw sources. Until now the only evidence
for the site's survey claims was one PDF on one laptop.

The N was wrong too, and for an instructive reason: the site cited approximately
3,200 respondents, which is the 2020 survey's Slovak N (3,294) carried over from the
2021 report. The 2023 report gives 2,427. Same publisher, same table number, wrong
vintage.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

log = logging.getLogger(__name__)

REPO = Path(__file__).resolve().parents[2]
PDF = REPO / "data" / "raw" / "csu_foreigners" / "dzs_foreign_students_cz_2023_en.pdf"
OUT = REPO / "data" / "processed" / "dzs_slovak_2023.json"

# The report sets body text in two columns, and a naive full-page extraction
# interleaves them into nonsense. Each sentence below is recovered by cropping to
# one column first. Page numbers are 1-based as printed in the tool, matching
# pdfplumber's page index plus one.
TARGETS = [
    {
        "key": "respondents_slovak",
        "page": 12,
        "pattern": r"Slovakia \(N = ([\d,]+)\)",
        "what": "Slovak respondents in the 2023 survey",
    },
    {
        "key": "stay_in_czechia_pct",
        "page": 83,
        "pattern": r"More than half of Slovaks \((\d+)%\) plan to stay in Czechia",
        "what": "Plan to stay in Czechia, for work or further study",
    },
    {
        "key": "continue_studies_pct",
        "page": 83,
        "pattern": r"(\d+)% of them want to continue their studies",
        "what": "Of those staying: continue studying",
    },
    {
        "key": "work_pct",
        "page": 83,
        "pattern": r"while (\d+)% plan to work",
        "what": "Of those staying: work",
    },
    {
        "key": "country_of_origin_pct",
        "page": 83,
        "pattern": r"(\d+)% of respondents want to use their knowledge in their country of origin",
        "what": "Want to use their knowledge in their country of origin",
    },
    {
        "key": "another_country_pct",
        "page": 83,
        "pattern": r"and (\d+)% of Slovaks want to try another foreign country",
        "what": "Want to try another foreign country",
    },
]


def column_texts(page) -> list[str]:
    """The page whole, plus each half, so a sentence split across columns is found."""
    w = page.width
    return [
        page.extract_text() or "",
        page.crop((0, 0, w / 2, page.height)).extract_text() or "",
        page.crop((w / 2, 0, w, page.height)).extract_text() or "",
    ]


def run() -> dict:
    if not PDF.exists():
        raise FileNotFoundError(
            f"{PDF} is missing. This step needs the raw fetch: "
            f"run pipeline.fetch.csu_foreigners."
        )
    import pdfplumber  # optional dependency, see requirements.txt

    figures: dict[str, dict] = {}
    with pdfplumber.open(PDF) as pdf:
        for target in TARGETS:
            page = pdf.pages[target["page"] - 1]
            found = None
            for text in column_texts(page):
                flat = " ".join(text.split())
                m = re.search(target["pattern"], flat)
                if m:
                    # Keep the sentence around the match, so the figure travels with
                    # the words that support it rather than as a bare number.
                    start = flat.rfind(".", 0, m.start()) + 1
                    end = flat.find(".", m.end())
                    found = {
                        "value": int(m.group(1).replace(",", "")),
                        "quote": flat[start : end + 1 if end != -1 else None].strip(),
                    }
                    break
            if not found:
                raise ValueError(
                    f"{target['key']}: pattern not found on page {target['page']}. "
                    f"The report layout changed; fix the pattern rather than dropping "
                    f"the figure."
                )
            figures[target["key"]] = {
                "what": target["what"],
                "value": found["value"],
                "page": target["page"],
                "quote": found["quote"],
            }
            log.info("%s = %s (p%d)", target["key"], found["value"], target["page"])

    stay = figures["stay_in_czechia_pct"]["value"]
    origin = figures["country_of_origin_pct"]["value"]
    other = figures["another_country_pct"]["value"]
    unattributed = 100 - stay - origin - other

    out = {
        "_comment": "GENERATED by pipeline/transform/dzs_survey.py. Do not edit by hand.",
        "source": "DZS, Research on Foreign Students in the Czech Republic, 2023 report",
        "population": "Slovak respondents only",
        "figures": figures,
        "post_graduation_shares": {
            "stay_in_czechia": stay,
            "country_of_origin": origin,
            "another_country": other,
            "not_attributed_in_source": unattributed,
            "note": (
                f"These three published shares total {stay + origin + other}, not 100. "
                f"The remaining {unattributed} points are not attributed to any category "
                f"in the report, and this file does not invent one. The site previously "
                f"rendered 54/33/13, which sums to 100 but whose 33 appears nowhere in "
                f"the source."
            ),
        },
        "caveats": [
            "Stated intention, not observed behaviour.",
            "Respondents are not a random sample of Slovak students in Czechia.",
            (
                "The stay share is the report's own 54, not the sum of its components: "
                f"{figures['work_pct']['value']} planning to work plus "
                f"{figures['continue_studies_pct']['value']} continuing studies is "
                f"{figures['work_pct']['value'] + figures['continue_studies_pct']['value']}, "
                "and the report rounds to 54."
            ),
        ],
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    data = run()
    print()
    for k, v in data["figures"].items():
        print(f"  {k:26s} {v['value']:>7,}  p{v['page']}")
    print()
    s = data["post_graduation_shares"]
    print(f"  stay {s['stay_in_czechia']}  origin {s['country_of_origin']}  "
          f"other {s['another_country']}  unattributed {s['not_attributed_in_source']}")
    print(f"\n  written to {OUT.relative_to(REPO)}")
